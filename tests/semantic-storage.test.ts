import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import source from "../data/semantic-fr.json";
import manifest from "../data/semantic-v1-index.json";
import { clearSemanticCacheForTests, loadSemanticObjectFromRuntime, semanticCacheStats, SemanticStorageError, setSemanticObjectLoaderForTests, targetSegment } from "../lib/semantic-storage";

async function asset(key: string) {
  try { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
  catch { return null; }
}

test("all 3.6 million V1 scores, ranks and stable order positions match the source", async () => {
  setSemanticObjectLoaderForTests(asset);
  for (let targetIndex = 0; targetIndex < source.puzzles.length; targetIndex++) {
    const compressed = Buffer.from(source.puzzles[targetIndex].scores, "base64");
    const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    const scores = new Int16Array(source.words.length);
    for (let word = 0; word < scores.length; word++) scores[word] = view.getInt16(word * 2, true);
    const order = Array.from({ length: scores.length }, (_, word) => word).sort((a, b) => scores[b] - scores[a] || a - b);
    const ranks = new Uint16Array(scores.length);
    order.forEach((word, position) => { ranks[word] = position > 0 && scores[word] === scores[order[position - 1]] ? ranks[order[position - 1]] : position + 1; });
    const actual = await targetSegment(targetIndex);
    assert.equal(actual.scores.length, scores.length);
    for (let word = 0; word < scores.length; word++) {
      assert.equal(actual.scores[word], scores[word], `${targetIndex}:${word}:score`);
      assert.equal(actual.ranks[word], ranks[word], `${targetIndex}:${word}:rank`);
      assert.equal(actual.order[word], order[word], `${targetIndex}:${word}:order`);
    }
  }
});

test("concurrent reads deduplicate, the LRU stays byte-bounded and a failure can be retried", async () => {
  const reads = new Map<string, number>();
  setSemanticObjectLoaderForTests(async key => { reads.set(key, (reads.get(key) ?? 0) + 1); return asset(key); });
  await Promise.all(Array.from({ length: 12 }, () => targetSegment(0)));
  assert.equal(reads.get(manifest.segments[0].key), 1);
  for (let target = 0; target < 30; target++) await targetSegment(target);
  const stats = semanticCacheStats();
  assert.ok(stats.bytes <= stats.budgetBytes);
  assert.ok(stats.entries < 30);
  assert.equal(stats.activeLoads, 0); assert.equal(stats.queuedLoads, 0); assert.equal(stats.inFlight, 0);

  let fails = true; let attempts = 0;
  setSemanticObjectLoaderForTests(async key => { attempts++; return fails ? null : asset(key); });
  await assert.rejects(targetSegment(1), (error: unknown) => error instanceof SemanticStorageError && error.code === "object_missing");
  fails = false; await targetSegment(1);
  assert.equal(attempts, 2);
});

test("unique pending loads are bounded under a request burst", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  setSemanticObjectLoaderForTests(async key => { await gate; return asset(key); });
  const requests = Array.from({ length: 12 }, (_, target) => targetSegment(target).then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error })));
  await new Promise(resolve => setTimeout(resolve, 0));
  const busy = semanticCacheStats();
  assert.equal(busy.activeLoads, 4); assert.equal(busy.queuedLoads, 4); assert.equal(busy.inFlight, 8);
  release();
  const results = await Promise.all(requests);
  assert.equal(results.filter(result => result.ok).length, 8);
  assert.equal(results.filter(result => !result.ok && result.error instanceof SemanticStorageError && result.error.code === "read_failed").length, 4);
});

test("corrupt, truncated and mismatched shards never enter the cache", async () => {
  const original = new Uint8Array((await asset(manifest.segments[2].key))!);
  for (const value of [original.slice(0, 50), Uint8Array.from(original, (byte, index) => index === 100 ? byte ^ 1 : byte)]) {
    setSemanticObjectLoaderForTests(async () => value.buffer);
    await assert.rejects(targetSegment(2), (error: unknown) => error instanceof SemanticStorageError && error.code === "corrupt");
    assert.equal(semanticCacheStats().entries, 0);
  }
  setSemanticObjectLoaderForTests(async key => asset(key.replace(manifest.segments[2].key, manifest.segments[3].key)));
  await assert.rejects(targetSegment(2), (error: unknown) => error instanceof SemanticStorageError && error.code === "corrupt");
});

test("runtime transport uses R2 when configured and never falls back after an R2 failure", async () => {
  clearSemanticCacheForTests();
  const object = await asset(manifest.segments[0].key); assert.ok(object);
  let assetReads = 0; let r2Reads = 0;
  const runtime = {
    BUCKET: { get: async () => { r2Reads++; return { arrayBuffer: async () => object }; } },
    ASSETS: { fetch: async () => { assetReads++; return new Response(object); } },
  };
  assert.equal((await loadSemanticObjectFromRuntime(runtime, "BUCKET", manifest.segments[0].key))?.byteLength, object.byteLength);
  assert.equal(r2Reads, 1); assert.equal(assetReads, 0);
  await assert.rejects(loadSemanticObjectFromRuntime({ ...runtime, BUCKET: { get: async () => null } }, "BUCKET", "missing"), (error: unknown) => error instanceof SemanticStorageError && error.code === "object_missing");
  assert.equal(assetReads, 0);
  await assert.rejects(loadSemanticObjectFromRuntime({ ASSETS: runtime.ASSETS }, "BUCKET", "missing"), (error: unknown) => error instanceof SemanticStorageError && error.code === "binding_missing");
  await assert.rejects(loadSemanticObjectFromRuntime({ BUCKET: { get: async () => ({ arrayBuffer: async () => { throw new Error("body failed"); } }) } }, "BUCKET", "failed"), (error: unknown) => error instanceof SemanticStorageError && error.code === "read_failed");
  await assert.rejects(loadSemanticObjectFromRuntime({ ASSETS: { fetch: async () => ({ ok: true, arrayBuffer: async () => { throw new Error("body failed"); } }) } }, null, "failed"), (error: unknown) => error instanceof SemanticStorageError && error.code === "read_failed");
  const staticValue = await loadSemanticObjectFromRuntime({ ASSETS: runtime.ASSETS }, null, manifest.segments[0].key);
  assert.equal(staticValue?.byteLength, object.byteLength); assert.equal(assetReads, 1);
});
