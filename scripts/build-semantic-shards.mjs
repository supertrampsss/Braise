import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { canonicalGzip } from "./canonical-gzip.mjs";

const verifyOnly = process.argv.slice(2).includes("--verify");
if (process.argv.slice(2).some(argument => argument !== "--verify")) throw new Error("Usage: build-semantic-shards.mjs [--verify]");
// Frozen canonical index from the approved V1 source; verification never adopts a new hash.
const FROZEN_INDEX_SHA256 = "6f7135f02473c70f0b13fbd62709fc23a1b2ca45294b7c2cdaef29a2c691f137";

const sourcePath = "data/semantic-fr.json";
const baseline = JSON.parse(await readFile("docs/program/BASELINE.json", "utf8"));
const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha256 !== baseline.corpus_sha256) throw new Error("The semantic source is not the frozen V1 corpus");
const source = JSON.parse(sourceBytes.toString("utf8"));
if (source.words.length !== baseline.dictionary_size || source.puzzles.length !== baseline.target_count) throw new Error("Unexpected V1 dimensions");
if (source.words.length > 65535) throw new Error("Storage format v1 supports at most 65,535 words");

const version = "fr-fasttext-30000-v1";
const publicRoot = `public/semantic/${version}`;
const targetRoot = `${publicRoot}/targets`;
let frozenIndex;
if (verifyOnly) {
  const bytes = await readFile("data/semantic-v1-index.json");
  if (createHash("sha256").update(bytes).digest("hex") !== FROZEN_INDEX_SHA256) throw new Error("Frozen V1 index hash mismatch");
  if (!(await readFile(`${publicRoot}/manifest.json`)).equals(bytes)) throw new Error("Public V1 manifest differs from frozen index");
  if (!(await readFile(`${publicRoot}/source.json`)).equals(sourceBytes)) throw new Error("Public V1 source differs from frozen corpus");
  frozenIndex = JSON.parse(bytes.toString("utf8"));
} else {
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });
}
const wordIndex = new Map(source.words.map((word, index) => [word, index]));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const segments = [];

for (let targetIndex = 0; targetIndex < source.puzzles.length; targetIndex++) {
  const puzzle = source.puzzles[targetIndex];
  const scoreBytes = Buffer.from(puzzle.scores, "base64");
  if (scoreBytes.length !== source.words.length * 2) throw new Error(`Invalid scores for ${puzzle.word}`);
  const scores = new Int16Array(source.words.length);
  const scoreView = new DataView(scoreBytes.buffer, scoreBytes.byteOffset, scoreBytes.byteLength);
  for (let index = 0; index < scores.length; index++) scores[index] = scoreView.getInt16(index * 2, true);
  const order = Array.from({ length: scores.length }, (_, index) => index).sort((a, b) => scores[b] - scores[a] || a - b);
  const ranks = new Uint16Array(scores.length);
  order.forEach((index, rank) => { ranks[index] = rank > 0 && scores[index] === scores[order[rank - 1]] ? ranks[order[rank - 1]] : rank + 1; });

  const headerBytes = 64;
  const raw = Buffer.alloc(headerBytes + scores.length * 6);
  raw.write("BRZ1", 0, 4, "ascii");
  raw.writeUInt16LE(1, 4);
  raw.writeUInt16LE(0b111, 6);
  raw.writeUInt32LE(scores.length, 8);
  raw.writeUInt32LE(targetIndex, 12);
  raw.writeUInt32LE(wordIndex.get(puzzle.word), 16);
  raw.writeUInt32LE(headerBytes, 20);
  raw.writeUInt32LE(headerBytes + scores.length * 2, 24);
  raw.writeUInt32LE(headerBytes + scores.length * 4, 28);
  raw.writeUInt32LE(raw.length, 32);
  for (let index = 0; index < scores.length; index++) raw.writeInt16LE(scores[index], headerBytes + index * 2);
  for (let index = 0; index < ranks.length; index++) raw.writeUInt16LE(ranks[index], headerBytes + scores.length * 2 + index * 2);
  for (let index = 0; index < order.length; index++) raw.writeUInt16LE(order[index], headerBytes + scores.length * 4 + index * 2);
  const filename = `${String(targetIndex).padStart(3, "0")}-${sha256(Buffer.from(puzzle.word)).slice(0, 12)}.brz`;
  const key = `semantic/${version}/targets/${filename}`;
  if (verifyOnly) {
    const expected = frozenIndex.segments[targetIndex];
    if (expected.key !== key || expected.rawBytes !== raw.length || expected.rawSha256 !== sha256(raw)) throw new Error(`Frozen V1 payload mismatch for ${key}`);
    const stored = await readFile(`public/${key}`);
    if (stored.length !== expected.compressedBytes || sha256(stored) !== expected.objectSha256) throw new Error(`Frozen V1 object mismatch for ${key}`);
    if (!gunzipSync(stored, { maxOutputLength: expected.rawBytes }).equals(raw)) throw new Error(`Frozen V1 decoded payload mismatch for ${key}`);
    segments.push(expected);
    continue;
  }
  const compressed = canonicalGzip(raw, { level: 9 });
  await writeFile(`public/${key}`, compressed);
  segments.push({ targetIndex, word: puzzle.word, wordIndex: wordIndex.get(puzzle.word), key, formatVersion: 1, rawBytes: raw.length, compressedBytes: compressed.length, rawSha256: sha256(raw), objectSha256: sha256(compressed) });
}

const index = {
  format: { magic: "BRZ1", version: 1, byteOrder: "little-endian", headerBytes: 64, arrays: ["int16 scores", "uint16 competition ranks", "uint16 stable order"] },
  corpus: { id: version, sourceSha256, dictionarySize: source.words.length, targetCount: source.puzzles.length },
  meta: { ...source.meta, encoding: "Immutable gzip-compressed BRZ1 target shards; scores, competition ranks and stable order are precomputed." },
  words: source.words,
  puzzles: source.puzzles.map(puzzle => Object.fromEntries(Object.entries(puzzle).filter(([key]) => key !== "scores"))),
  segments,
};
if (!verifyOnly) {
  await writeFile("data/semantic-v1-index.json", JSON.stringify(index));
  await writeFile(`${publicRoot}/manifest.json`, JSON.stringify(index));
  await writeFile(`${publicRoot}/source.json`, sourceBytes);
}
const manifestBytes = await readFile(`${publicRoot}/manifest.json`);
console.log(JSON.stringify({ mode: verifyOnly ? "verified-frozen" : "generated", sourceSha256, targetCount: segments.length, rawTargetBytes: segments.reduce((n, x) => n + x.rawBytes, 0), compressedTargetBytes: segments.reduce((n, x) => n + x.compressedBytes, 0), manifestBytes: manifestBytes.length }));
