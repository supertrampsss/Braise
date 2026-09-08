import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { corpusEntries } from "./semantic-target-v2-common.mjs";
import { loadIndexRoot, readIndexLeaf, readPrefixManifest, wordHash } from "./semantic-index-v2-common.mjs";

export async function verifySemanticIndex({ corpusDir, outputDir, manifestName = null, expectedManifestSha256 = null }) {
  const index = await loadIndexRoot(corpusDir, outputDir, manifestName, expectedManifestSha256); const dbPath = join(index.indexDir, `.verify-index-${randomUUID()}.sqlite`); let database;
  try {
    database = new DatabaseSync(dbPath); database.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE indexed(id INTEGER PRIMARY KEY, word BLOB UNIQUE NOT NULL);"); const insert = database.prepare("INSERT INTO indexed(id, word) VALUES (?, ?)"); let count = 0; let leaves = 0; let previousFirst = -1;
    for (const prefixReference of index.manifest.prefixPages) {
      if (!Number.isInteger(prefixReference.firstByte) || prefixReference.firstByte <= previousFirst || prefixReference.firstByte > 255) throw new Error("Index prefix pages are not strictly ordered"); previousFirst = prefixReference.firstByte; const prefix = await readPrefixManifest(index, prefixReference.firstByte); let previousSecond = -1;
      for (const leafReference of prefix.leaves) {
        if (!Number.isInteger(leafReference.secondByte) || leafReference.secondByte <= previousSecond || leafReference.secondByte > 255) throw new Error("Index leaves are not strictly ordered"); previousSecond = leafReference.secondByte; const records = await readIndexLeaf(index, leafReference, prefix.firstByte, leafReference.secondByte); if (records.length !== leafReference.count) throw new Error("Index leaf count mismatch");
        database.exec("BEGIN"); try { for (const record of records) { const hash = wordHash(record.word); if (hash[0] !== prefix.firstByte || hash[1] !== leafReference.secondByte) throw new Error("Index word is stored under the wrong hash prefix"); insert.run(record.id, record.word); count++; } database.exec("COMMIT"); } catch (error) { database.exec("ROLLBACK"); throw error; } leaves++;
      }
    }
    if (count !== index.manifest.stats.dictionarySize || leaves !== index.manifest.stats.leaves) throw new Error("Index pages do not cover their declared inventory");
    let expected = 0;
    for await (const { entries } of corpusEntries(resolve(corpusDir), index.corpus.manifest)) for (const entry of entries) { const row = database.prepare("SELECT word FROM indexed WHERE id = ?").get(entry.id); if (!row || !Buffer.from(row.word).equals(Buffer.from(entry.word))) throw new Error(`Index identity mismatch for word id ${entry.id}`); expected++; }
    if (expected !== count) throw new Error("Index contains extra or missing records"); return { corpusId: index.corpus.manifest.corpusId, dictionarySize: count, leaves, manifestSha256: index.manifestSha256 };
  } finally { try { database?.close(); } catch {} await rm(dbPath, { force: true }); }
}

function parseArgs(argv) { const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR"); values[argv[index].slice(2)] = argv[index + 1]; } if (!values.corpus || !values.output) throw new Error("--corpus and --output are required"); return { corpusDir: values.corpus, outputDir: values.output }; }
if (process.argv[1] && basename(process.argv[1]) === "verify-semantic-index-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) verifySemanticIndex(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
