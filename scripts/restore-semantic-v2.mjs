import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { buildSemanticCorpus } from "./build-semantic-corpus-v2.mjs";
import { verifySemanticCorpus } from "./verify-semantic-corpus-v2.mjs";
import { buildSemanticIndex } from "./build-semantic-index-v2.mjs";
import { verifySemanticIndex } from "./verify-semantic-index-v2.mjs";
import { verifyEditorialCatalogue } from "./verify-editorial-catalogue-v2.mjs";

export const PINNED_CORPUS = Object.freeze({
  url: "https://dl.fbaipublicfiles.com/fasttext/vectors-wiki/wiki.fr.vec",
  file: "wiki.fr.vec",
  bytes: 3_027_096_151,
  sha256: "bc68b0703375da9e81c3c11d0c28f3f8375dd944c209e697c4075e579455ac2a",
  corpusId: "fr-fasttext-complete-bc68b0703375-0f34b2449278",
  rowsRead: 1_152_449,
  accepted: 1_013_881,
  segments: 248,
  manifestSha256: "e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7",
  semanticSha256: "8440d4e963ae309c5761818a58bcf752d1aa5750b6b6876d94a055ca177f732d",
  indexEntries: 1_013_881,
  indexLeaves: 65_536,
  indexManifestSha256: "77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426",
});

async function sha256Handle(handle) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream("", { fd: handle.fd, autoClose: false, start: 0 })) hash.update(chunk);
  return hash.digest("hex");
}

/** @typedef {{bytes:number, sha256:string}} SourcePin */
/** @typedef {SourcePin & {url:string}} DownloadPin */

/** @param {string} path @param {SourcePin} [pin] */
export async function verifyPinnedFile(path, pin = PINNED_CORPUS) {
  let handle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if (error?.code === "ELOOP") throw new Error("Pinned source must be a regular non-symlink file"); throw error; }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("Pinned source must be a regular non-symlink file");
    if (info.size !== pin.bytes) throw new Error(`Pinned source size mismatch: expected ${pin.bytes}, received ${info.size}`);
    const digest = await sha256Handle(handle);
    if (digest !== pin.sha256) throw new Error(`Pinned source SHA-256 mismatch: expected ${pin.sha256}, received ${digest}`);
    return { path: resolve(path), bytes: info.size, sha256: digest };
  } finally { await handle.close(); }
}

async function acquireDownloadLock(sourcePath, recoverOwner = null) {
  const lockPath = `${sourcePath}.download.lock`;
  const guardPath = `${sourcePath}.download-guard.sqlite`; let guard;
  try {
    guard = new DatabaseSync(guardPath);
    guard.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS download_guard(id INTEGER PRIMARY KEY);");
  } catch {
    try { guard?.close(); } catch {}
    throw new Error(`Another source restore or recovery owns ${sourcePath}`);
  }
  let existing = null;
  try { existing = JSON.parse(await readFile(lockPath, "utf8")); }
  catch (error) {
    if (error?.code !== "ENOENT") {
      try { guard.exec("ROLLBACK"); } catch {} try { guard.close(); } catch {}
      throw new Error("Source download lock is unreadable and must not be removed automatically");
    }
  }
  try {
    if (existing) {
      if (!recoverOwner || existing.owner !== recoverOwner || !Number.isSafeInteger(existing.pid) || existing.pid < 1) throw new Error(`Another source restore owns ${lockPath}`);
      let alive = true;
      try { process.kill(existing.pid, 0); }
      catch (error) { if (error?.code === "ESRCH") alive = false; else throw error; }
      if (alive) throw new Error(`Source restore lock owner ${recoverOwner} is still running`);
    }
    const owner = randomUUID(); const temporary = `${lockPath}.tmp-${process.pid}-${Date.now()}`;
    const handle = await open(temporary, "wx");
    try { await handle.writeFile(`${JSON.stringify({ schemaVersion: 1, owner, pid: process.pid, sourcePath: resolve(sourcePath), createdAt: new Date().toISOString() })}\n`); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, lockPath);
    return { guard, lockPath, owner };
  } catch (error) {
    try { guard.exec("ROLLBACK"); } catch {} try { guard.close(); } catch {}
    throw error;
  }
}

