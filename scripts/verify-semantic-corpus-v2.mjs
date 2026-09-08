import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const HEADER_BYTES = 64;
const MAGIC = "BRV2";
const VERSION = 2;
const MAX_SEGMENT_RAW_BYTES = 32 * 1024 * 1024;
const MAX_SEGMENT_ENTRIES = 65_536;
const MAX_LINE_BYTES = 1024 * 1024;
const TOKEN_PATTERN = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function sha256File(path) { const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest("hex"); }
function canonicalize(value) { return value.trim().toLocaleLowerCase("fr").normalize("NFC").replaceAll("’", "'"); }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function* verifyLines(path, maxLineBytes) {
  let parts = []; let size = 0; let overflow = false;
  for await (const value of createReadStream(path, { highWaterMark: 7 * 1024 })) {
    const chunk = Buffer.from(value); let cursor = 0;
    while (cursor < chunk.length) {
      const newline = chunk.indexOf(0x0a, cursor); const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(cursor, end);
      const projected = size + part.length; const lastByte = part.length ? part.at(-1) : parts.at(-1)?.at(-1);
      const trailingCrAllowance = projected === maxLineBytes + 1 && lastByte === 0x0d;
      if (!overflow && (projected <= maxLineBytes || trailingCrAllowance)) { if (part.length) parts.push(Buffer.from(part)); size += part.length; }
      else { overflow = true; parts = []; size = 0; }
      cursor = end;
      if (newline >= 0) {
        let bytes = overflow ? null : parts.length === 1 ? parts[0] : Buffer.concat(parts, size);
        if (bytes?.at(-1) === 0x0d) bytes = bytes.subarray(0, bytes.length - 1);
        yield { bytes, tooLong: overflow };
        parts = []; size = 0; overflow = false; cursor++;
      }
    }
  }
  if (overflow || size) {
    let bytes = overflow ? null : parts.length === 1 ? parts[0] : Buffer.concat(parts, size);
    if (bytes?.at(-1) === 0x0d) bytes = bytes.subarray(0, bytes.length - 1);
    yield { bytes, tooLong: overflow };
  }
}

function sourceHeader(bytes) {
  let text; try { text = decoder.decode(bytes); } catch { throw new Error("Source header is not valid UTF-8"); }
  const match = /^(\d+)\s+(\d+)$/.exec(text.trim());
  if (!match) throw new Error("Invalid source header");
  return { rows: Number(match[1]), dimensions: Number(match[2]) };
}

function sourceEntry(bytes, dimensions) {
  let text; try { text = decoder.decode(bytes); } catch { return { excluded: "invalid_utf8" }; }
  const split = text.search(/\s/u); if (split <= 0) return { excluded: "malformed" };
  const word = canonicalize(text.slice(0, split));
  if (word.length < 2 || !TOKEN_PATTERN.test(word)) return { excluded: "non_lexical" };
  const parts = text.slice(split).trim().split(/\s+/u); if (parts.length !== dimensions) return { excluded: "dimension_mismatch" };
  const values = parts.map(Number); if (values.some(value => !Number.isFinite(value))) return { excluded: "non_finite" };
  const scale = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  if (scale === 0) return { excluded: "zero_norm" };
  const scaledNorm = Math.sqrt(values.reduce((total, value) => { const scaled = value / scale; return total + scaled * scaled; }, 0));
  const vector = Buffer.allocUnsafe(dimensions * 4); let storedNormSquared = 0;
  values.forEach((value, index) => { vector.writeFloatLE(value / scale / scaledNorm, index * 4); const stored = vector.readFloatLE(index * 4); storedNormSquared += stored * stored; });
  if (Math.abs(storedNormSquared - 1) > 0.000_01) return { excluded: "non_finite" };
  return { word, vector };
}

