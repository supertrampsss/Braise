import { randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  SCORE_BUCKETS, SCORE_CONTRACT, SCORE_MAX, SCORE_MIN,
  acquireTargetCacheGuard, assertTargetCacheGuard, corpusEntries, loadActiveCorpus,
  releaseTargetCacheGuard, scoreIndex, sha256, stableJson, vectorNorm,
} from "./semantic-target-v2-common.mjs";

const PAGE_HEADER_BYTES = 64;
const MAX_PAGE_RAW_BYTES = PAGE_HEADER_BYTES + 262_144 * 6;
const HASH = /^[0-9a-f]{64}$/;

function validatePageInventory(pages, kind, manifest) {
  const firstKey = kind === "values" ? "firstId" : "firstPosition";
  const bytesPerEntry = kind === "values" ? 6 : 4;
  const filePattern = kind === "values"
    ? /^values-\d{10}-[0-9a-f]{16}\.brt\.gz$/
    : /^order-\d{10}-[0-9a-f]{16}\.brt\.gz$/;
  let next = 0; const files = new Set(); const objects = new Set();
  for (const page of pages) {
    const expectedCount = Math.min(manifest.config.pageEntries, manifest.stats.dictionarySize - next);
    if (!page || page[firstKey] !== next || page.count !== expectedCount ||
        basename(page.file) !== page.file || !filePattern.test(page.file) ||
        !page.file.startsWith(`${kind === "values" ? "values" : "order"}-${String(next).padStart(10, "0")}-`) ||
        !HASH.test(page.rawSha256) || !HASH.test(page.objectSha256) ||
        files.has(page.file) || objects.has(page.objectSha256) ||
        !page.file.endsWith(`-${page.objectSha256.slice(0, 16)}.brt.gz`) ||
        page.rawBytes !== PAGE_HEADER_BYTES + page.count * bytesPerEntry ||
        !Number.isInteger(page.compressedBytes) || page.compressedBytes < 1 ||
        page.compressedBytes > page.rawBytes + 65_536) {
      throw new Error(`Target ${kind} page inventory is invalid`);
    }
    files.add(page.file); objects.add(page.objectSha256);
    next += page.count;
  }
  if (next !== manifest.stats.dictionarySize) throw new Error(`Target ${kind} pages do not cover every admitted word`);
}

/** Validate the complete immutable BRT2 manifest contract without reading its page objects. */
export function validateSemanticTargetManifestContract({ manifest, corpus, targetId, active = null }) {
  const contractHash = sha256(stableJson(SCORE_CONTRACT));
  if (manifest.schemaVersion !== 1 || manifest.complete !== true || manifest.format !== "BRT2-pages" || manifest.formatVersion !== 2 ||
      manifest.target?.id !== targetId || !HASH.test(manifest.target.wordSha256) ||
      active && (active.targetId !== targetId || active.corpusId !== corpus.manifest.corpusId) ||
      manifest.corpus?.id !== corpus.manifest.corpusId || manifest.corpus.manifestSha256 !== corpus.manifestSha256 ||
      manifest.corpus.semanticSha256 !== corpus.manifest.semanticSha256 || manifest.corpus.dictionarySize !== corpus.manifest.stats.accepted ||
      manifest.corpus.dimensions !== corpus.manifest.config.dimensions || manifest.config?.schemaVersion !== 1 ||
      manifest.config.formatVersion !== 2 || manifest.config.contractHash !== contractHash ||
      stableJson(manifest.config.contract) !== stableJson(SCORE_CONTRACT) || manifest.config.corpusId !== corpus.manifest.corpusId ||
      manifest.config.corpusManifestSha256 !== corpus.manifestSha256 || manifest.config.semanticSha256 !== corpus.manifest.semanticSha256 ||
      manifest.config.targetId !== targetId || sha256(stableJson(manifest.config)) !== manifest.configHash ||
      !Number.isInteger(manifest.config.pageEntries) || manifest.config.pageEntries < 256 || manifest.config.pageEntries > 262_144 ||
      manifest.stats?.dictionarySize !== corpus.manifest.stats.accepted || manifest.stats.scoreMin !== SCORE_MIN || manifest.stats.scoreMax !== SCORE_MAX ||
      !Array.isArray(manifest.histogram) || manifest.histogram.length !== SCORE_BUCKETS ||
      !manifest.histogram.every(value => Number.isSafeInteger(value) && value >= 0) ||
      manifest.histogram.reduce((sum, value) => sum + value, 0) !== corpus.manifest.stats.accepted ||
      !Array.isArray(manifest.valuePages) || !Array.isArray(manifest.orderPages) ||
      manifest.valuePages.length !== Math.ceil(corpus.manifest.stats.accepted / manifest.config.pageEntries) ||
      manifest.orderPages.length !== Math.ceil(corpus.manifest.stats.accepted / manifest.config.pageEntries) ||
      manifest.stats.valuePages !== manifest.valuePages.length || manifest.stats.orderPages !== manifest.orderPages.length) {
    throw new Error("Target manifest contract is unsupported or inconsistent");
  }
  validatePageInventory(manifest.valuePages, "values", manifest);
  validatePageInventory(manifest.orderPages, "order", manifest);
  return { contractHash };
}