async function releaseDownloadLock(lock) {
  if (!lock) return;
  try {
    const current = JSON.parse(await readFile(lock.lockPath, "utf8"));
    if (current.owner === lock.owner) await unlink(lock.lockPath);
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  finally { try { lock.guard.exec("ROLLBACK"); } catch {} try { lock.guard.close(); } catch {} }
}

async function verifyPinnedHandle(handle, pin) {
  const info = await handle.stat();
  if (!info.isFile()) throw new Error("Partial source must be a regular non-symlink file");
  if (info.size !== pin.bytes) throw new Error(`Pinned source download incomplete: ${info.size}/${pin.bytes} bytes`);
  const digest = await sha256Handle(handle);
  if (digest !== pin.sha256) throw new Error(`Pinned source SHA-256 mismatch: expected ${pin.sha256}, received ${digest}`);
  return { info, digest };
}

async function installVerifiedPartial(handle, partialPath, sourcePath, pin) {
  const verified = await verifyPinnedHandle(handle, pin);
  await link(partialPath, sourcePath);
  const installed = await lstat(sourcePath);
  if (!installed.isFile() || installed.isSymbolicLink() || installed.dev !== verified.info.dev || installed.ino !== verified.info.ino) {
    await unlink(sourcePath).catch(() => {});
    throw new Error("Pinned source changed before atomic installation");
  }
  await unlink(partialPath);
  return { path: sourcePath, bytes: verified.info.size, sha256: verified.digest };
}

/** @returns {Promise<never>} */
async function rejectDownloadResponse(response, message) {
  try { await response.body?.cancel(); } catch {}
  throw new Error(message);
}

/** @param {string} sourcePath @param {{pin?:DownloadPin, recoverOwner?:string|null, fetchImpl?:typeof fetch}} [options] */
export async function downloadPinnedSource(sourcePath, options = {}) {
  const { pin = PINNED_CORPUS, recoverOwner = null, fetchImpl = fetch } = options;
  sourcePath = resolve(sourcePath);
  await mkdir(dirname(sourcePath), { recursive: true });
  try { return { ...(await verifyPinnedFile(sourcePath, pin)), downloaded: false }; }
  catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const lock = await acquireDownloadLock(sourcePath, recoverOwner);
  const partialPath = `${sourcePath}.part`;
  let destination;
  try {
    try { destination = await open(partialPath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600); }
    catch (error) { if (error?.code === "ELOOP") throw new Error("Partial source must be a regular non-symlink file"); throw error; }
    const partialInfo = await destination.stat();
    if (!partialInfo.isFile()) throw new Error("Partial source must be a regular non-symlink file");
    let offset = partialInfo.size;
    if (offset > pin.bytes) throw new Error("Partial source exceeds pinned byte size and is not adopted");
    if (offset === pin.bytes) {
      const verified = await installVerifiedPartial(destination, partialPath, sourcePath, pin);
      return { ...verified, downloaded: true, resumedAt: offset };
    }
    const headers = offset > 0 ? { Range: `bytes=${offset}-` } : undefined;
    const response = await fetchImpl(pin.url, { headers, redirect: "follow" });
    if (!response.ok || !response.body) await rejectDownloadResponse(response, `Pinned source download failed with HTTP ${response.status}`);
    let append = offset > 0 && response.status === 206;
    if (append) {
      const contentRange = response.headers.get("content-range");
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange ?? "");
      if (!match || Number(match[1]) !== offset || Number(match[3]) !== pin.bytes) await rejectDownloadResponse(response, "Pinned source resume range is inconsistent");
    } else if (response.status !== 200) await rejectDownloadResponse(response, `Pinned source server returned unsupported HTTP ${response.status}`);
    if (!append) offset = 0;
    const declaredHeader = response.headers.get("content-length");
    if (declaredHeader !== null && !/^\d+$/.test(declaredHeader)) await rejectDownloadResponse(response, "Pinned source Content-Length is invalid");
    const declared = declaredHeader === null ? null : Number(declaredHeader);
    if (declared !== null && (!Number.isSafeInteger(declared) || declared > pin.bytes - offset)) await rejectDownloadResponse(response, "Pinned source response exceeds the expected size");
    if (!append) { await destination.truncate(0); offset = 0; }
    const remaining = pin.bytes - offset; let received = 0; let position = offset;
    for await (const value of response.body) {
      const chunk = Buffer.from(value);
      if (received + chunk.length > remaining) throw new Error("Pinned source response exceeds the expected size");
      let chunkOffset = 0;
      while (chunkOffset < chunk.length) {
        const { bytesWritten } = await destination.write(chunk, chunkOffset, chunk.length - chunkOffset, position);
        if (bytesWritten < 1) throw new Error("Pinned source write made no progress");
        chunkOffset += bytesWritten; position += bytesWritten;
      }
      received += chunk.length;
    }
    await destination.sync();
    const verified = await installVerifiedPartial(destination, partialPath, sourcePath, pin);
    return { ...verified, downloaded: true, resumedAt: offset };
  } finally { await destination?.close().catch(() => {}); await releaseDownloadLock(lock); }
}

async function readActive(path) {
  const active = JSON.parse(await readFile(path, "utf8"));
  if (active.schemaVersion !== 1 || basename(active.manifest) !== active.manifest) throw new Error(`Invalid active manifest pointer: ${path}`);
  return active;
}

