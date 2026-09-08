import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { corpusEntries, durableWrite, installImmutable, loadActiveCorpus, sha256, stableJson } from "./semantic-target-v2-common.mjs";
import { DEFAULT_MAX_LEAF_RAW_BYTES, INDEX_HEADER_BYTES, INDEX_MAGIC, INDEX_VERSION, MAX_PREFIX_MANIFEST_BYTES, wordHash } from "./semantic-index-v2-common.mjs";

function leafBytes(rows, firstByte, secondByte, corpus) {
  const records = rows.map(row => { const word = Buffer.from(row.word); const record = Buffer.allocUnsafe(8 + word.length); record.writeUInt32LE(word.length, 0); record.writeUInt32LE(row.id, 4); word.copy(record, 8); return record; });
  const recordsOffset = INDEX_HEADER_BYTES + rows.length * 4; const rawBytes = recordsOffset + records.reduce((sum, record) => sum + record.length, 0); const raw = Buffer.allocUnsafe(rawBytes);
  raw.fill(0, 0, INDEX_HEADER_BYTES); raw.write(INDEX_MAGIC, 0, 4, "ascii"); raw.writeUInt16LE(INDEX_VERSION, 4); raw.writeUInt16LE(1, 6); raw.writeUInt8(firstByte, 8); raw.writeUInt8(secondByte, 9); raw.writeUInt32LE(rows.length, 12); raw.writeUInt32LE(INDEX_HEADER_BYTES, 16); raw.writeUInt32LE(recordsOffset, 20); raw.writeUInt32LE(rawBytes, 24); Buffer.from(corpus.manifestSha256.slice(0, 32), "hex").copy(raw, 32); Buffer.from(corpus.manifest.semanticSha256.slice(0, 32), "hex").copy(raw, 48);
  let cursor = recordsOffset; records.forEach((record, index) => { raw.writeUInt32LE(cursor, INDEX_HEADER_BYTES + index * 4); record.copy(raw, cursor); cursor += record.length; }); return raw;
}