function independentScore(vector, targetVector, dimensions, targetNorm, sameIdentity) {
  if (sameIdentity) return 10_000;
  let dot = 0; let normSquared = 0;
  for (let index = 0; index < dimensions; index++) {
    const value = vector.readFloatLE(index * 4); const target = targetVector.readFloatLE(index * 4);
    if (!Number.isFinite(value) || !Number.isFinite(target)) throw new Error("Non-finite vector during independent target verification");
    dot += value * target; normSquared += value * value;
  }
  const denominator = Math.sqrt(normSquared) * targetNorm;
  if (!(denominator > 0) || !Number.isFinite(denominator)) throw new Error("Invalid cosine denominator during independent verification");
  const scaled = Math.max(-1, Math.min(1, dot / denominator)) * 10_000;
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return Math.max(-10_000, Math.min(10_000, rounded));
}

async function readPage(pageDir, page, magic, targetManifest, corpusManifestSha256, contractHash) {
  if (basename(page.file) !== page.file || !/^[0-9a-f]{64}$/.test(page.rawSha256) || !/^[0-9a-f]{64}$/.test(page.objectSha256) || !Number.isInteger(page.rawBytes) || page.rawBytes < PAGE_HEADER_BYTES || page.rawBytes > MAX_PAGE_RAW_BYTES || !Number.isInteger(page.compressedBytes) || page.compressedBytes < 1 || page.compressedBytes > MAX_PAGE_RAW_BYTES + 65_536) throw new Error(`Invalid target page metadata: ${page.file}`);
  const path = join(pageDir, page.file); const info = await stat(path); if (info.size !== page.compressedBytes) throw new Error(`Target page stored size mismatch: ${page.file}`);
  const compressed = await readFile(path); if (sha256(compressed) !== page.objectSha256) throw new Error(`Target page object hash mismatch: ${page.file}`);
  let raw; try { raw = gunzipSync(compressed, { maxOutputLength: MAX_PAGE_RAW_BYTES }); }
  catch { throw new Error(`Cannot safely decompress target page: ${page.file}`); }
  if (raw.length !== page.rawBytes || sha256(raw) !== page.rawSha256 || raw.toString("ascii", 0, 4) !== magic || raw.readUInt16LE(4) !== 2) throw new Error(`Invalid target page payload: ${page.file}`);
  const expectedFlags = magic === "BSV2" ? 0b11 : 0b1;
  const targetId = raw.readUInt32LE(8); const first = raw.readUInt32LE(12); const count = raw.readUInt32LE(16); const dictionarySize = raw.readUInt32LE(20);
  const firstOffset = raw.readUInt32LE(24); const secondOffset = raw.readUInt32LE(28); const rawBytes = raw.readUInt32LE(32);
  if (raw.readUInt16LE(6) !== expectedFlags || targetId !== targetManifest.target.id || count !== page.count || dictionarySize !== targetManifest.stats.dictionarySize || firstOffset !== PAGE_HEADER_BYTES || rawBytes !== raw.length || raw.subarray(40, 56).toString("hex") !== corpusManifestSha256.slice(0, 32) || raw.subarray(56, 64).toString("hex") !== contractHash.slice(0, 16)) throw new Error(`Target page header mismatch: ${page.file}`);
  if (magic === "BSV2") {
    if (first !== page.firstId || secondOffset !== PAGE_HEADER_BYTES + count * 2 || raw.length !== PAGE_HEADER_BYTES + count * 6) throw new Error(`Value page layout mismatch: ${page.file}`);
  } else if (first !== page.firstPosition || secondOffset !== PAGE_HEADER_BYTES || raw.length !== PAGE_HEADER_BYTES + count * 4) throw new Error(`Order page layout mismatch: ${page.file}`);
  return raw;
}