export async function restoreSemanticV2({ sourcePath, corpusDir, targetsDir, evidenceDir, cataloguePath, download = false, recoverDownloadLockOwner = null, recoverCorpusLockOwner = null }) {
  sourcePath = resolve(sourcePath); corpusDir = resolve(corpusDir); targetsDir = resolve(targetsDir);
  evidenceDir = resolve(evidenceDir); cataloguePath = resolve(cataloguePath);
  if (basename(sourcePath) !== PINNED_CORPUS.file) throw new Error(`Pinned source filename must remain ${PINNED_CORPUS.file}`);
  const source = download
    ? await downloadPinnedSource(sourcePath, { recoverOwner: recoverDownloadLockOwner })
    : { ...(await verifyPinnedFile(sourcePath)), downloaded: false };
  const buildOptions = { sourcePath, outputDir: corpusDir, ...(recoverCorpusLockOwner ? { recoverLockOwner: recoverCorpusLockOwner } : {}) };
  const corpus = await buildSemanticCorpus(buildOptions);
  const verifiedCorpus = await verifySemanticCorpus({ sourcePath, outputDir: corpusDir });
  if (corpus.corpusId !== PINNED_CORPUS.corpusId || verifiedCorpus.corpusId !== PINNED_CORPUS.corpusId || verifiedCorpus.rowsRead !== PINNED_CORPUS.rowsRead || verifiedCorpus.accepted !== PINNED_CORPUS.accepted || verifiedCorpus.segments !== PINNED_CORPUS.segments || verifiedCorpus.semanticSha256 !== PINNED_CORPUS.semanticSha256) throw new Error("Restored BRV2 corpus does not match the pinned complete corpus");
  const corpusActive = await readActive(join(corpusDir, "active.json"));
  if (corpusActive.manifestSha256 !== PINNED_CORPUS.manifestSha256) throw new Error("Restored BRV2 manifest hash does not match the pinned complete corpus");
  await buildSemanticIndex({ corpusDir, outputDir: targetsDir });
  const verifiedIndex = await verifySemanticIndex({ corpusDir, outputDir: targetsDir });
  if (verifiedIndex.corpusId !== PINNED_CORPUS.corpusId || verifiedIndex.dictionarySize !== PINNED_CORPUS.indexEntries || verifiedIndex.leaves !== PINNED_CORPUS.indexLeaves || verifiedIndex.manifestSha256 !== PINNED_CORPUS.indexManifestSha256) throw new Error("Restored BPI2 index does not match the pinned complete index");
  await mkdir(join(targetsDir, PINNED_CORPUS.corpusId, "targets"), { recursive: true });
  const catalogue = await verifyEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, cataloguePath, onProgress: progress => console.error(JSON.stringify(progress)) });
  return { schemaVersion: 1, status: "passed", source, corpus: { corpusId: verifiedCorpus.corpusId, rowsRead: verifiedCorpus.rowsRead, accepted: verifiedCorpus.accepted, segments: verifiedCorpus.segments, manifestSha256: corpusActive.manifestSha256, semanticSha256: verifiedCorpus.semanticSha256 }, index: verifiedIndex, catalogue };
}

export function parseRestoreArgs(argv, cwd = process.cwd()) {
  const values = {}; const flags = new Set();
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (item === "--download") { flags.add(item); continue; }
    if (!item?.startsWith("--") || argv[index + 1] === undefined || argv[index + 1].startsWith("--")) throw new Error("Invalid restore arguments");
    values[item.slice(2)] = argv[++index];
  }
  const allowed = new Set(["source", "corpus", "targets", "evidence", "catalogue", "recover-download-lock-owner", "recover-corpus-lock-owner"]);
  for (const key of Object.keys(values)) if (!allowed.has(key)) throw new Error(`Unsupported restore argument: --${key}`);
  return {
    sourcePath: resolve(cwd, values.source ?? "work/source/wiki.fr.vec"),
    corpusDir: resolve(cwd, values.corpus ?? "work/semantic-v2-real"),
    targetsDir: resolve(cwd, values.targets ?? "work/semantic-v2-targets-real"),
    evidenceDir: resolve(cwd, values.evidence ?? "data/editorial-v2-evidence"),
    cataloguePath: resolve(cwd, values.catalogue ?? "data/editorial-v2-catalogue.json"),
    download: flags.has("--download"),
    recoverDownloadLockOwner: values["recover-download-lock-owner"] ?? null,
    recoverCorpusLockOwner: values["recover-corpus-lock-owner"] ?? null,
  };
}

if (process.argv[1] && basename(process.argv[1]) === "restore-semantic-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  restoreSemanticV2(parseRestoreArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
