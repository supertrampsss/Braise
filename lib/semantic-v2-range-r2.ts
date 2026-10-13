// Closed, SHA-pinned transport for the existing logical-object reader.
export const RANGE_METADATA_LIMIT = 256 * 1024;
export const RANGE_CHUNK_LIMIT = 8 * 1024 * 1024;
export const RANGE_OBJECT_LIMIT = 4 * 1024 * 1024 + 65536;
export type RangeBlob = { sha256: string; bytes: number };
export type RangeRoot = { schemaVersion: 1; format: "BRT2-range-root"; shards: Array<RangeBlob & { prefix: string }> };
export type RangeShard = { schemaVersion: 1; format: "BRT2-range-shard"; archive: { bytes: number; chunks: RangeBlob[] }; files: Array<{ key: string; offset: number; bytes: number; sha256: string }> };
type ReadableObject = { size: number; body: ReadableStream<Uint8Array>; range?: { offset?: number; length?: number } };
export type RangeBucket = { get(key: string, options?: { range: { offset: number; length: number } }): Promise<ReadableObject | null> };
const HASH = /^[a-f0-9]{64}$/;
const keyValid = (key: unknown): key is string => typeof key === "string" && key.length <= 512 && /^[a-zA-Z0-9._/-]+$/.test(key) && key.split("/").every(part => part.length > 0 && part !== "." && part !== "..");
const integer = (value: unknown, max: number): value is number => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= max;
const blobValid = (ref: RangeBlob, max: number) => ref && HASH.test(ref.sha256) && integer(ref.bytes, max);
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))].map(v => v.toString(16).padStart(2, "0")).join("");

async function exactBody(object: ReadableObject, total: number, length: number, range?: { offset: number; length: number }) {
  if (object.size !== total || range && (object.range?.offset !== range.offset || object.range?.length !== range.length)) {
    await object.body.cancel(); throw new Error("v2-range-response-metadata");
  }
  const bytes = new Uint8Array(length); const reader = object.body.getReader(); let cursor = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      if (value.length > length - cursor) { await reader.cancel(); throw new Error("v2-range-body-overflow"); }
      bytes.set(value, cursor); cursor += value.length;
    }
  } finally { reader.releaseLock(); }
  if (cursor !== length) throw new Error("v2-range-body-truncated");
  return bytes;
}

export function validateRangeRoot(value: unknown): RangeRoot {
  const root = value as RangeRoot;
  if (!root || root.schemaVersion !== 1 || root.format !== "BRT2-range-root" || !Array.isArray(root.shards) || !root.shards.length || root.shards.length > 1024) throw new Error("v2-range-root");
  const prefixes: string[] = [];
  for (const ref of root.shards) {
    // Prefixes may end inside a filename (presence leaf's first hash byte).
    if (!blobValid(ref, RANGE_METADATA_LIMIT) || typeof ref.prefix !== "string" || !keyValid(ref.prefix.endsWith("/") ? ref.prefix.slice(0, -1) : ref.prefix) || prefixes.some(p => p.startsWith(ref.prefix) || ref.prefix.startsWith(p))) throw new Error("v2-range-root-prefix");
    prefixes.push(ref.prefix);
  }
  return root;
}

export function validateRangeShard(value: unknown, prefix: string): RangeShard {
  const shard = value as RangeShard;
  if (!shard || shard.schemaVersion !== 1 || shard.format !== "BRT2-range-shard" || !shard.archive || !Array.isArray(shard.archive.chunks) || !shard.archive.chunks.length || shard.archive.chunks.length > 32 || !Array.isArray(shard.files) || !shard.files.length || shard.files.length > 1024) throw new Error("v2-range-shard");
  let total = 0;
  for (const chunk of shard.archive.chunks) { if (!blobValid(chunk, RANGE_CHUNK_LIMIT)) throw new Error("v2-range-chunk"); total += chunk.bytes; }
  if (total !== shard.archive.bytes) throw new Error("v2-range-archive-size");
  const keys = new Set<string>();
  for (const file of shard.files) {
    if (!file || !keyValid(file.key) || !file.key.startsWith(prefix) || keys.has(file.key) || !blobValid(file, RANGE_OBJECT_LIMIT) || !Number.isSafeInteger(file.offset) || file.offset < 0 || file.offset > total - file.bytes) throw new Error("v2-range-file");
    keys.add(file.key); rangesFor(shard, file.offset, file.bytes);
  }
  return shard;
}