export async function buildSemanticIndex({ corpusDir, outputDir, maxLeafRawBytes = DEFAULT_MAX_LEAF_RAW_BYTES }) {
  corpusDir = resolve(corpusDir); outputDir = resolve(outputDir); if (!Number.isInteger(maxLeafRawBytes) || maxLeafRawBytes < 1024 * 1024 || maxLeafRawBytes > 32 * 1024 * 1024) throw new Error("maxLeafRawBytes must be between 1 MiB and 32 MiB");
  const corpus = await loadActiveCorpus(corpusDir); const indexDir = join(outputDir, corpus.manifest.corpusId, "presence"); const leavesDir = join(indexDir, "leaves"); const prefixesDir = join(indexDir, "prefixes"); await mkdir(leavesDir, { recursive: true }); await mkdir(prefixesDir, { recursive: true });
  const guard = new DatabaseSync(join(indexDir, ".index-guard.sqlite"));
  try { guard.exec("PRAGMA busy_timeout=0; CREATE TABLE IF NOT EXISTS index_guard(id INTEGER PRIMARY KEY); BEGIN EXCLUSIVE;"); } catch { guard.close(); throw new Error("Another semantic index build owns this corpus"); }
  const databasePath = join(indexDir, `.index-${randomUUID()}.sqlite`); let database;
  try {
    database = new DatabaseSync(databasePath); database.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE entries(prefix INTEGER NOT NULL, word BLOB PRIMARY KEY, id INTEGER UNIQUE NOT NULL); CREATE INDEX entries_prefix_word ON entries(prefix, word);"); const insert = database.prepare("INSERT INTO entries(prefix, word, id) VALUES (?, ?, ?)");
    let count = 0;
    for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) { database.exec("BEGIN"); try { for (const entry of entries) { const bytes = Buffer.from(entry.word); const hash = wordHash(bytes); insert.run(hash.readUInt16BE(0), bytes, entry.id); count++; } database.exec("COMMIT"); } catch (error) { database.exec("ROLLBACK"); throw error; } }
    if (count !== corpus.manifest.stats.accepted) throw new Error("Index input does not cover the corpus");
    const prefixPages = []; let leafCount = 0; const measureLeaf = database.prepare("SELECT count(*) AS count, coalesce(sum(length(word) + 12), 0) + 64 AS rawBytes FROM entries WHERE prefix = ?"); const selectLeaf = database.prepare("SELECT word, id FROM entries WHERE prefix = ? ORDER BY word COLLATE BINARY");
    for (let firstByte = 0; firstByte < 256; firstByte++) {
      const leaves = [];
      for (let secondByte = 0; secondByte < 256; secondByte++) {
        const prefix = firstByte * 256 + secondByte; const measured = measureLeaf.get(prefix); if (measured.count === 0) continue; if (!Number.isSafeInteger(measured.rawBytes) || measured.rawBytes > maxLeafRawBytes) throw new Error(`Index leaf ${prefix.toString(16).padStart(4, "0")} exceeds maxLeafRawBytes before allocation`); const rows = [...selectLeaf.all(prefix)];
        const raw = leafBytes(rows, firstByte, secondByte, corpus); if (raw.length > maxLeafRawBytes) throw new Error(`Index leaf ${prefix.toString(16).padStart(4, "0")} exceeds maxLeafRawBytes`);
        const compressed = gzipSync(raw, { level: 9 }); const objectSha256 = sha256(compressed); const rawSha256 = sha256(raw); const file = `leaf-${prefix.toString(16).padStart(4, "0")}-${objectSha256.slice(0, 16)}.bpi.gz`; await installImmutable(join(leavesDir, file), compressed);
        leaves.push({ secondByte, count: rows.length, file, rawBytes: raw.length, compressedBytes: compressed.length, rawSha256, objectSha256 }); leafCount++;
      }
      if (!leaves.length) continue;
      const prefixBytes = Buffer.from(`${JSON.stringify({ schemaVersion: 1, firstByte, corpusManifestSha256: corpus.manifestSha256, leaves }, null, 2)}\n`); if (prefixBytes.length > MAX_PREFIX_MANIFEST_BYTES) throw new Error("Index prefix manifest exceeds its bounded size"); const prefixSha256 = sha256(prefixBytes); const file = `prefix-${firstByte.toString(16).padStart(2, "0")}-${prefixSha256.slice(0, 16)}.json`; await installImmutable(join(prefixesDir, file), prefixBytes); prefixPages.push({ firstByte, file, bytes: prefixBytes.length, sha256: prefixSha256, entries: leaves.reduce((sum, leaf) => sum + leaf.count, 0) });
    }
    const config = { schemaVersion: 1, format: "BPI2-hash-pages", formatVersion: 2, hash: "sha256-first-16-bits", ordering: "utf8-binary", record: "word-length-u32-word-id-u32-word-bytes", maxLeafRawBytes, corpusManifestSha256: corpus.manifestSha256 };
    const manifest = { schemaVersion: 1, complete: true, format: "BPI2-hash-pages", formatVersion: 2, corpus: { id: corpus.manifest.corpusId, manifestSha256: corpus.manifestSha256, semanticSha256: corpus.manifest.semanticSha256, dictionarySize: count }, config, configHash: sha256(stableJson(config)), stats: { dictionarySize: count, prefixPages: prefixPages.length, leaves: leafCount }, prefixPages };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`); const manifestSha256 = sha256(manifestBytes); const manifestName = `manifest-${manifest.configHash.slice(0, 16)}-${manifestSha256.slice(0, 16)}.json`; await installImmutable(join(indexDir, manifestName), manifestBytes);
    const { verifySemanticIndex } = await import("./verify-semantic-index-v2.mjs"); const verified = await verifySemanticIndex({ corpusDir, outputDir, manifestName, expectedManifestSha256: manifestSha256 }); if (verified.dictionarySize !== count) throw new Error("Independent index verification did not cover the corpus");
    await durableWrite(join(indexDir, "active.json"), `${JSON.stringify({ schemaVersion: 1, corpusId: corpus.manifest.corpusId, manifest: manifestName, manifestSha256 }, null, 2)}\n`); return manifest;
  } finally { try { database?.close(); } catch {} await rm(databasePath, { force: true }); try { guard.exec("ROLLBACK"); } catch {} guard.close(); }
}

function parseArgs(argv) { const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR"); values[argv[index].slice(2)] = argv[index + 1]; } if (!values.corpus || !values.output) throw new Error("--corpus and --output are required"); return { corpusDir: values.corpus, outputDir: values.output }; }
if (process.argv[1] && basename(process.argv[1]) === "build-semantic-index-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildSemanticIndex(parseArgs(process.argv.slice(2))).then(manifest => console.log(JSON.stringify(manifest.stats))).catch(error => { console.error(error.message); process.exitCode = 1; });
