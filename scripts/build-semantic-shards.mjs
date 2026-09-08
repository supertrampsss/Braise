import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

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
await rm(publicRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });
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
  const compressed = gzipSync(raw, { level: 9 });
  const filename = `${String(targetIndex).padStart(3, "0")}-${sha256(Buffer.from(puzzle.word)).slice(0, 12)}.brz`;
  const key = `semantic/${version}/targets/${filename}`;
  await writeFile(`public/${key}`, compressed);
  segments.push({ targetIndex, word: puzzle.word, wordIndex: wordIndex.get(puzzle.word), key, formatVersion: 1, rawBytes: raw.length, compressedBytes: compressed.length, rawSha256: sha256(raw), objectSha256: sha256(compressed) });
}

const index = {
  format: { magic: "BRZ1", version: 1, byteOrder: "little-endian", headerBytes: 64, arrays: ["int16 scores", "uint16 competition ranks", "uint16 stable order"] },
  corpus: { id: version, sourceSha256, dictionarySize: source.words.length, targetCount: source.puzzles.length },
  meta: { ...source.meta, encoding: "Immutable gzip-compressed BRZ1 target shards; scores, competition ranks and stable order are precomputed." },
  words: source.words,
  puzzles: source.puzzles.map(({ scores, ...puzzle }) => puzzle),
  segments,
};
await writeFile("data/semantic-v1-index.json", JSON.stringify(index));
await writeFile(`${publicRoot}/manifest.json`, JSON.stringify(index));
await writeFile(`${publicRoot}/source.json`, sourceBytes);
const manifestBytes = await readFile(`${publicRoot}/manifest.json`);
console.log(JSON.stringify({ sourceSha256, targetCount: segments.length, rawTargetBytes: segments.reduce((n, x) => n + x.rawBytes, 0), compressedTargetBytes: segments.reduce((n, x) => n + x.compressedBytes, 0), manifestBytes: manifestBytes.length }));