async function* valueRecords(targetDir, manifest, corpusManifestSha256, contractHash) {
  let nextId = 0;
  for (const page of manifest.valuePages) {
    if (page.firstId !== nextId || page.count < 1 || page.count > manifest.config.pageEntries) throw new Error(`Value page range is invalid: ${page.file}`);
    const raw = await readPage(join(targetDir, "pages"), page, "BSV2", manifest, corpusManifestSha256, contractHash);
    const rankOffset = PAGE_HEADER_BYTES + page.count * 2;
    for (let index = 0; index < page.count; index++) yield { id: nextId + index, score: raw.readInt16LE(PAGE_HEADER_BYTES + index * 2), rank: raw.readUInt32LE(rankOffset + index * 4) };
    nextId += page.count;
  }
  if (nextId !== manifest.stats.dictionarySize) throw new Error("Value pages do not cover every admitted word");
}

async function* orderRecords(targetDir, manifest, corpusManifestSha256, contractHash) {
  let nextPosition = 0;
  for (const page of manifest.orderPages) {
    if (page.firstPosition !== nextPosition || page.count < 1 || page.count > manifest.config.pageEntries) throw new Error(`Order page range is invalid: ${page.file}`);
    const raw = await readPage(join(targetDir, "pages"), page, "BSO2", manifest, corpusManifestSha256, contractHash);
    for (let index = 0; index < page.count; index++) yield raw.readUInt32LE(PAGE_HEADER_BYTES + index * 4);
    nextPosition += page.count;
  }
  if (nextPosition !== manifest.stats.dictionarySize) throw new Error("Order pages do not cover every admitted word");
}

async function findTarget(corpusDir, corpusManifest, targetId) {
  for await (const { entries } of corpusEntries(corpusDir, corpusManifest)) {
    if (targetId >= entries[0].id && targetId <= entries.at(-1).id) return entries[targetId - entries[0].id];
  }
  throw new Error("Target id is absent from corpus segments");
}

