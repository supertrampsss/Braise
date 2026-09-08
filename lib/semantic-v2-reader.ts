// Server-only, transport-injected reader. No active product switch or V1 fallback.
export type V2Reference = { key: string; sha256: string };
export type V2Pins = { corpusId: string; manifestSha256: string; semanticSha256: string; dictionarySize: number; index: V2Reference; targets: Record<string, V2Reference> };
type Page = { file: string; count: number; rawBytes: number; compressedBytes: number; rawSha256: string; objectSha256: string; firstId: number };
type IndexRoot = { complete: boolean; format: string; corpus: { id: string; manifestSha256: string; semanticSha256: string; dictionarySize: number }; prefixPages: Array<{ firstByte: number; file: string; bytes: number; sha256: string }> };
type TargetRoot = { complete: boolean; format: string; corpus: IndexRoot["corpus"]; target: { id: number }; config: { contractHash: string }; stats: { dictionarySize: number }; valuePages: Page[] };
const encoder = new TextEncoder(); const decoder = new TextDecoder("utf-8", { fatal: true });
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
async function hash(bytes: Uint8Array) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))); }
const validHash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const fileName = (value: string) => typeof value === "string" && /^[a-zA-Z0-9._-]+$/.test(value) && value !== "." && value !== "..";
const parent = (key: string) => key.slice(0, key.lastIndexOf("/") + 1);
export function canonicalV2(value: string) { return value.trim().toLocaleLowerCase("fr").normalize("NFC").replace(/’/g, "'"); }
export class SemanticV2Reader {
  private operations = 0;
  private cache = new Map<string, Uint8Array>(); private bytes = 0; private pending = new Map<string, Promise<Uint8Array>>();
  constructor(private pins: V2Pins, private load: (key: string, maxBytes: number) => Promise<Uint8Array>, private budget = 8 * 1024 * 1024) {
    if (!validHash(pins.manifestSha256) || !validHash(pins.semanticSha256) || !Number.isSafeInteger(pins.dictionarySize) || pins.dictionarySize < 1 || pins.dictionarySize > 0xffffffff || budget < 4 * 1024 * 1024) throw new Error("invalid-v2-pins");
  }
  private async run<T>(action: () => Promise<T>) { if (this.operations >= 4) throw new Error("v2-reader-busy"); this.operations++; try { return await action(); } finally { this.operations--; } }
  lookup(input: string) { return this.run(() => this.lookupImpl(input)); }
  evaluate(target: number, wordId: number) { return this.run(() => this.evaluateImpl(target, wordId)); }
  private async object(reference: V2Reference, maximum: number) {
    if (!validHash(reference.sha256) || reference.key.startsWith("/") || reference.key.split("/").some(part => !fileName(part))) throw new Error("invalid-v2-reference");
    const identity = `${reference.key}:${reference.sha256}`; const hit = this.cache.get(identity);
    if (hit) { if (hit.length > maximum) throw new Error("v2-object-too-large"); this.cache.delete(identity); this.cache.set(identity, hit); return hit; }
    const existing = this.pending.get(identity); if (existing) { const value = await existing; if (value.length > maximum) throw new Error("v2-object-too-large"); return value; }
    if (this.pending.size >= 4) throw new Error("v2-reader-busy");
    const work = (async () => {
      const loaded = await this.load(reference.key, maximum);
      if (loaded.length > maximum) throw new Error("v2-object-too-large");
      const bytes = new Uint8Array(loaded);
      if (!bytes.length || bytes.length > maximum || await hash(bytes) !== reference.sha256) throw new Error("v2-object-integrity");
      while (this.bytes + bytes.length > this.budget && this.cache.size) { const key = this.cache.keys().next().value!; this.bytes -= this.cache.get(key)!.length; this.cache.delete(key); }
      if (bytes.length <= this.budget) { this.cache.set(identity, bytes); this.bytes += bytes.length; }
      return bytes;
    })();
    this.pending.set(identity, work); try { return await work; } finally { this.pending.delete(identity); }
  }
  private matches(corpus: IndexRoot["corpus"]) { return corpus?.id === this.pins.corpusId && corpus.manifestSha256 === this.pins.manifestSha256 && corpus.semanticSha256 === this.pins.semanticSha256 && corpus.dictionarySize === this.pins.dictionarySize; }
  private async unpack(key: string, page: Page) {
    if (!fileName(page.file) || !Number.isInteger(page.rawBytes) || page.rawBytes < 64 || page.rawBytes > 4 * 1024 * 1024 || !Number.isInteger(page.compressedBytes) || page.compressedBytes < 1 || page.compressedBytes > 4 * 1024 * 1024 + 65536 || !validHash(page.rawSha256)) throw new Error("invalid-v2-page");
    const compressed = await this.object({ key, sha256: page.objectSha256 }, page.compressedBytes);
    if (compressed.length !== page.compressedBytes) throw new Error("v2-page-size");
    const stream = new Blob([compressed as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > page.rawBytes) { await reader.cancel(); throw new Error("v2-decompression-budget"); } chunks.push(value); } } finally { reader.releaseLock(); }
    if (length !== page.rawBytes) throw new Error("v2-page-size"); const raw = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
    if (await hash(raw) !== page.rawSha256) throw new Error("v2-page-integrity"); return raw;
  }
  private async lookupImpl(input: string) {
    if (typeof input !== "string" || input.length > 65536) throw new Error("v2-input-too-long");
    if (encoder.encode(input).length > 65536) throw new Error("v2-input-too-long");
    const word = canonicalV2(input); if (word.length < 2 || !/^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u.test(word)) return null;
    const root = JSON.parse(decoder.decode(await this.object(this.pins.index, 256 * 1024))) as IndexRoot;
    if (!root.complete || root.format !== "BPI2-hash-pages" || !this.matches(root.corpus) || !Array.isArray(root.prefixPages) || root.prefixPages.length > 256) throw new Error("v2-index-contract");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(word))); const ref = root.prefixPages.find(page => page.firstByte === digest[0]); if (!ref) return null;
    if (!fileName(ref.file) || !Number.isInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > 4 * 1024 * 1024) throw new Error("v2-prefix-reference");
    const prefixBytes = await this.object({ key: `${parent(this.pins.index.key)}prefixes/${ref.file}`, sha256: ref.sha256 }, ref.bytes);
    if (prefixBytes.length !== ref.bytes) throw new Error("v2-prefix-size");
    const prefix = JSON.parse(decoder.decode(prefixBytes)) as { firstByte: number; corpusManifestSha256: string; leaves: Array<Page & { secondByte: number }> };
    if (prefix.firstByte !== digest[0] || prefix.corpusManifestSha256 !== this.pins.manifestSha256 || !Array.isArray(prefix.leaves) || prefix.leaves.length > 256) throw new Error("v2-prefix-contract");
    const page = prefix.leaves.find(leaf => leaf.secondByte === digest[1]); if (!page) return null;
    const raw = await this.unpack(`${parent(this.pins.index.key)}leaves/${page.file}`, page); const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (decoder.decode(raw.subarray(0, 4)) !== "BPI2" || view.getUint16(4, true) !== 2 || view.getUint16(6, true) !== 1 || raw[8] !== digest[0] || raw[9] !== digest[1] || view.getUint32(12, true) !== page.count || view.getUint32(16, true) !== 64 || view.getUint32(20, true) !== 64 + page.count * 4 || view.getUint32(24, true) !== raw.length || hex(raw.subarray(32, 48)) !== this.pins.manifestSha256.slice(0, 32) || hex(raw.subarray(48, 64)) !== this.pins.semanticSha256.slice(0, 32)) throw new Error("v2-index-page");
    for (let i = 0; i < page.count; i++) {
      const offset = view.getUint32(64 + i * 4, true); const next = i + 1 < page.count ? view.getUint32(64 + (i + 1) * 4, true) : raw.length;
      if (offset < 64 + page.count * 4 || offset + 8 > next || next > raw.length || offset + 8 + view.getUint32(offset, true) !== next) throw new Error("v2-index-record");
      const id = view.getUint32(offset + 4, true); if (id >= this.pins.dictionarySize) throw new Error("v2-index-id");
      if (decoder.decode(raw.subarray(offset + 8, next)) === word) return { id, word };
    }
    return null;
  }
  private async evaluateImpl(target: number, wordId: number) {
    if (![target, wordId].every(id => Number.isInteger(id) && id >= 0 && id < this.pins.dictionarySize)) throw new Error("v2-id-range");
    const reference = this.pins.targets[String(target)]; if (!reference) throw new Error("v2-target-not-prepared");
    const manifest = JSON.parse(decoder.decode(await this.object(reference, 1024 * 1024))) as TargetRoot;
    if (!manifest.complete || manifest.format !== "BRT2-pages" || !this.matches(manifest.corpus) || manifest.target.id !== target || manifest.stats.dictionarySize !== this.pins.dictionarySize || !validHash(manifest.config.contractHash) || !Array.isArray(manifest.valuePages)) throw new Error("v2-target-contract");
    let nextId = 0; for (const page of manifest.valuePages) { if (page.firstId !== nextId || !Number.isInteger(page.count) || page.count < 1 || page.count > 262144) throw new Error("v2-target-coverage"); nextId += page.count; }
    if (nextId !== this.pins.dictionarySize) throw new Error("v2-target-coverage");
    const page = manifest.valuePages.find(item => wordId >= item.firstId && wordId < item.firstId + item.count)!;
    const raw = await this.unpack(`${parent(reference.key)}pages/${page.file}`, page); const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (decoder.decode(raw.subarray(0, 4)) !== "BSV2" || view.getUint16(4, true) !== 2 || view.getUint16(6, true) !== 3 || view.getUint32(8, true) !== target || view.getUint32(12, true) !== page.firstId || view.getUint32(16, true) !== page.count || view.getUint32(20, true) !== this.pins.dictionarySize || view.getUint32(24, true) !== 64 || view.getUint32(28, true) !== 64 + page.count * 2 || view.getUint32(32, true) !== raw.length || raw.length !== 64 + page.count * 6 || hex(raw.subarray(40, 56)) !== this.pins.manifestSha256.slice(0, 32) || hex(raw.subarray(56, 64)) !== manifest.config.contractHash.slice(0, 16)) throw new Error("v2-score-page");
    const index = wordId - page.firstId; const score = view.getInt16(64 + index * 2, true); const rank = view.getUint32(64 + page.count * 2 + index * 4, true);
    if (score < -10000 || score > 10000 || rank < 1 || rank > this.pins.dictionarySize || (wordId === target && (score !== 10000 || rank !== 1))) throw new Error("v2-score-range");
    const found = wordId === target;
    // Quantization can tie another vector at 10,000. Only exact identity wins.
    return { temperature: found ? 100 : Math.min(score / 100, 99.9), rank, found };
  }
}
