import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import legacy from "../data/legacy-v1.json";
import manifest from "../data/word2vec-index.json";
import { evaluateWord2vec, loadWord2vecObjectFromRuntime, setWord2vecObjectLoaderForTests, word2vecAvailable, word2vecCacheStats, Word2vecStorageError, word2vecLegacyTargets, word2vecMetadata, word2vecTargets } from "../lib/word2vec.server";

async function asset(key: string) {
  const value = await readFile(`public/${key}`);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

// Codec fixtures deliberately repin their test transport so inner validation,
// rather than the outer digest check, must reject malformed binary structure.
function rankedFixture() {
  const target = manifest.targets.find(target => target.word === 'assiette')!;
  const count = manifest.vocabularySize, raw = Buffer.alloc(32 + count * 6), idsOffset = 32 + count * 2;
  raw.write('BWS2');
  for (const [offset, value] of [[4, 2], [8, count], [12, target.wordId], [16, 32], [20, idsOffset], [24, raw.length], [28, 0]]) {
    raw.writeUInt32LE(value, offset);
  }
  const order = [target.wordId, ...Array.from({ length: count }, (_, id) => id).filter(id => id !== target.wordId)];
  const taxe = manifest.words.indexOf('taxe'), position = order.indexOf(taxe);
  [order[137], order[position]] = [order[position], order[137]];
  for (let rank = 0; rank < count; rank++) {
    raw.writeInt16LE(rank === 0 ? 10000 : 3579, 32 + rank * 2);
    raw.writeUInt32LE(order[rank], idsOffset + rank * 4);
  }
  return raw;
}
async function withCodecFixture(raw: Buffer, check: () => Promise<void>) {
  const target = manifest.targets.find(target => target.word === 'assiette')!;
  const original = { ...target }, format = manifest.format, compressed = gzipSync(raw);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  Object.assign(target, { rawBytes: raw.length, compressedBytes: compressed.length, rawSha256: hash(raw), objectSha256: hash(compressed) });
  manifest.format = 'BWS2';
  setWord2vecObjectLoaderForTests(async () => compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength));
  try {
    await check();
  } finally {
    Object.assign(target, original); manifest.format = format; setWord2vecObjectLoaderForTests(null);
  }
}

test('BWS2 reconstructs temperatures by source identity and ordinal ranks by permutation position', async () => {
  await withCodecFixture(rankedFixture(), async () => {
    assert.deepEqual(await evaluateWord2vec('assiette', 'assiette'), { word: 'assiette', temperature: 100, rank: 1, found: true });
    assert.deepEqual(await evaluateWord2vec('assiette', 'taxe'), { word: 'taxe', temperature: 35.79, rank: 138, found: false });
  });
});
test('the Word2Vec codec refuses BWS1 instead of falling back to its unpublished format', async () => {
  const ranked = rankedFixture(), count = manifest.vocabularySize, raw = Buffer.from(ranked), idsOffset = 32 + count * 2;
  raw.write('BWS1'); raw.writeUInt32LE(1, 4);
  for (let position = 0; position < count; position++) {
    const id = ranked.readUInt32LE(idsOffset + position * 4);
    raw.writeInt16LE(ranked.readInt16LE(32 + position * 2), 32 + id * 2);
    raw.writeUInt32LE(position + 1, idsOffset + id * 4);
  }
  await withCodecFixture(raw, async () => {
    await assert.rejects(evaluateWord2vec('assiette', 'taxe'), (error: unknown) => error instanceof Word2vecStorageError && error.code === 'corrupt');
  });
});
test('BWS2 refuses repinned duplicate, out-of-bounds, unordered and inconsistent target columns', async () => {
  const count = manifest.vocabularySize, idsOffset = 32 + count * 2;
  const mutations = [
    (raw: Buffer) => raw.writeUInt32LE(raw.readUInt32LE(idsOffset), idsOffset + 4),
    (raw: Buffer) => raw.writeUInt32LE(count, idsOffset + 4),
    (raw: Buffer) => raw.writeInt16LE(3580, 36),
    (raw: Buffer) => raw.writeInt16LE(9999, 32),
    (raw: Buffer) => raw.writeUInt32LE(0, 12),
  ];
  for (const mutate of mutations) {
    const raw = rankedFixture(); mutate(raw);
    await withCodecFixture(raw, async () => {
      await assert.rejects(evaluateWord2vec('assiette', 'taxe'), (error: unknown) => error instanceof Word2vecStorageError && error.code === 'corrupt');
      assert.equal(word2vecCacheStats().entries, 0);
    });
  }
});

test("Word2Vec retains all source entries and covers every historical secret", async () => {
  const manifest = await readFile("data/word2vec-index.json", "utf8").then(JSON.parse, () => null);
  assert.equal(manifest?.words.length, 155562, "the complete source vocabulary must be generated");
  assert.equal(manifest.targets.length, 475);
  const targets = new Set(manifest.targets.map((target: { word: string }) => target.word));
  for (const word of legacy.targets) assert.ok(targets.has(word === "œuf" ? "oeuf" : word), `historical slot missing: ${word}`);
  assert.deepEqual(word2vecLegacyTargets, legacy.targets.map(word => word === "œuf" ? "oeuf" : word));
  assert.equal(word2vecMetadata.vocabularySize, 155562);
  assert.equal(word2vecTargets.length, 475);
});

