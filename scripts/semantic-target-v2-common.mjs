import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, rename, stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";

export const TARGET_MAGIC = "BRT2";
export const TARGET_VERSION = 2;
export const TARGET_HEADER_BYTES = 96;
export const SCORE_MIN = -10_000;
export const SCORE_MAX = 10_000;
export const SCORE_BUCKETS = SCORE_MAX - SCORE_MIN + 1;
export const SCORE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  vectorInput: "verified-BRV2-float32",
  similarity: "cosine-float64-dimension-order",
  clamp: "minus-one-to-one",
  quantization: "times-10000-round-half-away-from-zero",
  exactTarget: 10_000,
  rank: "competition-on-quantized-score",
  stableOrder: "score-descending-then-word-id-ascending",
  scoreEncoding: "int16-little-endian",
  rankEncoding: "uint32-little-endian",
  orderEncoding: "uint32-little-endian",
});

const CORPUS_HEADER_BYTES = 64;
const MAX_CORPUS_SEGMENT_BYTES = 32 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

export function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function durableWrite(path, bytes) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  const handle = await open(temporary, "wx");
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, path);
}
export async function installImmutable(path, bytes) {
  try {
    const existing = await readFile(path);
    if (sha256(existing) !== sha256(bytes)) throw new Error(`Immutable output differs: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await durableWrite(path, bytes);
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} hash is invalid`);
}

export async function loadActiveCorpus(corpusDir) {
  const activeBytes = await readFile(join(corpusDir, "active.json"));
  const active = JSON.parse(activeBytes.toString("utf8"));
  if (active.schemaVersion !== 1 || basename(active.manifest) !== active.manifest) throw new Error("Corpus active pointer is invalid");
  assertHash(active.manifestSha256, "Corpus manifest");
  const manifestBytes = await readFile(join(corpusDir, active.manifest));
  if (sha256(manifestBytes) !== active.manifestSha256) throw new Error("Corpus manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const config = manifest.config;
  if (manifest.schemaVersion !== 1 || manifest.complete !== true || manifest.corpusId !== active.corpusId || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(manifest.corpusId) || manifest.semanticSha256 === undefined || config?.format !== "BRV2" || config?.formatVersion !== 2 || config?.vectorEncoding !== "float32-little-endian" || config?.vectorNormalization !== "scaled-L2-float64-then-validated-float32" || config?.idOrder !== "accepted-source-order-u32" || !Number.isSafeInteger(manifest.stats?.accepted) || manifest.stats.accepted < 1 || manifest.stats.accepted > 0xffff_ffff || !Number.isInteger(config.dimensions) || config.dimensions < 1 || config.dimensions > 4_096 || !Number.isInteger(config.segmentEntries) || config.segmentEntries < 1 || config.segmentEntries > 65_536 || !Number.isInteger(config.maxSegmentRawBytes) || config.maxSegmentRawBytes < CORPUS_HEADER_BYTES + 16 || config.maxSegmentRawBytes > MAX_CORPUS_SEGMENT_BYTES || sha256(Buffer.from(stableJson(config))) !== manifest.configHash || !Array.isArray(manifest.segments)) throw new Error("Unsupported or incomplete BRV2 corpus contract");
  assertHash(manifest.semanticSha256, "Semantic inventory");
  return { active, manifest, manifestBytes, manifestSha256: active.manifestSha256 };
}

export async function readCorpusSegment(corpusDir, manifest, segment, expectedFirstId) {
  if (basename(segment.file) !== segment.file || segment.firstId !== expectedFirstId || segment.dimensions !== manifest.config.dimensions || !Number.isInteger(segment.count) || segment.count < 1 || segment.count > manifest.config.segmentEntries || !Number.isInteger(segment.rawBytes) || segment.rawBytes < CORPUS_HEADER_BYTES || segment.rawBytes > Math.min(manifest.config.maxSegmentRawBytes, MAX_CORPUS_SEGMENT_BYTES) || !Number.isInteger(segment.compressedBytes) || segment.compressedBytes < 1 || segment.compressedBytes > manifest.config.maxSegmentRawBytes + 65_536) throw new Error(`Invalid corpus segment range: ${segment.file}`);
  assertHash(segment.objectSha256, "Corpus object"); assertHash(segment.rawSha256, "Corpus raw object");
  const path = join(corpusDir, "segments", segment.file); const info = await stat(path);
  if (info.size !== segment.compressedBytes) throw new Error(`Corpus object size mismatch: ${segment.file}`);
  const compressed = await readFile(path);
  if (sha256(compressed) !== segment.objectSha256) throw new Error(`Corpus object hash mismatch: ${segment.file}`);
  let raw; try { raw = gunzipSync(compressed, { maxOutputLength: Math.min(manifest.config.maxSegmentRawBytes, MAX_CORPUS_SEGMENT_BYTES) }); }
  catch { throw new Error(`Cannot safely decompress corpus segment: ${segment.file}`); }
  if (raw.length !== segment.rawBytes || sha256(raw) !== segment.rawSha256 || raw.toString("ascii", 0, 4) !== "BRV2" || raw.readUInt16LE(4) !== 2 || raw.readUInt16LE(6) !== 1) throw new Error(`Corpus raw object is invalid: ${segment.file}`);
  const dimensions = raw.readUInt32LE(8); const firstId = raw.readUInt32LE(12); const count = raw.readUInt32LE(16);
  const wordsOffset = raw.readUInt32LE(20); const vectorsOffset = raw.readUInt32LE(24); const rawBytes = raw.readUInt32LE(28);
  if (dimensions !== manifest.config.dimensions || firstId !== segment.firstId || count !== segment.count || wordsOffset !== CORPUS_HEADER_BYTES || rawBytes !== raw.length || vectorsOffset > raw.length || vectorsOffset + count * dimensions * 4 !== raw.length || raw.subarray(48, 64).toString("hex") !== manifest.configHash.slice(0, 32)) throw new Error(`Corpus header mismatch: ${segment.file}`);
  const entries = []; let offset = wordsOffset;
  for (let index = 0; index < count; index++) {
    if (offset + 4 > vectorsOffset) throw new Error(`Truncated corpus word table: ${segment.file}`);
    const length = raw.readUInt32LE(offset); offset += 4;
    if (length < 1 || offset + length > vectorsOffset) throw new Error(`Truncated corpus word: ${segment.file}`);
    let word; try { word = decoder.decode(raw.subarray(offset, offset + length)); }
    catch { throw new Error(`Invalid corpus word encoding: ${segment.file}`); }
    offset += length;
    entries.push({ id: firstId + index, word, vector: raw.subarray(vectorsOffset + index * dimensions * 4, vectorsOffset + (index + 1) * dimensions * 4) });
  }
  if (offset > vectorsOffset || vectorsOffset - offset > 3) throw new Error(`Corpus word padding is invalid: ${segment.file}`);
  return entries;
}

export async function* corpusEntries(corpusDir, manifest) {
  let nextId = 0;
  for (let segmentIndex = 0; segmentIndex < manifest.segments.length; segmentIndex++) {
    const segment = manifest.segments[segmentIndex];
    const entries = await readCorpusSegment(corpusDir, manifest, segment, nextId);
    yield { segmentIndex, segment, entries };
    nextId += entries.length;
  }
  if (nextId !== manifest.stats.accepted) throw new Error("Corpus segments do not cover every admitted entry");
}

export function vectorNorm(vector, dimensions) {
  let squared = 0;
  for (let index = 0; index < dimensions; index++) { const value = vector.readFloatLE(index * 4); if (!Number.isFinite(value)) throw new Error("Vector contains a non-finite component"); squared += value * value; }
  const norm = Math.sqrt(squared); if (!(norm > 0) || !Number.isFinite(norm)) throw new Error("Vector norm is invalid"); return norm;
}

export function quantizedCosine(vector, targetVector, dimensions, targetNorm, sameIdentity = false) {
  if (sameIdentity) return SCORE_MAX;
  let dot = 0; let normSquared = 0;
  for (let index = 0; index < dimensions; index++) {
    const value = vector.readFloatLE(index * 4); const target = targetVector.readFloatLE(index * 4);
    if (!Number.isFinite(value) || !Number.isFinite(target)) throw new Error("Vector contains a non-finite component");
    dot += value * target; normSquared += value * value;
  }
  const denominator = Math.sqrt(normSquared) * targetNorm;
  if (!(denominator > 0) || !Number.isFinite(denominator)) throw new Error("Cosine denominator is invalid");
  const scaled = Math.max(-1, Math.min(1, dot / denominator)) * SCORE_MAX;
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, rounded));
}

