import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { canonicalizeWord } from "./build-semantic-corpus-v2.mjs";
import { loadActiveCorpus, sha256, stableJson } from "./semantic-target-v2-common.mjs";

export const INDEX_MAGIC = "BPI2";
export const INDEX_VERSION = 2;
export const INDEX_HEADER_BYTES = 64;
export const DEFAULT_MAX_LEAF_RAW_BYTES = 4 * 1024 * 1024;
export const MAX_PREFIX_MANIFEST_BYTES = 4 * 1024 * 1024;
export const MAX_ROOT_MANIFEST_BYTES = 256 * 1024;
export const MAX_LOOKUP_INPUT_BYTES = 1024 * 1024;

export function wordHash(wordBytes) { return createHash("sha256").update(wordBytes).digest(); }
export function compareBytes(left, right) { return Buffer.compare(left, right); }

async function boundedRead(path, maxBytes, label) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 1 || info.size > maxBytes) throw new Error(`${label} exceeds its bounded size`);
  return readFile(path);
}

function assertHash(value, label) { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} hash is invalid`); }

export async function loadIndexRoot(corpusDir, outputDir, manifestName = null, expectedManifestSha256 = null) {
  corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  const corpus = await loadActiveCorpus(corpusDir); const indexDir = join(outputDir, corpus.manifest.corpusId, "presence");
  let active = null;
  if (!manifestName) {
    const activeBytes = await boundedRead(join(indexDir, "active.json"), 16 * 1024, "Index active pointer"); active = JSON.parse(activeBytes.toString("utf8"));
    if (active.schemaVersion !== 1 || basename(active.manifest) !== active.manifest) throw new Error("Index active pointer is invalid");
    manifestName = active.manifest; expectedManifestSha256 = active.manifestSha256;
  }
  if (basename(manifestName) !== manifestName) throw new Error("Index manifest reference is invalid"); assertHash(expectedManifestSha256, "Index manifest");
  const manifestBytes = await boundedRead(join(indexDir, manifestName), MAX_ROOT_MANIFEST_BYTES, "Index root manifest");
  if (sha256(manifestBytes) !== expectedManifestSha256) throw new Error("Index root manifest hash mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.schemaVersion !== 1 || manifest.complete !== true || manifest.format !== "BPI2-hash-pages" || manifest.formatVersion !== INDEX_VERSION || manifest.corpus?.id !== corpus.manifest.corpusId || manifest.corpus.manifestSha256 !== corpus.manifestSha256 || manifest.corpus.semanticSha256 !== corpus.manifest.semanticSha256 || manifest.corpus.dictionarySize !== corpus.manifest.stats.accepted || manifest.stats?.dictionarySize !== corpus.manifest.stats.accepted || manifest.config?.format !== "BPI2-hash-pages" || manifest.config.formatVersion !== INDEX_VERSION || manifest.config.hash !== "sha256-first-16-bits" || manifest.config.ordering !== "utf8-binary" || manifest.config.corpusManifestSha256 !== corpus.manifestSha256 || !Number.isInteger(manifest.config.maxLeafRawBytes) || manifest.config.maxLeafRawBytes < 1024 * 1024 || manifest.config.maxLeafRawBytes > 32 * 1024 * 1024 || sha256(stableJson(manifest.config)) !== manifest.configHash || !Array.isArray(manifest.prefixPages) || manifest.prefixPages.length > 256 || active && active.corpusId !== corpus.manifest.corpusId) throw new Error("Index root manifest is inconsistent with the active corpus");
  return { corpus, indexDir, manifest, manifestBytes, manifestSha256: expectedManifestSha256 };
}

export async function readPrefixManifest(index, firstByte) {
  const reference = index.manifest.prefixPages.find(page => page.firstByte === firstByte);
  if (!reference) return null;
  if (basename(reference.file) !== reference.file || !Number.isInteger(reference.bytes) || reference.bytes < 1 || reference.bytes > MAX_PREFIX_MANIFEST_BYTES) throw new Error("Index prefix reference is invalid"); assertHash(reference.sha256, "Index prefix");
  const bytes = await boundedRead(join(index.indexDir, "prefixes", reference.file), MAX_PREFIX_MANIFEST_BYTES, "Index prefix manifest");
  if (bytes.length !== reference.bytes || sha256(bytes) !== reference.sha256) throw new Error("Index prefix manifest hash mismatch");
  const page = JSON.parse(bytes.toString("utf8"));
  if (page.schemaVersion !== 1 || page.firstByte !== firstByte || page.corpusManifestSha256 !== index.corpus.manifestSha256 || !Array.isArray(page.leaves) || page.leaves.length > 256) throw new Error("Index prefix manifest is invalid");
  return page;
}

export async function readIndexLeaf(index, reference, firstByte, secondByte) {
  if (!reference || reference.secondByte !== secondByte || basename(reference.file) !== reference.file || !Number.isInteger(reference.count) || reference.count < 1 || !Number.isInteger(reference.rawBytes) || reference.rawBytes < INDEX_HEADER_BYTES + 12 || reference.rawBytes > index.manifest.config.maxLeafRawBytes || !Number.isInteger(reference.compressedBytes) || reference.compressedBytes < 1 || reference.compressedBytes > index.manifest.config.maxLeafRawBytes + 65_536) throw new Error("Index leaf reference is invalid");
  assertHash(reference.rawSha256, "Index leaf raw"); assertHash(reference.objectSha256, "Index leaf object");
  const compressed = await boundedRead(join(index.indexDir, "leaves", reference.file), index.manifest.config.maxLeafRawBytes + 65_536, "Index leaf");
  if (compressed.length !== reference.compressedBytes || sha256(compressed) !== reference.objectSha256) throw new Error("Index leaf object hash mismatch");
  let raw; try { raw = gunzipSync(compressed, { maxOutputLength: index.manifest.config.maxLeafRawBytes }); } catch { throw new Error("Cannot safely decompress index leaf"); }
  if (raw.length !== reference.rawBytes || sha256(raw) !== reference.rawSha256 || raw.toString("ascii", 0, 4) !== INDEX_MAGIC || raw.readUInt16LE(4) !== INDEX_VERSION || raw.readUInt16LE(6) !== 1 || raw.readUInt8(8) !== firstByte || raw.readUInt8(9) !== secondByte || raw.readUInt32LE(12) !== reference.count || raw.readUInt32LE(16) !== INDEX_HEADER_BYTES || raw.readUInt32LE(20) !== INDEX_HEADER_BYTES + reference.count * 4 || raw.readUInt32LE(24) !== raw.length || raw.subarray(32, 48).toString("hex") !== index.corpus.manifestSha256.slice(0, 32) || raw.subarray(48, 64).toString("hex") !== index.corpus.manifest.semanticSha256.slice(0, 32)) throw new Error("Index leaf header is invalid");
  const records = []; let previous = null;
  for (let offsetIndex = 0; offsetIndex < reference.count; offsetIndex++) {
    const offset = raw.readUInt32LE(INDEX_HEADER_BYTES + offsetIndex * 4); const next = offsetIndex + 1 < reference.count ? raw.readUInt32LE(INDEX_HEADER_BYTES + (offsetIndex + 1) * 4) : raw.length;
    if (offset < INDEX_HEADER_BYTES + reference.count * 4 || next <= offset || offset + 8 > next) throw new Error("Index leaf offsets are invalid");
    const length = raw.readUInt32LE(offset); const id = raw.readUInt32LE(offset + 4); if (length < 1 || offset + 8 + length !== next) throw new Error("Index leaf record is invalid");
    const word = raw.subarray(offset + 8, next); if (previous && compareBytes(previous, word) >= 0) throw new Error("Index leaf words are not strictly ordered"); previous = word;
    records.push({ word, id });
  }
  return records;
}

export async function lookupSemanticWord({ corpusDir, outputDir, word }) {
  if (typeof word !== "string" || Buffer.byteLength(word) > MAX_LOOKUP_INPUT_BYTES) throw new Error("Lookup word exceeds the bounded input size");
  const canonical = canonicalizeWord(word); if (!canonical) return null; const bytes = Buffer.from(canonical); const hash = wordHash(bytes);
  const index = await loadIndexRoot(corpusDir, outputDir); const prefix = await readPrefixManifest(index, hash[0]); if (!prefix) return null;
  const reference = prefix.leaves.find(leaf => leaf.secondByte === hash[1]); if (!reference) return null;
  const records = await readIndexLeaf(index, reference, hash[0], hash[1]); let low = 0; let high = records.length - 1;
  while (low <= high) { const middle = Math.floor((low + high) / 2); const comparison = compareBytes(records[middle].word, bytes); if (comparison === 0) return records[middle].id; if (comparison < 0) low = middle + 1; else high = middle - 1; }
  return null;
}