function rangesFor(shard: RangeShard, offset: number, bytes: number) {
  const parts: Array<{ chunk: RangeBlob; offset: number; length: number }> = []; let start = 0; let remaining = bytes;
  for (const chunk of shard.archive.chunks) {
    const end = start + chunk.bytes;
    if (offset < end && remaining) {
      const local = Math.max(0, offset - start); const length = Math.min(chunk.bytes - local, remaining);
      parts.push({ chunk, offset: local, length }); remaining -= length; offset += length;
    }
    start = end;
  }
  if (remaining || !parts.length || parts.length > 2) throw new Error("v2-range-parts-budget");
  return parts;
}

export function pinnedRangeR2Loader(bucket: RangeBucket, rootReference: RangeBlob) {
  if (!blobValid(rootReference, RANGE_METADATA_LIMIT)) throw new Error("v2-range-root-pin");
  // Copy the caller's pin so later mutations cannot change the authority.
  const rootPin = { ...rootReference }; let operations = 0;
  const metadataCache = new Map<string, Uint8Array>(); let metadataBytes = 0;
  async function metadata(ref: RangeBlob) {
    const key = `${ref.sha256}:${ref.bytes}`; const hit = metadataCache.get(key);
    if (hit) { metadataCache.delete(key); metadataCache.set(key, hit); return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(hit)); }
    const object = await bucket.get(`semantic-blobs/sha256/${ref.sha256}`); if (!object) throw new Error("v2-range-metadata-missing");
    const bytes = await exactBody(object, ref.bytes, ref.bytes);
    if (await digest(bytes) !== ref.sha256) throw new Error("v2-range-metadata-hash");
    while (metadataBytes + bytes.length > 1024 * 1024 && metadataCache.size) { const first = metadataCache.keys().next().value!; metadataBytes -= metadataCache.get(first)!.length; metadataCache.delete(first); }
    const previous = metadataCache.get(key); if (previous) metadataBytes -= previous.length;
    metadataCache.set(key, bytes); metadataBytes += bytes.length;
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  return async (key: string, maximum: number) => {
    if (!keyValid(key) || !integer(maximum, RANGE_OBJECT_LIMIT)) throw new Error("v2-range-request");
    if (operations >= 4) throw new Error("v2-range-busy"); operations++;
    try {
      const root = validateRangeRoot(await metadata(rootPin)); const reference = root.shards.find(ref => key.startsWith(ref.prefix));
      if (!reference) throw new Error("v2-range-key-not-pinned");
      const shard = validateRangeShard(await metadata(reference), reference.prefix); const file = shard.files.find(item => item.key === key);
      if (!file || file.bytes > maximum) throw new Error("v2-range-key-not-pinned-or-budget");
      const output = new Uint8Array(file.bytes); let cursor = 0;
      for (const part of rangesFor(shard, file.offset, file.bytes)) {
        const range = { offset: part.offset, length: part.length };
        const object = await bucket.get(`semantic-blobs/sha256/${part.chunk.sha256}`, { range }); if (!object) throw new Error("v2-range-chunk-missing");
        const bytes = await exactBody(object, part.chunk.bytes, part.length, range); output.set(bytes, cursor); cursor += bytes.length;
      }
      if (cursor !== file.bytes || await digest(output) !== file.sha256) throw new Error("v2-range-file-integrity");
      return output;
    } finally { operations--; }
  };
}
