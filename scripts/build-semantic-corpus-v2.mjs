import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

export const CORPUS_FORMAT = "BRV2";
export const CORPUS_FORMAT_VERSION = 2;
export const FILTER_VERSION = "fr-lexicon-v2";
export const DEFAULT_SEGMENT_ENTRIES = 4_096;
export const DEFAULT_SEGMENT_RAW_BYTES = 8 * 1024 * 1024;
export const DEFAULT_MAX_LINE_BYTES = 64 * 1024;

const HEADER_BYTES = 64;
const MAX_SEGMENT_RAW_BYTES = 32 * 1024 * 1024;
const MAX_SEGMENT_ENTRIES = 65_536;
const MAX_LINE_BYTES = 1024 * 1024;
const TOKEN_PATTERN = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

export class CorpusBuildInterrupted extends Error {
  constructor(message) { super(message); this.name = "CorpusBuildInterrupted"; }
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function durableWrite(path, bytes) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  const handle = await open(temporary, "wx");
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, path);
}
async function installImmutable(path, bytes) {
  try {
    const existing = await readFile(path);
    if (sha256(existing) !== sha256(bytes)) throw new Error(`Immutable output differs: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await durableWrite(path, bytes);
  }
}

async function acquireBuildLock(outputDir, lockPath, metadata, recoverLockOwner) {
  const guardPath = join(outputDir, ".build-lock.sqlite"); let guard;
  try {
    guard = new DatabaseSync(guardPath);
    guard.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS build_guard(id INTEGER PRIMARY KEY);");
  } catch {
    try { guard?.close(); } catch {}
    throw new Error(`Another corpus build or recovery owns ${outputDir}`);
  }
  try {
    let existing = null;
    try { existing = JSON.parse(await readFile(lockPath, "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") throw new Error("Existing build lock is unreadable and must not be removed automatically"); }
    if (existing) {
      if (!recoverLockOwner || existing.owner !== recoverLockOwner || !Number.isSafeInteger(existing.pid) || existing.pid < 1) throw new Error(`Another corpus build owns ${lockPath}`);
      let alive = true;
      try { process.kill(existing.pid, 0); }
      catch (checkError) { if (checkError?.code === "ESRCH") alive = false; else throw checkError; }
      if (alive) throw new Error(`Build lock owner ${recoverLockOwner} is still running`);
    }
    await durableWrite(lockPath, `${JSON.stringify(metadata)}\n`);
    return { guard, owner: metadata.owner };
  } catch (error) {
    try { guard.exec("ROLLBACK"); } catch {}
    try { guard.close(); } catch {}
    throw error;
  }
}

async function releaseBuildLock(lockPath, lock) {
  if (!lock) return;
  try {
    const current = JSON.parse(await readFile(lockPath, "utf8"));
    if (current.owner === lock.owner) await unlink(lockPath);
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  finally {
    try { lock.guard.exec("ROLLBACK"); } catch {}
    try { lock.guard.close(); } catch {}
  }
}

export async function* boundedLines(path, maxLineBytes = DEFAULT_MAX_LINE_BYTES) {
  let fragments = [];
  let length = 0;
  let overflow = false;
  let offset = 0;
  for await (const chunkValue of createReadStream(path, { highWaterMark: 16 * 1024 })) {
    const chunk = Buffer.from(chunkValue);
    let position = 0;
    while (position < chunk.length) {
      const newline = chunk.indexOf(0x0a, position);
      const end = newline === -1 ? chunk.length : newline;
      const part = chunk.subarray(position, end);
      if (!overflow) {
        const projected = length + part.length;
        const lastByte = part.length ? part.at(-1) : fragments.at(-1)?.at(-1);
        const trailingCrAllowance = projected === maxLineBytes + 1 && lastByte === 0x0d;
        if (projected > maxLineBytes && !trailingCrAllowance) { fragments = []; length = 0; overflow = true; }
        else if (part.length) { fragments.push(Buffer.from(part)); length += part.length; }
      }
      offset += part.length;
      position = end;
      if (newline !== -1) {
        offset++;
        if (overflow) yield { tooLong: true, bytes: null, endOffset: offset };
        else {
          let bytes = fragments.length === 1 ? fragments[0] : Buffer.concat(fragments, length);
          if (bytes.at(-1) === 0x0d) bytes = bytes.subarray(0, bytes.length - 1);
          yield { tooLong: false, bytes, endOffset: offset };
        }
        fragments = []; length = 0; overflow = false; position++;
      }
    }
  }
  if (overflow) yield { tooLong: true, bytes: null, endOffset: offset };
  else if (length) {
    let bytes = fragments.length === 1 ? fragments[0] : Buffer.concat(fragments, length);
    if (bytes.at(-1) === 0x0d) bytes = bytes.subarray(0, bytes.length - 1);
    yield { tooLong: false, bytes, endOffset: offset };
  }
}

export function canonicalizeWord(value) {
  return value.trim().toLocaleLowerCase("fr").normalize("NFC").replaceAll("’", "'");
}

function parseHeader(bytes) {
  let text;
  try { text = decoder.decode(bytes); }
  catch { throw new Error("Source header is not valid UTF-8"); }
  const match = /^(\d+)\s+(\d+)$/.exec(text.trim());
  if (!match) throw new Error("Source header must contain exactly row and dimension counts");
  const rows = Number(match[1]); const dimensions = Number(match[2]);
  if (!Number.isSafeInteger(rows) || rows < 1 || rows > 0xffff_ffff) throw new Error("Source row count is outside BRV2 limits");
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 4_096) throw new Error("Source dimension count is outside BRV2 limits");
  return { rows, dimensions };
}

function parseVectorLine(bytes, dimensions) {
  let text;
  try { text = decoder.decode(bytes); }
  catch { return { excluded: "invalid_utf8" }; }
  const separator = text.search(/\s/u);
  if (separator <= 0) return { excluded: "malformed" };
  const word = canonicalizeWord(text.slice(0, separator));
  if (word.length < 2 || !TOKEN_PATTERN.test(word)) return { excluded: "non_lexical" };
  const values = text.slice(separator).trim().split(/\s+/u);
  if (values.length !== dimensions) return { excluded: "dimension_mismatch" };
  const numbers = new Float64Array(dimensions);
  let scale = 0;
  for (let index = 0; index < dimensions; index++) {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) return { excluded: "non_finite" };
    numbers[index] = value; scale = Math.max(scale, Math.abs(value));
  }
  if (scale === 0) return { excluded: "zero_norm" };
  let scaledNormSquared = 0;
  for (const value of numbers) { const scaled = value / scale; scaledNormSquared += scaled * scaled; }
  const scaledNorm = Math.sqrt(scaledNormSquared);
  const vector = Buffer.allocUnsafe(dimensions * 4);
  let storedNormSquared = 0;
  for (let index = 0; index < dimensions; index++) {
    const value = numbers[index] / scale / scaledNorm;
    vector.writeFloatLE(value, index * 4); const stored = vector.readFloatLE(index * 4);
    if (!Number.isFinite(stored)) return { excluded: "non_finite" };
    storedNormSquared += stored * stored;
  }
  if (Math.abs(storedNormSquared - 1) > 0.000_01) return { excluded: "non_finite" };
  return { word, vector };
}

function rawSegmentSize(entries, dimensions) {
  const wordsBytes = entries.reduce((total, entry) => total + 4 + Buffer.byteLength(entry.word), 0);
  return rawSegmentSizeFrom(entries.length, wordsBytes, dimensions);
}

function rawSegmentSizeFrom(entryCount, wordsBytes, dimensions) {
  const vectorsOffset = HEADER_BYTES + wordsBytes + ((4 - (wordsBytes % 4)) % 4);
  return vectorsOffset + entryCount * dimensions * 4;
}

function buildSegment(entries, dimensions, configHash) {
  const wordsBytes = entries.reduce((total, entry) => total + 4 + Buffer.byteLength(entry.word), 0);
  const vectorsOffset = HEADER_BYTES + wordsBytes + ((4 - (wordsBytes % 4)) % 4);
  const raw = Buffer.alloc(vectorsOffset + entries.length * dimensions * 4);
  raw.write(CORPUS_FORMAT, 0, 4, "ascii");
  raw.writeUInt16LE(CORPUS_FORMAT_VERSION, 4);
  raw.writeUInt16LE(0b1, 6);
  raw.writeUInt32LE(dimensions, 8);
  raw.writeUInt32LE(entries[0].id, 12);
  raw.writeUInt32LE(entries.length, 16);
  raw.writeUInt32LE(HEADER_BYTES, 20);
  raw.writeUInt32LE(vectorsOffset, 24);
  raw.writeUInt32LE(raw.length, 28);
  raw.writeBigUInt64LE(BigInt(entries[0].sourceRow), 32);
  raw.writeBigUInt64LE(BigInt(entries.at(-1).sourceRow), 40);
  Buffer.from(configHash.slice(0, 32), "hex").copy(raw, 48);
  let wordOffset = HEADER_BYTES;
  for (const entry of entries) {
    const word = Buffer.from(entry.word);
    raw.writeUInt32LE(word.length, wordOffset); wordOffset += 4;
    word.copy(raw, wordOffset); wordOffset += word.length;
  }
  let vectorOffset = vectorsOffset;
  for (const entry of entries) { entry.vector.copy(raw, vectorOffset); vectorOffset += entry.vector.length; }
  return raw;
}

function parseSegmentWords(raw, expected) {
  if (raw.length < HEADER_BYTES || raw.toString("ascii", 0, 4) !== CORPUS_FORMAT) throw new Error(`Invalid segment magic: ${expected.file}`);
  const version = raw.readUInt16LE(4); const dimensions = raw.readUInt32LE(8); const firstId = raw.readUInt32LE(12); const count = raw.readUInt32LE(16);
  const wordsOffset = raw.readUInt32LE(20); const vectorsOffset = raw.readUInt32LE(24); const rawBytes = raw.readUInt32LE(28);
  if (version !== CORPUS_FORMAT_VERSION || dimensions !== expected.dimensions || firstId !== expected.firstId || count !== expected.count || wordsOffset !== HEADER_BYTES || rawBytes !== raw.length || vectorsOffset > raw.length || vectorsOffset + count * dimensions * 4 !== raw.length || Number(raw.readBigUInt64LE(32)) !== expected.firstSourceRow || Number(raw.readBigUInt64LE(40)) !== expected.lastSourceRow || (expected.configHash && raw.subarray(48, 64).toString("hex") !== expected.configHash.slice(0, 32))) throw new Error(`Invalid segment header: ${expected.file}`);
  const words = []; let offset = wordsOffset;
  for (let index = 0; index < count; index++) {
    if (offset + 4 > vectorsOffset) throw new Error(`Truncated word table: ${expected.file}`);
    const length = raw.readUInt32LE(offset); offset += 4;
    if (offset + length > vectorsOffset) throw new Error(`Truncated word: ${expected.file}`);
    let word; try { word = decoder.decode(raw.subarray(offset, offset + length)); }
    catch { throw new Error(`Invalid word UTF-8: ${expected.file}`); }
    words.push(word); offset += length;
  }
  return words;
}

async function boundedGunzip(outputDir, segment, maxSegmentRawBytes) {
  if (basename(segment.file) !== segment.file || !/^[0-9a-f]{64}$/.test(segment.objectSha256) || !/^[0-9a-f]{64}$/.test(segment.rawSha256) || !Number.isInteger(segment.compressedBytes) || segment.compressedBytes < 1 || segment.compressedBytes > maxSegmentRawBytes + 64 * 1024 || !Number.isInteger(segment.rawBytes) || segment.rawBytes < HEADER_BYTES || segment.rawBytes > maxSegmentRawBytes) throw new Error(`Segment sizes exceed configured bounds: ${segment.file}`);
  const path = join(outputDir, "segments", segment.file); const info = await stat(path);
  if (info.size !== segment.compressedBytes) throw new Error(`Segment object size mismatch: ${segment.file}`);
  const compressed = await readFile(path);
  if (sha256(compressed) !== segment.objectSha256) throw new Error(`Checkpoint segment object is corrupt: ${segment.file}`);
  let raw; try { raw = gzipDecompress(compressed, maxSegmentRawBytes); }
  catch (error) { throw new Error(`Cannot safely decompress ${segment.file}: ${error.message}`); }
  if (raw.length !== segment.rawBytes || sha256(raw) !== segment.rawSha256) throw new Error(`Checkpoint segment payload is corrupt: ${segment.file}`);
  return raw;
}

function gzipDecompress(compressed, maxOutputLength) {
  return gunzipSync(compressed, { maxOutputLength });
}

async function verifyCheckpoint(outputDir, checkpoint, config, configHash, sourceSha256, sourceBytes, header, database) {
  const exclusionKeys = Object.keys(defaultExcluded());
  const countersValid = checkpoint.excluded && Object.keys(checkpoint.excluded).sort().join("|") === [...exclusionKeys].sort().join("|") && exclusionKeys.every(key => Number.isSafeInteger(checkpoint.excluded[key]) && checkpoint.excluded[key] >= 0);
  if (checkpoint.schemaVersion !== 1 || checkpoint.complete !== false || checkpoint.sourceSha256 !== sourceSha256 || checkpoint.sourceBytes !== sourceBytes || checkpoint.configHash !== configHash || stableJson(checkpoint.config) !== stableJson(config) || checkpoint.dimensions !== header.dimensions || checkpoint.headerRows !== header.rows || !Number.isSafeInteger(checkpoint.rowsSeen) || checkpoint.rowsSeen < 0 || checkpoint.rowsSeen > header.rows || !Number.isSafeInteger(checkpoint.accepted) || checkpoint.accepted < 0 || checkpoint.accepted !== checkpoint.nextWordId || !Number.isSafeInteger(checkpoint.sourceOffset) || checkpoint.sourceOffset < 0 || checkpoint.sourceOffset > sourceBytes || !Array.isArray(checkpoint.segments) || !countersValid || checkpoint.rowsSeen !== checkpoint.accepted + exclusionKeys.reduce((sum, key) => sum + checkpoint.excluded[key], 0)) throw new Error("Checkpoint does not match source or configuration");
  let expectedId = 0;
  const insert = database.prepare("INSERT INTO words(word, id) VALUES (?, ?)");
  for (const segment of checkpoint.segments) {
    if (segment.firstId !== expectedId || segment.dimensions !== header.dimensions || !Number.isSafeInteger(segment.count) || segment.count < 1 || segment.count > config.segmentEntries || !Number.isSafeInteger(segment.firstSourceRow) || !Number.isSafeInteger(segment.lastSourceRow) || segment.firstSourceRow <= 0 || segment.lastSourceRow < segment.firstSourceRow || segment.lastSourceRow > checkpoint.rowsSeen) throw new Error(`Checkpoint segment range is invalid: ${segment.file}`);
    const raw = await boundedGunzip(outputDir, segment, config.maxSegmentRawBytes);
    const words = parseSegmentWords(raw, { ...segment, configHash });
    database.exec("BEGIN");
    try { words.forEach((word, index) => insert.run(word, segment.firstId + index)); database.exec("COMMIT"); }
    catch (error) { database.exec("ROLLBACK"); throw new Error(`Duplicate or invalid checkpoint word in ${segment.file}: ${error.message}`); }
    expectedId += segment.count;
  }
  if (expectedId !== checkpoint.nextWordId || (checkpoint.segments.length && checkpoint.segments.at(-1).lastSourceRow > checkpoint.rowsSeen)) throw new Error("Checkpoint counters are inconsistent");
}

function defaultExcluded() {
  return { malformed: 0, invalid_utf8: 0, line_too_long: 0, non_lexical: 0, dimension_mismatch: 0, non_finite: 0, zero_norm: 0, duplicate: 0 };
}

/**
 * @param {{
 *   sourcePath: string,
 *   outputDir: string,
 *   segmentEntries?: number,
 *   maxSegmentRawBytes?: number,
 *   maxLineBytes?: number,
 *   provenance?: string,
 *   license?: string,
 *   testStopAfterSegments?: number | null,
 *   testStopAfterSegmentWrite?: number | null,
 *   recoverLockOwner?: string | null,
 *   testHoldAfterLockMs?: number,
 * }} options
 */
export async function buildSemanticCorpus({
  sourcePath,
  outputDir,
  segmentEntries = DEFAULT_SEGMENT_ENTRIES,
  maxSegmentRawBytes = DEFAULT_SEGMENT_RAW_BYTES,
  maxLineBytes = DEFAULT_MAX_LINE_BYTES,
  provenance = "fastText Wikipedia French vectors",
  license = "CC BY-SA 3.0",
  testStopAfterSegments = null,
  testStopAfterSegmentWrite = null,
  recoverLockOwner = null,
  testHoldAfterLockMs = 0,
}) {
  sourcePath = resolve(sourcePath); outputDir = resolve(outputDir);
  if (!Number.isInteger(segmentEntries) || segmentEntries < 1) throw new Error("segmentEntries must be a positive integer");
  if (segmentEntries > MAX_SEGMENT_ENTRIES) throw new Error(`segmentEntries cannot exceed ${MAX_SEGMENT_ENTRIES}`);
  if (!Number.isInteger(maxSegmentRawBytes) || maxSegmentRawBytes < HEADER_BYTES + 16) throw new Error("maxSegmentRawBytes is too small");
  if (maxSegmentRawBytes > MAX_SEGMENT_RAW_BYTES) throw new Error(`maxSegmentRawBytes cannot exceed ${MAX_SEGMENT_RAW_BYTES}`);
  if (!Number.isInteger(maxLineBytes) || maxLineBytes < 32) throw new Error("maxLineBytes is too small");
  if (maxLineBytes > MAX_LINE_BYTES) throw new Error(`maxLineBytes cannot exceed ${MAX_LINE_BYTES}`);
  await mkdir(outputDir, { recursive: true }); await mkdir(join(outputDir, "segments"), { recursive: true });
  const lockPath = join(outputDir, ".build.lock");
  const lockOwner = randomUUID();
  let lock = await acquireBuildLock(outputDir, lockPath, { schemaVersion: 1, owner: lockOwner, pid: process.pid, createdAt: new Date().toISOString(), sourcePath, outputDir }, recoverLockOwner);
  const databasePath = join(outputDir, ".dedupe.sqlite");
  let database; let iterator;
  try {
    if (testHoldAfterLockMs > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, testHoldAfterLockMs));
    const sourceInfoBefore = await stat(sourcePath);
    const sourceSha256 = await sha256File(sourcePath);
    const headerIterator = boundedLines(sourcePath, maxLineBytes)[Symbol.asyncIterator]();
    const first = await headerIterator.next(); await headerIterator.return?.();
    if (first.done || first.value.tooLong || !first.value.bytes) throw new Error("Missing or oversized source header");
    const header = parseHeader(first.value.bytes);
    const config = {
      schemaVersion: 1, format: CORPUS_FORMAT, formatVersion: CORPUS_FORMAT_VERSION, filterVersion: FILTER_VERSION,
      canonicalization: "trim-lowercase-fr-NFC-smart-apostrophe", tokenPattern: TOKEN_PATTERN.source,
      duplicatePolicy: "first-valid-source-row", vectorEncoding: "float32-little-endian",
      vectorNormalization: "scaled-L2-float64-then-validated-float32", idOrder: "accepted-source-order-u32",
      dimensions: header.dimensions, segmentEntries, maxSegmentRawBytes, maxLineBytes, provenance, license,
    };
    const configHash = sha256(stableJson(config));
    let checkpoint;
    try { checkpoint = JSON.parse(await readFile(join(outputDir, "checkpoint.json"), "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") throw new Error(`Cannot read checkpoint: ${error.message}`); }
    if (checkpoint?.complete === true) {
      if (checkpoint.sourceSha256 !== sourceSha256 || checkpoint.configHash !== configHash || checkpoint.sourceBytes !== sourceInfoBefore.size || checkpoint.headerRows !== header.rows || checkpoint.dimensions !== header.dimensions) throw new Error("Completed corpus does not match source or configuration");
      const active = JSON.parse(await readFile(join(outputDir, "active.json"), "utf8"));
      const manifestBytes = await readFile(join(outputDir, active.manifest));
      if (sha256(manifestBytes) !== active.manifestSha256 || active.manifestSha256 !== checkpoint.manifestSha256) throw new Error("Completed corpus manifest is corrupt");
      const manifest = JSON.parse(manifestBytes.toString("utf8"));
      const { verifySemanticCorpus } = await import("./verify-semantic-corpus-v2.mjs");
      const verified = await verifySemanticCorpus({ sourcePath, outputDir });
      if (verified.semanticSha256 !== manifest.semanticSha256) throw new Error("Completed corpus semantic inventory is corrupt");
      return manifest;
    }
    await rm(databasePath, { force: true });
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE words(word TEXT PRIMARY KEY, id INTEGER NOT NULL UNIQUE) WITHOUT ROWID;");
    if (checkpoint) await verifyCheckpoint(outputDir, checkpoint, config, configHash, sourceSha256, sourceInfoBefore.size, header, database);
    else checkpoint = { schemaVersion: 1, complete: false, sourceSha256, sourceBytes: sourceInfoBefore.size, config, configHash, headerRows: header.rows, dimensions: header.dimensions, rowsSeen: 0, accepted: 0, excluded: defaultExcluded(), nextWordId: 0, sourceOffset: first.value.endOffset, segments: [] };
    const semanticHash = createHash("sha256");
    for (const segment of checkpoint.segments) {
      const raw = await boundedGunzip(outputDir, segment, maxSegmentRawBytes);
      const words = parseSegmentWords(raw, { ...segment, configHash }); const vectorsOffset = raw.readUInt32LE(24);
      words.forEach((word, index) => {
        const wordBytes = Buffer.from(word); const length = Buffer.alloc(4); length.writeUInt32LE(wordBytes.length);
        semanticHash.update(length).update(wordBytes).update(raw.subarray(vectorsOffset + index * header.dimensions * 4, vectorsOffset + (index + 1) * header.dimensions * 4));
      });
    }
    const insert = database.prepare("INSERT OR IGNORE INTO words(word, id) VALUES (?, ?)");
    iterator = boundedLines(sourcePath, maxLineBytes)[Symbol.asyncIterator]();
    const repeatedHeader = await iterator.next();
    if (repeatedHeader.done || repeatedHeader.value.tooLong || repeatedHeader.value.endOffset !== first.value.endOffset) throw new Error("Source header changed before ingestion");
    let pending = []; let pendingWordsBytes = 0;
    const flush = async sourceRow => {
      if (!pending.length) return;
      const raw = buildSegment(pending, header.dimensions, configHash);
      if (raw.length > maxSegmentRawBytes) throw new Error("Segment exceeds configured raw byte budget");
      const compressed = gzipSync(raw, { level: 9 });
      const rawSha256 = sha256(raw); const objectSha256 = sha256(compressed);
      const file = `${String(checkpoint.segments.length).padStart(6, "0")}-${objectSha256.slice(0, 16)}.brv.gz`;
      await installImmutable(join(outputDir, "segments", file), compressed);
      if (testStopAfterSegmentWrite === checkpoint.segments.length + 1) throw new CorpusBuildInterrupted("Test interruption after immutable segment write");
      const segment = { file, dimensions: header.dimensions, firstId: pending[0].id, count: pending.length, firstSourceRow: pending[0].sourceRow, lastSourceRow: pending.at(-1).sourceRow, rawBytes: raw.length, compressedBytes: compressed.length, rawSha256, objectSha256 };
      checkpoint.segments.push(segment); checkpoint.rowsSeen = sourceRow; checkpoint.nextWordId = checkpoint.accepted;
      await durableWrite(join(outputDir, "checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
      pending = []; pendingWordsBytes = 0;
      if (testStopAfterSegments === checkpoint.segments.length) throw new CorpusBuildInterrupted("Test interruption after checkpoint");
    };
    let sourceRow = 0;
    while (true) {
      const next = await iterator.next(); if (next.done) break;
      sourceRow++;
      if (sourceRow <= checkpoint.rowsSeen) {
        if (sourceRow === checkpoint.rowsSeen && next.value.endOffset !== checkpoint.sourceOffset) throw new Error("Checkpoint source offset is inconsistent");
        continue;
      }
      if (sourceRow > header.rows) throw new Error(`Source contains more rows than header (${header.rows})`);
      let parsed;
      if (next.value.tooLong) parsed = { excluded: "line_too_long" };
      else parsed = parseVectorLine(next.value.bytes, header.dimensions);
      if (parsed.excluded) checkpoint.excluded[parsed.excluded]++;
      else {
        const result = insert.run(parsed.word, checkpoint.accepted);
        if (result.changes === 0) checkpoint.excluded.duplicate++;
        else {
          const entry = { id: checkpoint.accepted, sourceRow, word: parsed.word, vector: parsed.vector };
          const entryWordsBytes = 4 + Buffer.byteLength(entry.word);
          if (pending.length && (pending.length >= segmentEntries || rawSegmentSizeFrom(pending.length + 1, pendingWordsBytes + entryWordsBytes, header.dimensions) > maxSegmentRawBytes)) await flush(sourceRow - 1);
          if (rawSegmentSize([entry], header.dimensions) > maxSegmentRawBytes) throw new Error(`Single entry exceeds segment byte budget at source row ${sourceRow}`);
          pending.push(entry); pendingWordsBytes += entryWordsBytes; checkpoint.accepted++; checkpoint.nextWordId = checkpoint.accepted;
          const wordBytes = Buffer.from(entry.word); const length = Buffer.alloc(4); length.writeUInt32LE(wordBytes.length);
          semanticHash.update(length).update(wordBytes).update(entry.vector);
        }
      }
      checkpoint.rowsSeen = sourceRow; checkpoint.sourceOffset = next.value.endOffset;
    }
    if (sourceRow !== header.rows) throw new Error(`Source row count mismatch: header=${header.rows}, read=${sourceRow}`);
    await flush(sourceRow);
    if (checkpoint.accepted + Object.values(checkpoint.excluded).reduce((sum, value) => sum + value, 0) !== header.rows) throw new Error("Final admission counters do not cover every source row");
    const sourceInfoAfter = await stat(sourcePath); const sourceShaAfter = await sha256File(sourcePath);
    if (sourceInfoAfter.size !== sourceInfoBefore.size || sourceShaAfter !== sourceSha256) throw new Error("Source changed during ingestion");
    const activeName = `manifest-${configHash.slice(0, 16)}-${sourceSha256.slice(0, 16)}.json`;
    const manifest = {
      schemaVersion: 1, complete: true, corpusId: `fr-fasttext-complete-${sourceSha256.slice(0, 12)}-${configHash.slice(0, 12)}`,
      source: { path: basename(sourcePath), sha256: sourceSha256, bytes: sourceInfoBefore.size, declaredRows: header.rows, dimensions: header.dimensions, provenance, license },
      config, configHash, stats: { rowsRead: header.rows, accepted: checkpoint.accepted, excluded: checkpoint.excluded, segmentCount: checkpoint.segments.length },
      semanticSha256: semanticHash.digest("hex"), segments: checkpoint.segments,
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`); const manifestSha256 = sha256(manifestBytes);
    await installImmutable(join(outputDir, activeName), manifestBytes);
    const { verifySemanticCorpus } = await import("./verify-semantic-corpus-v2.mjs");
    const verified = await verifySemanticCorpus({ sourcePath, outputDir, manifestName: activeName, expectedManifestSha256: manifestSha256 });
    if (verified.semanticSha256 !== manifest.semanticSha256 || verified.accepted !== manifest.stats.accepted) throw new Error("Independent corpus verification did not match the candidate manifest");
    await durableWrite(join(outputDir, "active.json"), `${JSON.stringify({ schemaVersion: 1, manifest: activeName, manifestSha256, corpusId: manifest.corpusId }, null, 2)}\n`);
    checkpoint.complete = true; checkpoint.manifest = activeName; checkpoint.manifestSha256 = manifestSha256; checkpoint.semanticSha256 = manifest.semanticSha256;
    await durableWrite(join(outputDir, "checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
    return manifest;
  } finally {
    await iterator?.return?.().catch(() => {});
    try { database?.close(); } catch {}
    await releaseBuildLock(lockPath, lock);
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("Usage: --source FILE --output DIR [--segment-entries N] [--max-segment-bytes N] [--max-line-bytes N] [--recover-lock-owner ID]");
    options[key.slice(2)] = value;
  }
  if (!options.source || !options.output) throw new Error("Both --source and --output are required");
  return { sourcePath: options.source, outputDir: options.output, ...(options["segment-entries"] ? { segmentEntries: Number(options["segment-entries"]) } : {}), ...(options["max-segment-bytes"] ? { maxSegmentRawBytes: Number(options["max-segment-bytes"]) } : {}), ...(options["max-line-bytes"] ? { maxLineBytes: Number(options["max-line-bytes"]) } : {}), ...(options["recover-lock-owner"] ? { recoverLockOwner: options["recover-lock-owner"] } : {}), ...(process.env.BRAISE_TEST_HOLD_AFTER_LOCK_MS ? { testHoldAfterLockMs: Number(process.env.BRAISE_TEST_HOLD_AFTER_LOCK_MS) } : {}) };
}

if (process.argv[1] && basename(process.argv[1]) === "build-semantic-corpus-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSemanticCorpus(parseArgs(process.argv.slice(2))).then(manifest => console.log(JSON.stringify({ corpusId: manifest.corpusId, rowsRead: manifest.stats.rowsRead, accepted: manifest.stats.accepted, excluded: manifest.stats.excluded, segments: manifest.stats.segmentCount, semanticSha256: manifest.semanticSha256 }))).catch(error => { console.error(error.message); process.exitCode = error instanceof CorpusBuildInterrupted ? 75 : 1; });
}
