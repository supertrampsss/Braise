// Server-only: this complete vocabulary must never enter a client bundle.
import { env } from "cloudflare:workers";
import index from "@/data/word2vec-index.json";
import type { WordEvaluation } from "./game-contracts";

export const word2vecMetadata = { corpusVersion: index.corpusVersion, vocabularySize: index.vocabularySize };
export const word2vecTargets = index.targets.map(target => target.word);
export const word2vecLegacyTargets = index.legacyTargets;
export class Word2vecStorageError extends Error {
  constructor(public readonly code: "binding_missing" | "object_missing" | "read_failed" | "corrupt", detail: string) {
    super(detail); this.name = "Word2vecStorageError";
  }
}

type ObjectLoader = (key: string) => Promise<ArrayBuffer | null>;
type Column = { scores: Int16Array; ranks: Uint32Array; bytes: number };
type Target = typeof index.targets[number];
type Assets = { fetch(request: Request): Promise<Response> };
const normalize = (input: string) => input.trim().toLocaleLowerCase("fr").normalize("NFC").replace(/’/g, "'");
const words = new Map<string, number>();
for (let id = 0; id < index.words.length; id++) if (!words.has(index.words[id])) words.set(index.words[id], id);
const targets = new Map(index.targets.map(target => [target.word, target]));
const CACHE_BUDGET_BYTES = 4 * 1024 * 1024;
const MAX_LOADS = 4;
const cache = new Map<string, Column>();
const inFlight = new Map<string, Promise<Column>>();
let cacheBytes = 0;
let activeLoads = 0;
let testLoader: ObjectLoader | null = null;

export function word2vecAvailable(targetWord: string) { return targets.has(normalize(targetWord)); }

export async function loadWord2vecObjectFromRuntime(runtime: Record<string, unknown>, key: string): Promise<ArrayBuffer | null> {
  const assets = runtime.ASSETS as Assets | undefined;
  if (!assets?.fetch) throw new Word2vecStorageError("binding_missing", "Word2Vec ASSETS binding is unavailable");
  try {
    const response = await assets.fetch(new Request(new URL(`/${key}`, "http://localhost")));
    return response.ok ? await response.arrayBuffer() : null;
  } catch (error) {
    throw new Word2vecStorageError("read_failed", error instanceof Error ? error.message : "Word2Vec asset read failed");
  }
}

async function sha256(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function gunzipBounded(bytes: ArrayBuffer, expectedBytes: number) {
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const raw = new Uint8Array(expectedBytes);
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expectedBytes) throw new Word2vecStorageError("corrupt", "Word2Vec decoded object exceeds its declared size");
      raw.set(value, offset); offset += value.byteLength;
    }
    if (offset !== expectedBytes) throw new Word2vecStorageError("corrupt", "Word2Vec decoded object is truncated");
    return raw.buffer;
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof Word2vecStorageError) throw error;
    throw new Word2vecStorageError("corrupt", "Word2Vec object cannot be decompressed");
  } finally { reader.releaseLock(); }
}

function parseColumn(raw: ArrayBuffer, target: Target): Column {
  const count = index.vocabularySize;
  const ranksOffset = 32 + count * 2;
  const view = new DataView(raw);
  if (raw.byteLength !== 32 + count * 6 || String.fromCharCode(...new Uint8Array(raw, 0, 4)) !== "BWS1" ||
      view.getUint32(4, true) !== 1 || view.getUint32(8, true) !== count || view.getUint32(12, true) !== target.wordId ||
      view.getUint32(16, true) !== 32 || view.getUint32(20, true) !== ranksOffset || view.getUint32(24, true) !== raw.byteLength || view.getUint32(28, true) !== 0) {
    throw new Word2vecStorageError("corrupt", "Word2Vec binary header differs from its manifest");
  }
  const scores = new Int16Array(count);
  const ranks = new Uint32Array(count);
  for (let id = 0; id < count; id++) {
    scores[id] = view.getInt16(32 + id * 2, true);
    ranks[id] = view.getUint32(ranksOffset + id * 4, true);
    if (scores[id] < -10000 || scores[id] > (id === target.wordId ? 10000 : 9999) || ranks[id] < 1 || ranks[id] > count) {
      throw new Word2vecStorageError("corrupt", "Word2Vec score or rank is out of bounds");
    }
  }
  if (scores[target.wordId] !== 10000 || ranks[target.wordId] !== 1) throw new Word2vecStorageError("corrupt", "Word2Vec target identity is invalid");
  return { scores, ranks, bytes: scores.byteLength + ranks.byteLength };
}

async function loadColumn(target: Target): Promise<Column> {
  const object = testLoader ? await testLoader(target.key) : await loadWord2vecObjectFromRuntime(env as unknown as Record<string, unknown>, target.key);
  if (!object) throw new Word2vecStorageError("object_missing", `Missing Word2Vec object ${target.key}`);
  if (object.byteLength !== target.compressedBytes || await sha256(object) !== target.objectSha256) throw new Word2vecStorageError("corrupt", "Word2Vec compressed object differs from its manifest");
  const raw = await gunzipBounded(object, target.rawBytes);
  if (await sha256(raw) !== target.rawSha256) throw new Word2vecStorageError("corrupt", "Word2Vec decoded object differs from its manifest");
  return parseColumn(raw, target);
}

async function column(target: Target) {
  const key = target.objectSha256;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (activeLoads >= MAX_LOADS) throw new Word2vecStorageError("read_failed", "Word2Vec storage is busy");
  activeLoads++;
  const promise = (async () => {
    try {
      const value = await loadColumn(target);
      while (cacheBytes + value.bytes > CACHE_BUDGET_BYTES && cache.size) {
        const oldestKey = cache.keys().next().value!;
        cacheBytes -= cache.get(oldestKey)!.bytes; cache.delete(oldestKey);
      }
      cache.set(key, value); cacheBytes += value.bytes;
      return value;
    } catch (error) {
      if (error instanceof Word2vecStorageError) throw error;
      throw new Word2vecStorageError("read_failed", error instanceof Error ? error.message : "Word2Vec load failed");
    } finally { activeLoads--; }
  })();
  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}

export async function evaluateWord2vec(targetWord: string, input: string): Promise<WordEvaluation | null> {
  const target = targets.get(normalize(targetWord));
  if (!target) throw new Word2vecStorageError("object_missing", "Word2Vec secret is not available");
  const id = words.get(normalize(input));
  if (id === undefined) return null;
  const { scores, ranks } = await column(target);
  const found = id === target.wordId;
  return { word: index.words[id], temperature: found ? 100 : scores[id] / 100, rank: ranks[id], found };
}

// The only injection is the same transport seam used by the historical reader.
export function setWord2vecObjectLoaderForTests(loader: ObjectLoader | null) {
  if (activeLoads) throw new Error("Cannot replace the Word2Vec transport while loading");
  testLoader = loader; cache.clear(); inFlight.clear(); cacheBytes = 0;
}
export function word2vecCacheStats() { return { bytes: cacheBytes, entries: cache.size, activeLoads, inFlight: inFlight.size, budgetBytes: CACHE_BUDGET_BYTES }; }