export function scoreIndex(score) {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) throw new Error("Score is outside the BRT2 range");
  return score - SCORE_MIN;
}

export async function safeUnlink(path) { try { await unlink(path); } catch (error) { if (error?.code !== "ENOENT") throw error; } }

export function acquireTargetCacheGuard(targetsRoot, mode = "exclusive") {
  if (mode !== "exclusive" && mode !== "shared") throw new Error("Target cache guard mode is invalid");
  let database;
  try {
    database = new DatabaseSync(join(targetsRoot, ".cache-guard.sqlite"));
    database.exec("PRAGMA busy_timeout=0;");
    if (mode === "exclusive") database.exec("CREATE TABLE IF NOT EXISTS cache_guard(id INTEGER PRIMARY KEY); BEGIN EXCLUSIVE;");
    else database.exec("BEGIN; SELECT count(*) FROM sqlite_master;");
    return { database, mode, targetsRoot };
  } catch {
    try { database?.close(); } catch {}
    throw new Error(`Another target cache operation owns ${targetsRoot}`);
  }
}

export function releaseTargetCacheGuard(guard) {
  if (!guard) return;
  try { guard.database.exec("ROLLBACK"); } catch {}
  try { guard.database.close(); } catch {}
}

export function assertTargetCacheGuard(guard, targetsRoot) {
  if (!guard || guard.targetsRoot !== targetsRoot || !guard.database || !["shared", "exclusive"].includes(guard.mode)) throw new Error("A matching target cache guard is required");
}
