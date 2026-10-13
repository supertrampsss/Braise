import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pinnedRangeR2Loader, validateRangeRoot, validateRangeShard, type RangeBucket, type RangeShard } from "../lib/semantic-v2-range-r2";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function fixture() {
  const blobs = new Map<string, Uint8Array>();
  const add = (bytes: Uint8Array) => { const ref = { sha256: hash(bytes), bytes: bytes.length }; blobs.set(ref.sha256, bytes); return ref; };
  const bytes = new TextEncoder().encode("0123456789abcdefghij");
  const chunks = [add(bytes.slice(0, 10)), add(bytes.slice(10))];
  const file = bytes.slice(7, 14);
  const shard: RangeShard = { schemaVersion: 1, format: "BRT2-range-shard", archive: { bytes: 20, chunks }, files: [{ key: "corpus/presence/leaf-aa", offset: 7, bytes: 7, sha256: hash(file) }] };
  const shardRef = add(new TextEncoder().encode(JSON.stringify(shard)));
  const root = { schemaVersion: 1, format: "BRT2-range-root", shards: [{ prefix: "corpus/presence/", ...shardRef }] };
  const rootPin = add(new TextEncoder().encode(JSON.stringify(root)));
  const calls: Array<{ key: string; range?: { offset: number; length: number } }> = [];
  const bucket: RangeBucket = { async get(key, options) {
    calls.push({ key, range: options?.range }); const content = blobs.get(key.slice("semantic-blobs/sha256/".length)); if (!content) return null;
    const part = options ? content.slice(options.range.offset, options.range.offset + options.range.length) : content;
    return { size: content.length, range: options?.range, body: new Blob([part as Uint8Array<ArrayBuffer>]).stream() };
  } };
  return { blobs, add, bytes, file, shard, root, rootPin, bucket, calls };
}

test("range transport reconstructs a crossed file, validates full hash and freezes its root pin", async () => {
  const f = fixture(); const load = pinnedRangeR2Loader(f.bucket, f.rootPin); f.rootPin.sha256 = "f".repeat(64);
  assert.deepEqual(await load("corpus/presence/leaf-aa", 7), f.file);
  assert.deepEqual(f.calls.filter(c => c.range).map(c => c.range), [{ offset: 7, length: 3 }, { offset: 0, length: 4 }]);
  assert.ok(f.calls.every(c => /^semantic-blobs\/sha256\/[a-f0-9]{64}$/.test(c.key)));
  await load("corpus/presence/leaf-aa", 7); assert.equal(f.calls.filter(c => !c.range).length, 2);
  await assert.rejects(load("corpus/presence/leaf-aa", 6), /budget/);
  await assert.rejects(load("corpus/presence/unknown", 7), /not-pinned/);
  await assert.rejects(load("corpus/../secret", 7), /request/);
});

test("range transport refuses corrupt metadata and coherent metadata pointing to corrupt file bytes", async t => {
  for (const metadata of [true, false]) await t.test(metadata ? "root corruption" : "logical file corruption", async () => {
    const f = fixture(); const key = metadata ? f.rootPin.sha256 : f.shard.archive.chunks[0].sha256;
    f.blobs.get(key)![metadata ? 0 : 8] ^= 1;
    await assert.rejects(pinnedRangeR2Loader(f.bucket, f.rootPin)("corpus/presence/leaf-aa", 7), /hash|integrity/);
  });
});

test("range transport checks total object size, exact range metadata and streamed body length", async t => {
  for (const fault of ["total", "offset", "length", "short", "overflow", "missing"]) await t.test(fault, async () => {
    const f = fixture(); let cancelled = false;
    const bucket: RangeBucket = { async get(key, options) {
      const object = await f.bucket.get(key, options); if (!object || !options) return object;
      if (fault === "missing") return null;
      if (fault === "total") object.size = options.range.length;
      if (fault === "offset") object.range = { ...options.range, offset: options.range.offset + 1 };
      if (fault === "length") object.range = { ...options.range, length: options.range.length + 1 };
      if (fault === "short" || fault === "overflow") {
        const n = options.range.length + (fault === "short" ? -1 : 1);
        object.body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(n)); if (fault === "short") c.close(); }, cancel() { cancelled = true; } });
      }
      return object;
    } };
    await assert.rejects(pinnedRangeR2Loader(bucket, f.rootPin)("corpus/presence/leaf-aa", 7), /metadata|truncated|overflow|missing/);
    if (fault === "overflow") assert.equal(cancelled, true);
  });
});

test("pinned metadata refuses overlapping routes, duplicate paths, unsafe bounds and more than two chunks", () => {
  const f = fixture(); const root = structuredClone(f.root); root.shards.push({ ...root.shards[0], prefix: "corpus/" });
  assert.throws(() => validateRangeRoot(root), /prefix/);
  const shard = structuredClone(f.shard); shard.files.push({ ...shard.files[0] });
  assert.throws(() => validateRangeShard(shard, "corpus/presence/"), /file/);
  for (const offset of [-1, 15, Number.MAX_SAFE_INTEGER, 0.5]) {
    const changed = structuredClone(f.shard); changed.files[0].offset = offset;
    assert.throws(() => validateRangeShard(changed, "corpus/presence/"), /file/);
  }
  const changed = structuredClone(f.shard); changed.archive.chunks = Array.from({ length: 4 }, () => ({ sha256: "a".repeat(64), bytes: 5 })); changed.files[0].offset = 4;
  assert.throws(() => validateRangeShard(changed, "corpus/presence/"), /parts-budget/);
  changed.archive.chunks[0].bytes = 8 * 1024 * 1024 + 1;
  assert.throws(() => validateRangeShard(changed, "corpus/presence/"), /chunk/);
});

test("range transport admits at most four operations and releases capacity after failure", async () => {
  const f = fixture(); const waiting: Array<() => void> = [];
  const bucket: RangeBucket = { async get(key, options) { await new Promise<void>(resolve => waiting.push(resolve)); return f.bucket.get(key, options); } };
  const load = pinnedRangeR2Loader(bucket, f.rootPin);
  const pending = Array.from({ length: 4 }, () => load("absent/key", 7));
  await assert.rejects(load("absent/key", 7), /busy/); waiting.splice(0).forEach(resolve => resolve());
  await Promise.all(pending.map(p => assert.rejects(p, /not-pinned/)));
  await assert.rejects(load("absent/key", 7), /not-pinned/);
});
