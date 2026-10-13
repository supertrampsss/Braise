import { createHash } from "node:crypto";
import { open, mkdir, readFile, lstat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { checkRuntimeArchive } from "./semantic-runtime-archive.mjs";
import { loadActiveCorpus, sha256, installImmutable } from "./semantic-target-v2-common.mjs";
import { canonicalDirectoryWithoutLinks } from "./semantic-paths.mjs";

const CHUNK = 8 * 1024 * 1024, META = 256 * 1024, OBJECT = 4 * 1024 * 1024 + 65536;
const HASH = /^[a-f0-9]{64}$/;
const safeName = name => typeof name === "string" && name.length <= 512 && /^[a-zA-Z0-9._/-]+$/.test(name) && name.split("/").every(p => p && p !== "." && p !== "..");
const jsonBytes = value => Buffer.from(JSON.stringify(value) + "\n");
async function exactRead(handle, size, position) {
  const bytes = Buffer.alloc(size); let filled = 0;
  while (filled < size) { const { bytesRead } = await handle.read(bytes, filled, size - filled, position + filled); if (!bytesRead) throw new Error("Truncated range archive"); filled += bytesRead; }
  return bytes;
}
const tarString = bytes => bytes.toString("utf8").replace(/\0.*$/s, "");
function tarNumber(bytes) { const text = tarString(bytes).trim(); if (!/^[0-7]+$/.test(text)) throw new Error("Invalid TAR octal field"); const value = parseInt(text, 8); if (!Number.isSafeInteger(value)) throw new Error("Unsafe TAR integer"); return value; }

// Deliberately accepts only the ordinary regular/directory USTAR subset used by
// our canonical backups; no links, PAX rewrites, sparse files or long-name state.
export async function indexCanonicalTar(path, expected) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== expected.bytes || !HASH.test(expected.sha256) || !Array.isArray(expected.chunks) || !expected.chunks.length || expected.chunks.length > 32) throw new Error("Invalid canonical archive pin");
  const handle = await open(path, "r"); const files = []; const names = new Set();
  try {
    const full = createHash("sha256"); let position = 0;
    for (const chunk of expected.chunks) {
      if (!HASH.test(chunk.sha256) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > CHUNK || position + chunk.bytes > info.size) throw new Error("Invalid archive chunk");
      const bytes = await exactRead(handle, chunk.bytes, position); if (sha256(bytes) !== chunk.sha256) throw new Error("Archive chunk hash mismatch"); full.update(bytes); position += bytes.length;
    }
    if (position !== info.size || full.digest("hex") !== expected.sha256) throw new Error("Canonical archive hash mismatch");
    position = 0; let terminated = false;
    while (position + 512 <= info.size) {
      const header = await exactRead(handle, 512, position);
      if (header.every(byte => byte === 0)) {
        // Require both end markers and only zero padding afterwards.
        if (position + 1024 > info.size) throw new Error("Missing TAR end markers");
        for (let at = position; at < info.size; at += CHUNK) if (!(await exactRead(handle, Math.min(CHUNK, info.size - at), at)).every(byte => byte === 0)) throw new Error("Nonzero TAR trailing data");
        terminated = true; break;
      }
      const checksum = tarNumber(header.subarray(148, 156)); const checked = Buffer.from(header); checked.fill(32, 148, 156);
      if (checked.reduce((sum, byte) => sum + byte, 0) !== checksum) throw new Error("TAR header checksum mismatch");
      const base = tarString(header.subarray(0, 100)), prefix = tarString(header.subarray(345, 500));
      const type = header[156]; const pathName = `${prefix ? prefix + "/" : ""}${base}`.replace(/\/$/, "");
      const bytes = tarNumber(header.subarray(124, 136)); const offset = position + 512;
      if (tarString(header.subarray(257, 263)) !== "ustar" || !safeName(pathName) || names.has(pathName) || bytes > OBJECT || offset + Math.ceil(bytes / 512) * 512 > info.size || ![0, 48, 53].includes(type) || type === 53 && bytes !== 0 || tarString(header.subarray(157, 257))) throw new Error("Unsafe or unsupported TAR entry");
      names.add(pathName);
      if (type !== 53) {
        if (!bytes) throw new Error("Empty runtime object");
        files.push({ path: pathName, offset, bytes, sha256: sha256(await exactRead(handle, bytes, offset)) });
      }
      position = offset + Math.ceil(bytes / 512) * 512;
    }
    if (!terminated || !files.length) throw new Error("Incomplete TAR archive");
    const after = await handle.stat(); if (after.size !== info.size || after.mtimeMs !== info.mtimeMs) throw new Error("Archive changed during indexing");
    return { archive: { bytes: info.size, chunks: expected.chunks.map(c => ({ sha256: c.sha256, bytes: c.bytes })) }, files };
  } finally { await handle.close(); }
}