test("exact normalized lookup wins only on the real target and never aliases ligatures", async () => {
  setWord2vecObjectLoaderForTests(asset);
  assert.deepEqual(await evaluateWord2vec("assiette", "  ASSIETTE  "), { word: "assiette", temperature: 100, rank: 1, found: true });
  assert.deepEqual(await evaluateWord2vec("oeuf", "oeuf"), { word: "oeuf", temperature: 100, rank: 1, found: true });
  assert.equal(await evaluateWord2vec("oeuf", "œuf"), null);
  assert.equal(await evaluateWord2vec("assiette", "braiz_mot_inconnu_93483829"), null);
  assert.equal(word2vecAvailable("œuf"), false);
  assert.equal(word2vecAvailable("oeuf"), true);
  const accent = await evaluateWord2vec("assiette", "E\u0301COLE");
  assert.equal(accent?.word, "école");
  assert.equal(accent?.found, false);
  const apostrophe = manifest.words.find(word => word.includes("'"))!;
  assert.ok(apostrophe);
  assert.equal((await evaluateWord2vec("assiette", apostrophe.replaceAll("'", "’")))?.word, apostrophe);
});

test("all real columns decode with their source identity while cache stays below 4 MiB", async () => {
  setWord2vecObjectLoaderForTests(asset);
  for (const { word } of manifest.targets) {
    assert.deepEqual(await evaluateWord2vec(word, word), { word, temperature: 100, rank: 1, found: true });
    assert.ok(word2vecCacheStats().bytes <= 4 * 1024 * 1024);
  }
  assert.ok(word2vecCacheStats().entries <= 4);
});

test("assiette preserves the source's fiscal and culinary associations without editorial correction", async () => {
  setWord2vecObjectLoaderForTests(asset);
  for (const [word, temperature, rank] of [
    ["taxe", 35.79, 138], ["impôts", 39.66, 42], ["bol", 33.02, 296],
    ["institut", 1.53, 105341], ["rôti", 32.44, 341], ["roti", 35.05, 179],
  ] as const) {
    assert.deepEqual(await evaluateWord2vec("assiette", word), { word, temperature, rank, found: false });
  }
});

test("simultaneous reads deduplicate and a burst admits at most four unique loads", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  setWord2vecObjectLoaderForTests(async key => { reads++; await gate; return asset(key); });
  const words = word2vecTargets.slice(0, 5);
  const pending = words.map(word => evaluateWord2vec(word, word).then(value => ({ value }), error => ({ error })));
  const duplicate = evaluateWord2vec(words[0], words[0]);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(word2vecCacheStats().activeLoads, 4);
  assert.equal(word2vecCacheStats().inFlight, 4);
  release();
  const results = await Promise.all(pending);
  assert.equal((await duplicate)?.found, true);
  assert.equal(results.filter(result => "value" in result && result.value?.found).length, 4);
  assert.equal(results.filter(result => "error" in result && result.error instanceof Word2vecStorageError && result.error.code === "read_failed").length, 1);
  assert.equal(reads, 4);
  assert.equal(word2vecCacheStats().activeLoads, 0);
});

test("missing and corrupt objects never produce a score and a failed read can retry", async () => {
  setWord2vecObjectLoaderForTests(async () => null);
  await assert.rejects(evaluateWord2vec("assiette", "bol"), (error: unknown) => error instanceof Word2vecStorageError && error.code === "object_missing");
  const entry = manifest.targets.find(target => target.word === "assiette")!;
  const original = new Uint8Array(await asset(entry.key));
  for (const bytes of [original.slice(0, 50), Uint8Array.from(original, (byte, index) => index === 100 ? byte ^ 1 : byte)]) {
    setWord2vecObjectLoaderForTests(async () => bytes.buffer);
    await assert.rejects(evaluateWord2vec("assiette", "bol"), (error: unknown) => error instanceof Word2vecStorageError && error.code === "corrupt");
    assert.equal(word2vecCacheStats().entries, 0);
  }
  setWord2vecObjectLoaderForTests(async () => asset(manifest.targets[0].key));
  await assert.rejects(evaluateWord2vec("assiette", "bol"), (error: unknown) => error instanceof Word2vecStorageError && error.code === "corrupt");
  let fails = true;
  setWord2vecObjectLoaderForTests(async key => fails ? null : asset(key));
  await assert.rejects(evaluateWord2vec("assiette", "bol"));
  fails = false;
  assert.equal((await evaluateWord2vec("assiette", "bol"))?.found, false);
});

test("Word2Vec uses ASSETS explicitly even when the historical R2 binding exists", async () => {
  const bytes = await asset(manifest.targets[0].key);
  let requestedPath = "";
  const runtime = {
    BRAIZ_V1_STORAGE: "r2",
    BUCKET: { get: async () => { throw new Error("historical storage must not be read"); } },
    ASSETS: { fetch: async (request: Request) => { requestedPath = new URL(request.url).pathname; return new Response(bytes); } },
  };
  const delivered = await loadWord2vecObjectFromRuntime(runtime, manifest.targets[0].key);
  assert.ok(delivered && Buffer.from(delivered).equals(Buffer.from(bytes)));
  assert.equal(requestedPath, `/${manifest.targets[0].key}`);
  await assert.rejects(loadWord2vecObjectFromRuntime({ BUCKET: runtime.BUCKET }, "missing"), (error: unknown) => error instanceof Word2vecStorageError && error.code === "binding_missing");
  await assert.rejects(loadWord2vecObjectFromRuntime({ ASSETS: { fetch: async () => { throw new Error("offline"); } } }, "missing"), (error: unknown) => error instanceof Word2vecStorageError && error.code === "read_failed");
});