async function* segmentEntries(outputDir, manifest, semanticHash) {
  let nextId = 0; let previousSourceRow = 0;
  for (const segment of manifest.segments) {
    if (basename(segment.file) !== segment.file || !/^[0-9a-f]{64}$/.test(segment.objectSha256) || !/^[0-9a-f]{64}$/.test(segment.rawSha256) || segment.firstId !== nextId || segment.dimensions !== manifest.source.dimensions || !Number.isSafeInteger(segment.count) || segment.count < 1 || segment.count > manifest.config.segmentEntries || segment.rawBytes < HEADER_BYTES || segment.rawBytes > manifest.config.maxSegmentRawBytes || segment.compressedBytes < 1 || segment.compressedBytes > manifest.config.maxSegmentRawBytes + 64 * 1024) throw new Error(`Invalid manifest range for ${segment.file}`);
    const segmentPath = join(outputDir, "segments", segment.file); const segmentInfo = await stat(segmentPath);
    if (segmentInfo.size !== segment.compressedBytes) throw new Error(`Stored size mismatch for ${segment.file}`);
    const compressed = await readFile(segmentPath);
    if (compressed.length !== segment.compressedBytes || sha256(compressed) !== segment.objectSha256) throw new Error(`Stored hash mismatch for ${segment.file}`);
    let raw; try { raw = gunzipSync(compressed, { maxOutputLength: manifest.config.maxSegmentRawBytes }); } catch { throw new Error(`Cannot safely decompress ${segment.file}`); }
    if (raw.length !== segment.rawBytes || sha256(raw) !== segment.rawSha256) throw new Error(`Raw hash mismatch for ${segment.file}`);
    if (raw.length < HEADER_BYTES || raw.toString("ascii", 0, 4) !== MAGIC || raw.readUInt16LE(4) !== VERSION || raw.readUInt16LE(6) !== 1) throw new Error(`Invalid BRV2 header for ${segment.file}`);
    const dimensions = raw.readUInt32LE(8); const firstId = raw.readUInt32LE(12); const count = raw.readUInt32LE(16);
    const wordsOffset = raw.readUInt32LE(20); const vectorsOffset = raw.readUInt32LE(24); const rawBytes = raw.readUInt32LE(28);
    const firstSourceRow = Number(raw.readBigUInt64LE(32)); const lastSourceRow = Number(raw.readBigUInt64LE(40));
    const configPrefix = raw.subarray(48, 64).toString("hex");
    if (dimensions !== segment.dimensions || firstId !== segment.firstId || count !== segment.count || wordsOffset !== HEADER_BYTES || rawBytes !== raw.length || vectorsOffset > raw.length || vectorsOffset + count * dimensions * 4 !== raw.length || firstSourceRow !== segment.firstSourceRow || lastSourceRow !== segment.lastSourceRow || configPrefix !== manifest.configHash.slice(0, 32) || firstSourceRow <= previousSourceRow || lastSourceRow < firstSourceRow) throw new Error(`Header contract mismatch for ${segment.file}`);
    let offset = wordsOffset;
    for (let index = 0; index < count; index++) {
      if (offset + 4 > vectorsOffset) throw new Error(`Truncated word table in ${segment.file}`);
      const length = raw.readUInt32LE(offset); offset += 4;
      if (length < 1 || offset + length > vectorsOffset) throw new Error(`Truncated word in ${segment.file}`);
      let word; try { word = decoder.decode(raw.subarray(offset, offset + length)); } catch { throw new Error(`Invalid word UTF-8 in ${segment.file}`); }
      if (canonicalize(word) !== word || !TOKEN_PATTERN.test(word)) throw new Error(`Non-canonical word in ${segment.file}`);
      offset += length;
      const vector = raw.subarray(vectorsOffset + index * dimensions * 4, vectorsOffset + (index + 1) * dimensions * 4);
      let norm = 0;
      for (let component = 0; component < dimensions; component++) { const value = vector.readFloatLE(component * 4); if (!Number.isFinite(value)) throw new Error(`Non-finite vector in ${segment.file}`); norm += value * value; }
      if (Math.abs(norm - 1) > 0.000_01) throw new Error(`Non-normalized vector in ${segment.file}`);
      const wordBytes = Buffer.from(word); const lengthBytes = Buffer.alloc(4); lengthBytes.writeUInt32LE(wordBytes.length);
      semanticHash.update(lengthBytes).update(wordBytes).update(vector);
      yield { id: firstId + index, word, vector };
    }
    if (offset > vectorsOffset || vectorsOffset - offset > 3) throw new Error(`Invalid word padding in ${segment.file}`);
    nextId += count; previousSourceRow = lastSourceRow;
  }
  if (nextId !== manifest.stats.accepted) throw new Error("Segment entries do not match accepted count");
}