function tarHeader(name, size) {
  if (!safeName(name) || Buffer.byteLength(name) > 100) throw new Error("Unsupported target TAR path");
  const header = Buffer.alloc(512); header.write(name); header.write("0000644\0", 100); header.write("0000000\0", 108); header.write("0000000\0", 116);
  header.write(size.toString(8).padStart(11, "0") + "\0", 124); header.write("00000000000\0", 136); header.fill(32, 148, 156); header[156] = 48;
  header.write("ustar\0", 257); header.write("00", 263);
  header.write(header.reduce((s, b) => s + b, 0).toString(8).padStart(6, "0") + "\0 ", 148);
  return header;
}

export async function packRuntimeTarget({ archiveDir, corpus, targetId, outputDir }) {
  const inventory = await checkRuntimeArchive({ archiveDir, corpus, targetId }); const parts = []; const files = []; let position = 0;
  // Preserve all 35 canonical objects (including evidence) in the immutable pack.
  for (const item of [...inventory.objects].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    const bytes = await readFile(join(inventory.root, item.path)); if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error("Runtime object changed during packaging");
    parts.push(tarHeader(item.path, bytes.length), bytes); position += 512;
    files.push({ path: item.path, offset: position, bytes: bytes.length, sha256: item.sha256 });
    const padding = (512 - bytes.length % 512) % 512; parts.push(Buffer.alloc(padding)); position += bytes.length + padding;
    if (position + 1024 >= CHUNK) throw new Error("Target TAR must be strictly smaller than 8MiB");
  }
  parts.push(Buffer.alloc(1024)); const bytes = Buffer.concat(parts); const hash = sha256(bytes);
  const rechecked = await checkRuntimeArchive({ archiveDir, corpus, targetId }); if (rechecked.inventorySha256 !== inventory.inventorySha256) throw new Error("Runtime inventory changed");
  await installImmutable(join(outputDir, `${hash}.blob`), bytes);
  return { archive: { bytes: bytes.length, chunks: [{ sha256: hash, bytes: bytes.length }] }, files, targetManifestSha256: inventory.targetManifestSha256, inventorySha256: inventory.inventorySha256 };
}

