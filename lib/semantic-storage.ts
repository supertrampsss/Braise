// Server-only storage. Do not import into client components.
import { env } from "cloudflare:workers";
import hostingConfig from "@/.openai/hosting.json";
import index from "@/data/semantic-v1-index.json";

type ObjectLoader = (key: string) => Promise<ArrayBuffer | null>;
type TargetSegment = { scores: Int16Array; ranks: Uint16Array; order: Uint16Array; bytes: number };
type BucketObject = { arrayBuffer(): Promise<ArrayBuffer> };
type Bucket = { get(key: string): Promise<BucketObject | null> };
type Assets = { fetch(request: Request): Promise<Response> };

export class SemanticStorageError extends Error {
  constructor(public readonly code: "binding_missing" | "object_missing" | "read_failed" | "corrupt", detail: string) {
    super(detail); this.name = "SemanticStorageError";
  }
}

let testLoader: ObjectLoader | null = null;
export function setSemanticObjectLoaderForTests(loader: ObjectLoader | null) { testLoader = loader; clearSemanticCacheForTests(); }

export async function loadSemanticObjectFromRuntime(runtime: Record<string, unknown>, r2Binding: string | null, key: string) {
  if (r2Binding) {
    const bucket = runtime[r2Binding] as Bucket | undefined;
    if (!bucket?.get) throw new SemanticStorageError("binding_missing", `R2 binding ${r2Binding} is unavailable`);
    try {
      const object = await bucket.get(key);
      if (!object) throw new SemanticStorageError("object_missing", `Missing R2 semantic shard ${key}`);
      return await object.arrayBuffer();
    }
    catch (error) {
      if (error instanceof SemanticStorageError) throw error;
      throw new SemanticStorageError("read_failed", error instanceof Error ? error.message : "R2 read failed");
    }
  }
  const assets = runtime.ASSETS as Assets | undefined;
  if (!assets?.fetch) throw new SemanticStorageError("binding_missing", "Static semantic asset binding is unavailable");
  try {
    const response = await assets.fetch(new Request(new URL(`/${key}`, "https://braise-assets.invalid")));
    return response.ok ? await response.arrayBuffer() : null;
  } catch (error) { throw new SemanticStorageError("read_failed", error instanceof Error ? error.message : "Asset read failed"); }
}

async function runtimeLoad(key: string) {
  if (testLoader) return testLoader(key);
  return loadSemanticObjectFromRuntime(env as unknown as Record<string, unknown>, hostingConfig.r2, key);
}

const CACHE_BUDGET_BYTES = 4 * 1024 * 1024;
const MAX_CONCURRENT_LOADS = 4;
const MAX_PENDING_LOADS = 8;
const cache = new Map<string, TargetSegment>();
const inFlight = new Map<string, Promise<TargetSegment>>();
const waiters: (() => void)[] = [];
let cacheBytes = 0;
let activeLoads = 0;

async function takeLoadSlot() {
  if (activeLoads < MAX_CONCURRENT_LOADS) { activeLoads++; return; }
  // The releasing load transfers its slot directly; do not increment again.
  await new Promise<void>(resolve => waiters.push(resolve));
}
function releaseLoadSlot() {
  const next = waiters.shift();
  if (next) next(); else activeLoads--;
}
function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function sha256(bytes: ArrayBuffer) { return hex(await crypto.subtle.digest("SHA-256", bytes)); }
async function gunzip(bytes: ArrayBuffer) {
  const body = new Response(bytes).body;
  if (!body) throw new SemanticStorageError("corrupt", "Empty compressed shard");
  return new Response(body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

function parseSegment(raw: ArrayBuffer, targetIndex: number): TargetSegment {
  const view = new DataView(raw);
  if (raw.byteLength < 64 || String.fromCharCode(...new Uint8Array(raw, 0, 4)) !== "BRZ1") throw new SemanticStorageError("corrupt", "Invalid shard magic");
  const wordCount = view.getUint32(8, true);
  const scoresOffset = view.getUint32(20, true); const ranksOffset = view.getUint32(24, true); const orderOffset = view.getUint32(28, true);
  if (view.getUint16(4, true) !== 1 || view.getUint16(6, true) !== 0b111 || view.getUint32(12, true) !== targetIndex ||
      wordCount !== index.corpus.dictionarySize || scoresOffset !== 64 || ranksOffset !== scoresOffset + wordCount * 2 ||
      orderOffset !== ranksOffset + wordCount * 2 || view.getUint32(32, true) !== orderOffset + wordCount * 2 || raw.byteLength !== orderOffset + wordCount * 2) {
    throw new SemanticStorageError("corrupt", "Invalid shard header or dimensions");
  }
  const expectedTargetWord = index.segments[targetIndex].wordIndex;
  if (view.getUint32(16, true) !== expectedTargetWord) throw new SemanticStorageError("corrupt", "Shard target does not match manifest");
  const scores = new Int16Array(wordCount); const ranks = new Uint16Array(wordCount); const order = new Uint16Array(wordCount);
  for (let i = 0; i < wordCount; i++) { scores[i] = view.getInt16(scoresOffset + i * 2, true); ranks[i] = view.getUint16(ranksOffset + i * 2, true); order[i] = view.getUint16(orderOffset + i * 2, true); }
  return { scores, ranks, order, bytes: scores.byteLength + ranks.byteLength + order.byteLength };
}

async function loadSegment(targetIndex: number) {
  const manifest = index.segments[targetIndex];
  if (!manifest) throw new SemanticStorageError("corrupt", `Unknown target index ${targetIndex}`);
  const object = await runtimeLoad(manifest.key);
  if (!object) throw new SemanticStorageError("object_missing", `Missing semantic shard ${manifest.key}`);
  if (object.byteLength !== manifest.compressedBytes || await sha256(object) !== manifest.objectSha256) throw new SemanticStorageError("corrupt", `Compressed shard mismatch for ${manifest.key}`);
  let raw: ArrayBuffer;
  try { raw = await gunzip(object); }
  catch (error) { if (error instanceof SemanticStorageError) throw error; throw new SemanticStorageError("corrupt", `Cannot decompress ${manifest.key}`); }
  if (raw.byteLength !== manifest.rawBytes || await sha256(raw) !== manifest.rawSha256) throw new SemanticStorageError("corrupt", `Decoded shard mismatch for ${manifest.key}`);
  return parseSegment(raw, targetIndex);
}

export async function targetSegment(targetIndex: number) {
  const key = `${index.corpus.id}:${index.segments[targetIndex]?.objectSha256 ?? targetIndex}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (activeLoads + waiters.length >= MAX_PENDING_LOADS) throw new SemanticStorageError("read_failed", "Semantic storage is busy");
  const promise = (async () => {
    await takeLoadSlot();
    try {
      const value = await loadSegment(targetIndex);
      while (cacheBytes + value.bytes > CACHE_BUDGET_BYTES && cache.size) {
        const oldestKey = cache.keys().next().value!; const oldest = cache.get(oldestKey)!;
        cache.delete(oldestKey); cacheBytes -= oldest.bytes;
      }
      cache.set(key, value); cacheBytes += value.bytes;
      return value;
    } finally { releaseLoadSlot(); }
  })();
  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}

export function semanticCacheStats() { return { entries: cache.size, bytes: cacheBytes, budgetBytes: CACHE_BUDGET_BYTES, activeLoads, queuedLoads: waiters.length, inFlight: inFlight.size }; }
export function clearSemanticCacheForTests() { cache.clear(); inFlight.clear(); waiters.splice(0); cacheBytes = 0; activeLoads = 0; }
export const semanticStorageManifest = index;