/** Internal entry point for a caller that already owns the cache guard. */
export async function verifySemanticTargetUnderGuard({ corpusDir, outputDir, targetId, manifestName = null, expectedManifestSha256 = null, neighborCount = 12 }, cacheGuard) {
  corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  if (!Number.isInteger(neighborCount) || neighborCount < 1 || neighborCount > 256) throw new Error("Target neighbor count is invalid");
  const corpus = await loadActiveCorpus(corpusDir); const targetDir = join(outputDir, corpus.manifest.corpusId, "targets", String(targetId).padStart(10, "0"));
  assertTargetCacheGuard(cacheGuard, join(outputDir, corpus.manifest.corpusId, "targets"));
  let active = null;
  if (!manifestName) { active = JSON.parse(await readFile(join(targetDir, "active.json"), "utf8")); manifestName = active.manifest; expectedManifestSha256 = active.manifestSha256; }
  if (basename(manifestName) !== manifestName || !/^[0-9a-f]{64}$/.test(expectedManifestSha256)) throw new Error("Target manifest reference is invalid");
  const manifestBytes = await readFile(join(targetDir, manifestName)); if (sha256(manifestBytes) !== expectedManifestSha256) throw new Error("Target manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const { contractHash } = validateSemanticTargetManifestContract({ manifest, corpus, targetId, active });
  const target = await findTarget(corpusDir, corpus.manifest, targetId);
  if (sha256(Buffer.from(target.word)) !== manifest.target.wordSha256) throw new Error("Target word identity mismatch");
  const targetNorm = vectorNorm(target.vector, corpus.manifest.config.dimensions);
  const databasePath = join(targetDir, `.verify-target-${randomUUID()}.sqlite`); let database;
  const histogram = new Array(SCORE_BUCKETS).fill(0); const records = valueRecords(targetDir, manifest, corpus.manifestSha256, contractHash)[Symbol.asyncIterator]();
  try {
    database = new DatabaseSync(databasePath); database.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE scored(id INTEGER PRIMARY KEY, score INTEGER NOT NULL, rank INTEGER NOT NULL); CREATE INDEX score_order ON scored(score DESC, id ASC);");
    const insert = database.prepare("INSERT INTO scored(id, score, rank) VALUES (?, ?, ?)"); let seen = 0;
    for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) {
      database.exec("BEGIN");
      try {
        for (const entry of entries) {
          const stored = await records.next(); if (stored.done || stored.value.id !== entry.id) throw new Error(`Missing target value for word id ${entry.id}`);
          const expected = independentScore(entry.vector, target.vector, corpus.manifest.config.dimensions, targetNorm, entry.id === targetId);
          if (stored.value.score !== expected) throw new Error(`Target score mismatch for word id ${entry.id}`);
          scoreIndex(stored.value.score); histogram[scoreIndex(stored.value.score)]++; insert.run(entry.id, stored.value.score, stored.value.rank); seen++;
        }
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    }
    if (!(await records.next()).done || seen !== manifest.stats.dictionarySize) throw new Error("Target value inventory has extra or missing records");
    if (JSON.stringify(histogram) !== JSON.stringify(manifest.histogram)) throw new Error("Target histogram mismatch");
    const higher = new Uint32Array(SCORE_BUCKETS); let above = 0;
    for (let index = SCORE_BUCKETS - 1; index >= 0; index--) { higher[index] = above; above += histogram[index]; }
    for (const row of database.prepare("SELECT id, score, rank FROM scored ORDER BY id ASC").iterate()) if (row.rank !== higher[scoreIndex(row.score)] + 1) throw new Error(`Competition rank mismatch for word id ${row.id}`);
    const order = orderRecords(targetDir, manifest, corpus.manifestSha256, contractHash)[Symbol.asyncIterator](); let position = 0;
    for (const row of database.prepare("SELECT id FROM scored ORDER BY score DESC, id ASC").iterate()) { const stored = await order.next(); if (stored.done || stored.value !== row.id) throw new Error(`Stable order mismatch at position ${position}`); position++; }
    if (!(await order.next()).done || position !== seen) throw new Error("Stable order contains extra or missing ids");
    const topRows = [...database.prepare("SELECT id, score, rank FROM scored ORDER BY score DESC, id ASC LIMIT ?").iterate(neighborCount + 1)].filter(row => row.id !== targetId).slice(0, neighborCount);
    const topWords = new Map(); const neededTopIds = new Set(topRows.map(row => row.id));
    for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) for (const entry of entries) if (neededTopIds.has(entry.id)) topWords.set(entry.id, entry.word);
    if (topWords.size !== topRows.length) throw new Error("Top-neighbor identities are absent from the corpus");
    return {
      corpusId: corpus.manifest.corpusId, targetId, targetWord: target.word, targetWordSha256: manifest.target.wordSha256,
      dictionarySize: seen, valuePages: manifest.valuePages.length, orderPages: manifest.orderPages.length,
      manifestSha256: expectedManifestSha256, manifestUtf8: manifestBytes.toString("utf8"), contractHash,
      histogramSha256: sha256(Buffer.from(stableJson(histogram))),
      topNeighbors: topRows.map(row => ({ id: row.id, word: topWords.get(row.id), score: row.score, rank: row.rank })),
    };
  } finally {
    await records.return?.().catch(() => {}); try { database?.close(); } catch {} await rm(databasePath, { force: true });
  }
}

/** @param {{corpusDir:string, outputDir:string, targetId:number, manifestName?:string|null, expectedManifestSha256?:string|null, testHoldAfterCacheLockMs?:number}} options */
export async function verifySemanticTarget(options) {
  const corpusDir = resolve(options.corpusDir); const outputDir = resolve(options.outputDir);
  const corpus = await loadActiveCorpus(corpusDir); const targetsRoot = join(outputDir, corpus.manifest.corpusId, "targets");
  const cacheGuard = acquireTargetCacheGuard(targetsRoot, "shared");
  try {
    if (options.testHoldAfterCacheLockMs > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, options.testHoldAfterCacheLockMs));
    return await verifySemanticTargetUnderGuard({ ...options, corpusDir, outputDir }, cacheGuard);
  } finally { releaseTargetCacheGuard(cacheGuard); }
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR --target-id N"); values[argv[index].slice(2)] = argv[index + 1]; }
  if (!values.corpus || !values.output || values["target-id"] === undefined) throw new Error("--corpus, --output and --target-id are required"); return { corpusDir: values.corpus, outputDir: values.output, targetId: Number(values["target-id"]) };
}

if (process.argv[1] && basename(process.argv[1]) === "verify-semantic-target-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) verifySemanticTarget(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