export async function buildSemanticRangePack({ corpusDir, presenceTar, presenceInventoryPath, archiveDir, targetIds, outputDir }) {
  if (!Array.isArray(targetIds) || !targetIds.length || targetIds.length > 1024 || new Set(targetIds).size !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0)) throw new Error("Invalid range pack targets");
  const ids = [...targetIds]; const corpus = await loadActiveCorpus(corpusDir); const expected = JSON.parse(await readFile(presenceInventoryPath, "utf8"));
  if (expected.complete !== true) throw new Error("Presence backup is incomplete");
  await mkdir(outputDir, { recursive: true }); await canonicalDirectoryWithoutLinks(outputDir);
  const presence = await indexCanonicalTar(presenceTar, expected); const base = `${corpus.manifest.corpusId}/presence/`;
  const handle = await open(presenceTar, "r"); let active;
  try {
    const file = presence.files.find(f => f.path === "active.json"); if (!file) throw new Error("Missing presence active");
    const bytes = await exactRead(handle, file.bytes, file.offset); if (sha256(bytes) !== file.sha256) throw new Error("Presence active changed");
    active = JSON.parse(bytes.toString("utf8"));
    const ref = presence.files.find(f => f.path === active.manifest);
    if (!ref || ref.bytes > META || ref.sha256 !== active.manifestSha256 || active.corpusId !== corpus.manifest.corpusId) throw new Error("Presence manifest identity mismatch");
    const manifestBytes = await exactRead(handle, ref.bytes, ref.offset); if (sha256(manifestBytes) !== ref.sha256) throw new Error("Presence manifest changed");
    const manifest = JSON.parse(manifestBytes.toString("utf8")); const identity = manifest.corpus;
    if (manifest.complete !== true || manifest.format !== "BPI2-hash-pages" || identity?.id !== corpus.manifest.corpusId || identity.manifestSha256 !== corpus.manifestSha256 || identity.semanticSha256 !== corpus.manifest.semanticSha256 || identity.dictionarySize !== corpus.manifest.stats.accepted) throw new Error("Presence corpus mismatch");
  }
  finally { await handle.close(); }
  const manifest = presence.files.find(f => f.path === active.manifest);
  if (!manifest || manifest.sha256 !== active.manifestSha256) throw new Error("Presence manifest identity mismatch");
  const groups = new Map(); const shards = []; const receipts = [];
  for (const file of presence.files) {
    let prefix;
    if (/^leaves\/leaf-[a-f0-9]{4}-[a-f0-9]{16}\.bpi\.gz$/.test(file.path)) prefix = base + file.path.slice(0, "leaves/leaf-00".length);
    else if (/^prefixes\/prefix-[a-f0-9]{2}-[a-f0-9]{16}\.json$/.test(file.path)) prefix = base + "prefixes/";
    else if (file.path === "active.json" || file.path === active.manifest) prefix = base + file.path;
    else throw new Error("Unexpected presence archive object");
    const values = groups.get(prefix) ?? []; values.push({ key: base + file.path, offset: file.offset, bytes: file.bytes, sha256: file.sha256 }); groups.set(prefix, values);
  }
  async function persistShard(prefix, archive, files) {
    const value = { schemaVersion: 1, format: "BRT2-range-shard", archive, files }; const bytes = jsonBytes(value);
    if (bytes.length > META || files.length > 1024) throw new Error("Range shard exceeds metadata budget");
    const sha = sha256(bytes); await installImmutable(join(outputDir, `${sha}.blob`), bytes); shards.push({ prefix, bytes: bytes.length, sha256: sha });
  }
  for (const [prefix, files] of groups) await persistShard(prefix, presence.archive, files);
  const targets = {};
  for (const targetId of ids) {
    const packed = await packRuntimeTarget({ archiveDir, corpus, targetId, outputDir }); const prefix = `${corpus.manifest.corpusId}/targets/${String(targetId).padStart(10, "0")}/`;
    const targetManifest = packed.files.find(f => f.path.startsWith("manifest-") && f.sha256 === packed.targetManifestSha256); if (!targetManifest) throw new Error("Target pin missing");
    await persistShard(prefix, packed.archive, packed.files.map(file => ({ key: prefix + file.path, offset: file.offset, bytes: file.bytes, sha256: file.sha256 })));
    targets[String(targetId)] = { key: prefix + targetManifest.path, sha256: targetManifest.sha256 };
    receipts.push({ targetId, ...packed.archive, targetManifestSha256: packed.targetManifestSha256, inventorySha256: packed.inventorySha256 });
  }
  const rootBytes = jsonBytes({ schemaVersion: 1, format: "BRT2-range-root", shards }); if (rootBytes.length > META || shards.length > 1024) throw new Error("Range root exceeds metadata budget");
  const rootReference = { sha256: sha256(rootBytes), bytes: rootBytes.length }; await installImmutable(join(outputDir, `${rootReference.sha256}.blob`), rootBytes);
  const after = await loadActiveCorpus(corpusDir); if (after.manifestSha256 !== corpus.manifestSha256) throw new Error("Corpus changed during range packaging");
  const result = { schemaVersion: 1, rootReference, pins: { corpusId: corpus.manifest.corpusId, manifestSha256: corpus.manifestSha256, semanticSha256: corpus.manifest.semanticSha256, dictionarySize: corpus.manifest.stats.accepted, index: { key: base + active.manifest, sha256: active.manifestSha256 }, targets }, presenceBackup: expected, targetPacks: receipts };
  await installImmutable(join(outputDir, `pack-${rootReference.sha256}.json`), jsonBytes(result)); return result;
}

if (process.argv[1] && basename(process.argv[1]) === "build-semantic-range-pack-v2.mjs") {
  const [optionsPath] = process.argv.slice(2);
  if (!optionsPath) throw new Error("Usage: build-semantic-range-pack-v2.mjs options.json (no credentials)");
  buildSemanticRangePack(JSON.parse(await readFile(resolve(optionsPath), "utf8"))).then(result => console.log(JSON.stringify({ rootReference: result.rootReference, targets: result.targetPacks.length }))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