/** @param {{sourcePath: string, outputDir: string, manifestName?: string | null, expectedManifestSha256?: string | null}} options */
export async function verifySemanticCorpus({ sourcePath, outputDir, manifestName = null, expectedManifestSha256 = null }) {
  sourcePath = resolve(sourcePath); outputDir = resolve(outputDir);
  let active = null;
  if (!manifestName) { const activeBytes = await readFile(join(outputDir, "active.json")); active = JSON.parse(activeBytes.toString("utf8")); manifestName = active.manifest; expectedManifestSha256 = active.manifestSha256; }
  if (basename(manifestName) !== manifestName) throw new Error("Manifest path is invalid");
  const manifestBytes = await readFile(join(outputDir, manifestName)); const actualManifestSha256 = sha256(manifestBytes);
  if (actualManifestSha256 !== expectedManifestSha256) throw new Error("Manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const expectedExclusions = ["malformed", "invalid_utf8", "line_too_long", "non_lexical", "dimension_mismatch", "non_finite", "zero_norm", "duplicate"];
  if (manifest.complete !== true || manifest.schemaVersion !== 1 || (active && active.corpusId !== manifest.corpusId) || !/^[0-9a-f]{64}$/.test(manifest.configHash) || sha256(stableJson(manifest.config)) !== manifest.configHash || manifest.config.format !== MAGIC || manifest.config.formatVersion !== VERSION || manifest.config.dimensions !== manifest.source.dimensions || !Number.isSafeInteger(manifest.config.segmentEntries) || manifest.config.segmentEntries < 1 || manifest.config.segmentEntries > MAX_SEGMENT_ENTRIES || !Number.isSafeInteger(manifest.config.maxSegmentRawBytes) || manifest.config.maxSegmentRawBytes < HEADER_BYTES + 16 || manifest.config.maxSegmentRawBytes > MAX_SEGMENT_RAW_BYTES || !Number.isSafeInteger(manifest.config.maxLineBytes) || manifest.config.maxLineBytes < 32 || manifest.config.maxLineBytes > MAX_LINE_BYTES || !Array.isArray(manifest.segments) || Object.keys(manifest.stats.excluded).sort().join("|") !== [...expectedExclusions].sort().join("|") || !expectedExclusions.every(key => Number.isSafeInteger(manifest.stats.excluded[key]) && manifest.stats.excluded[key] >= 0)) throw new Error("Manifest is incomplete or inconsistent");
  const sourceInfo = await stat(sourcePath); const actualSourceSha256 = await sha256File(sourcePath);
  if (sourceInfo.size !== manifest.source.bytes || actualSourceSha256 !== manifest.source.sha256) throw new Error("Source does not match active manifest");
  const semanticHash = createHash("sha256");
  const entries = segmentEntries(outputDir, manifest, semanticHash)[Symbol.asyncIterator]();
  const databasePath = join(outputDir, `.verify-${randomUUID()}.sqlite`); let database; let lines;
  const excluded = Object.fromEntries(Object.keys(manifest.stats.excluded).map(key => [key, 0]));
  let rowsRead = 0; let accepted = 0;
  try {
    database = new DatabaseSync(databasePath);
    database.exec("CREATE TABLE words(word TEXT PRIMARY KEY) WITHOUT ROWID;"); const insert = database.prepare("INSERT OR IGNORE INTO words(word) VALUES (?)");
    lines = verifyLines(sourcePath, manifest.config.maxLineBytes)[Symbol.asyncIterator]();
    const headerLine = await lines.next(); if (headerLine.done || headerLine.value.tooLong || !headerLine.value.bytes) throw new Error("Missing source header");
    const header = sourceHeader(headerLine.value.bytes);
    if (header.rows !== manifest.source.declaredRows || header.dimensions !== manifest.source.dimensions) throw new Error("Source header does not match manifest");
    while (true) {
      const line = await lines.next(); if (line.done) break; rowsRead++;
      if (rowsRead > header.rows) throw new Error("Source contains rows beyond its header");
      let parsed = line.value.tooLong ? { excluded: "line_too_long" } : sourceEntry(line.value.bytes, header.dimensions);
      if (!parsed.excluded && insert.run(parsed.word).changes === 0) parsed = { excluded: "duplicate" };
      if (parsed.excluded) {
        if (!(parsed.excluded in excluded)) throw new Error(`Unknown exclusion ${parsed.excluded}`);
        excluded[parsed.excluded]++;
      } else {
        const entry = await entries.next();
        if (entry.done || entry.value.id !== accepted || entry.value.word !== parsed.word || !entry.value.vector.equals(parsed.vector)) throw new Error(`Source-to-segment mismatch at accepted id ${accepted}`);
        accepted++;
      }
    }
    if (rowsRead !== header.rows) throw new Error(`Source row count mismatch: header=${header.rows}, read=${rowsRead}`);
    if (!(await entries.next()).done) throw new Error("Segments contain entries absent from source");
    if (accepted !== manifest.stats.accepted || JSON.stringify(excluded) !== JSON.stringify(manifest.stats.excluded) || accepted + Object.values(excluded).reduce((sum, count) => sum + count, 0) !== rowsRead) throw new Error("Manifest counters do not match independently classified source rows");
    const semanticSha256 = semanticHash.digest("hex"); if (semanticSha256 !== manifest.semanticSha256) throw new Error("Semantic inventory hash mismatch");
    return { corpusId: manifest.corpusId, rowsRead, accepted, excluded, segments: manifest.segments.length, semanticSha256 };
  } finally {
    await lines?.return?.().catch(() => {}); await entries.return?.().catch(() => {});
    try { database?.close(); } catch {}
    await rm(databasePath, { force: true });
  }
}

function args(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --source FILE --output DIR"); values[argv[index].slice(2)] = argv[index + 1]; }
  if (!values.source || !values.output) throw new Error("Both --source and --output are required"); return { sourcePath: values.source, outputDir: values.output };
}
if (process.argv[1] && basename(process.argv[1]) === "verify-semantic-corpus-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) verifySemanticCorpus(args(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
