import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  acquireTargetCacheGuard, durableWrite, loadActiveCorpus, releaseTargetCacheGuard, sha256,
} from "./semantic-target-v2-common.mjs";
import { verifySemanticTargetsUnderGuard } from "./verify-semantic-target-v2.mjs";
import { canonicalDirectoryWithoutLinks } from "./semantic-paths.mjs";

async function existingKind(path) {
  try { const info = await lstat(path); return info.isSymbolicLink() ? "symlink" : info.isDirectory() ? "directory" : "other"; }
  catch (error) { if (error?.code === "ENOENT") return "missing"; throw error; }
}

async function assertRecoverableTargetLock(targetDir, recoverLockOwner) {
  let lock;
  try { lock = JSON.parse(await readFile(join(targetDir, ".target.lock"), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return; throw new Error("Existing target lock is unreadable"); }
  if (!recoverLockOwner || lock.owner !== recoverLockOwner || !Number.isSafeInteger(lock.pid) || lock.pid < 1) throw new Error("Target has an unrecovered build lock");
  let alive = true;
  try { process.kill(lock.pid, 0); }
  catch (error) { if (error?.code === "ESRCH") alive = false; else throw error; }
  if (alive) throw new Error(`Target lock owner ${recoverLockOwner} is still running`);
}

async function finishInterruptedEvictions(targetsRoot, journalRoot) {
  for (const entry of await readdir(journalRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !/^eviction-[0-9a-f-]{36}\.json$/.test(entry.name)) continue;
    const path = join(journalRoot, entry.name); const journal = JSON.parse(await readFile(path, "utf8"));
    if (journal.schemaVersion !== 1 || !/^\d{10}$/.test(journal.targetName) || !/^\.evicted-\d{10}-[0-9a-f-]{36}$/.test(journal.tombstoneName)) throw new Error(`Unsafe eviction journal: ${entry.name}`);
    if (journal.complete === true) continue;
    const targetPath = join(targetsRoot, journal.targetName); const tombstonePath = join(targetsRoot, journal.tombstoneName);
    const targetKind = await existingKind(targetPath); const tombstoneKind = await existingKind(tombstonePath);
    if (targetKind === "missing" && tombstoneKind === "directory") {
      await rm(tombstonePath, { recursive: true });
      await durableWrite(path, `${JSON.stringify({ ...journal, complete: true, completedAt: new Date().toISOString() }, null, 2)}\n`);
    } else if (targetKind === "missing" && tombstoneKind === "missing") {
      await durableWrite(path, `${JSON.stringify({ ...journal, complete: true, completedAt: new Date().toISOString() }, null, 2)}\n`);
    } else if (targetKind === "directory" && tombstoneKind === "missing" && journal.phase === "prepared") {
      await durableWrite(path, `${JSON.stringify({ ...journal, complete: true, cancelled: true, completedAt: new Date().toISOString() }, null, 2)}\n`);
    } else throw new Error(`Ambiguous interrupted eviction: ${entry.name}`);
  }
}

async function recheckVerifiedTarget({ targetDir, originalActive, verified, originalManifest }) {
    await canonicalDirectoryWithoutLinks(join(targetDir, "pages"));
    const activeInfo = await lstat(join(targetDir, "active.json"));
    if (!activeInfo.isFile() || activeInfo.isSymbolicLink() || !(await readFile(join(targetDir, "active.json"))).equals(originalActive)) throw new Error("Active target changed before eviction");
    const active = JSON.parse(originalActive);
    for (const object of [{ file: active.manifest, hash: verified.manifestSha256 }, ...[...originalManifest.valuePages, ...originalManifest.orderPages].map(page => ({ file: join("pages", page.file), hash: page.objectSha256 }))]) {
      const path = join(targetDir, object.file); const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || sha256(await readFile(path)) !== object.hash) throw new Error("Verified target object changed before eviction");
    }
}

/** Verify up to eight targets together, retain all proofs privately under this
 * exclusive guard, and recheck every canonical object after preparation before
 * deleting any target. The callback cannot provide a numerical attestation.
 * @param {{corpusDir:string,outputDir:string,targetIds:number[],recoverLockOwner?:string|null,testStopAfterRename?:boolean,beforeEviction?:((verified:any[])=>Promise<any[]>)|null}} options
 */
export async function evictSemanticTargets({ corpusDir, outputDir, targetIds, recoverLockOwner = null, testStopAfterRename = false, beforeEviction = null }) {
  if (!Array.isArray(targetIds) || targetIds.length < 1 || targetIds.length > 8 || new Set(targetIds).size !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0 || id > 0xffff_ffff)) throw new Error("Eviction requires one to eight distinct unsigned target IDs");
  targetIds = [...targetIds]; corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  const corpus = await loadActiveCorpus(corpusDir); const targetsRoot = join(outputDir, corpus.manifest.corpusId, "targets");
  await mkdir(targetsRoot, { recursive: true }); await canonicalDirectoryWithoutLinks(targetsRoot);
  const journalRoot = join(targetsRoot, ".evictions"); await mkdir(journalRoot, { recursive: true });
  if (await existingKind(journalRoot) !== "directory") throw new Error("Eviction journal root is unsafe");
  const guard = acquireTargetCacheGuard(targetsRoot, "exclusive");
  try {
    await finishInterruptedEvictions(targetsRoot, journalRoot);
    const present = []; const results = new Map();
    for (const targetId of targetIds) {
      const targetName = String(targetId).padStart(10, "0"), targetDir = join(targetsRoot, targetName);
      const kind = await existingKind(targetDir);
      if (kind === "missing") { results.set(targetId, { corpusId: corpus.manifest.corpusId, targetId, evicted: false }); continue; }
      if (kind !== "directory") throw new Error("Target cache entry is not a safe directory");
      await assertRecoverableTargetLock(targetDir, recoverLockOwner);
      present.push({ targetId, targetName, targetDir });
    }
    if (!present.length) return { results: targetIds.map(id => results.get(id)), verificationMs: 0, evictionMs: 0 };
    if (beforeEviction && present.length !== targetIds.length) throw new Error("Target disappeared before grouped archival capture");
    const verificationStarted = performance.now();
    const verifiedTargets = await verifySemanticTargetsUnderGuard({ corpusDir, outputDir, requests: present.map(({ targetId }) => ({ targetId, neighborCount: beforeEviction ? 64 : 12 })) }, guard);
    const verificationMs = Math.round(performance.now() - verificationStarted);
    for (let index = 0; index < present.length; index++) {
      const state = present[index]; state.verified = verifiedTargets[index];
      state.originalActive = await readFile(join(state.targetDir, "active.json"));
      const pointer = JSON.parse(state.originalActive);
      if (pointer.manifestSha256 !== state.verified.manifestSha256 || pointer.targetId !== state.targetId || pointer.corpusId !== corpus.manifest.corpusId) throw new Error("Active target changed after verification");
      state.originalManifest = JSON.parse(state.verified.manifestUtf8);
    }
    const prepared = beforeEviction ? await beforeEviction(structuredClone(verifiedTargets)) : present.map(() => null);
    if (!Array.isArray(prepared) || prepared.length !== present.length) throw new Error("Grouped eviction preparation is incomplete");
    const evictionStarted = performance.now();
    const currentCorpus = await loadActiveCorpus(corpusDir);
    if (currentCorpus.manifestSha256 !== corpus.manifestSha256 || currentCorpus.manifest.corpusId !== corpus.manifest.corpusId) throw new Error("Corpus identity changed before eviction");
    for (const state of present) await recheckVerifiedTarget(state);
    for (let index = 0; index < present.length; index++) {
      const { targetId, targetName, targetDir, verified } = present[index];
      // A fresh individual scan immediately precedes each rename as well; earlier
      // successful archive/purge steps cannot waive a later target's integrity.
      await recheckVerifiedTarget(present[index]);
    const operationId = randomUUID(); const tombstoneName = `.evicted-${targetName}-${operationId}`; const tombstonePath = join(targetsRoot, tombstoneName);
    if (basename(tombstonePath) !== tombstoneName || await existingKind(tombstonePath) !== "missing") throw new Error("Eviction tombstone path is unsafe");
    const journalPath = join(journalRoot, `eviction-${operationId}.json`);
    const journal = { schemaVersion: 1, complete: false, phase: "prepared", operationId, corpusId: corpus.manifest.corpusId, corpusManifestSha256: corpus.manifestSha256, targetId, targetName, targetManifestSha256: verified.manifestSha256, tombstoneName, createdAt: new Date().toISOString() };
    await durableWrite(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    await rename(targetDir, tombstonePath);
    if (testStopAfterRename) throw new Error("Test interruption after atomic target rename");
    await durableWrite(journalPath, `${JSON.stringify({ ...journal, phase: "renamed" }, null, 2)}\n`);
    await rm(tombstonePath, { recursive: true });
    await durableWrite(journalPath, `${JSON.stringify({ ...journal, phase: "purged", complete: true, completedAt: new Date().toISOString() }, null, 2)}\n`);
      results.set(targetId, { corpusId: corpus.manifest.corpusId, targetId, evicted: true, manifestSha256: verified.manifestSha256, ...(beforeEviction ? { prepared: prepared[index] } : {}) });
    }
    return { results: targetIds.map(id => results.get(id)), verificationMs, evictionMs: Math.round(performance.now() - evictionStarted) };
  } finally { releaseTargetCacheGuard(guard); }
}

/** @param {{corpusDir:string, outputDir:string, targetId:number, recoverLockOwner?:string|null, testStopAfterRename?:boolean, beforeEviction?:(verified:any)=>Promise<any>}} options */
export async function evictSemanticTarget({ targetId, beforeEviction = null, ...options }) {
  const group = await evictSemanticTargets({ ...options, targetIds: [targetId], beforeEviction: beforeEviction ? async verified => [await beforeEviction(verified[0])] : null });
  return { ...group.results[0], ...(beforeEviction && group.results[0].evicted ? { verificationMs: group.verificationMs, evictionMs: group.evictionMs } : {}) };
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR --target-id N [--recover-lock-owner ID]"); values[argv[index].slice(2)] = argv[index + 1]; }
  if (!values.corpus || !values.output || values["target-id"] === undefined) throw new Error("--corpus, --output and --target-id are required");
  return { corpusDir: values.corpus, outputDir: values.output, targetId: Number(values["target-id"]), ...(values["recover-lock-owner"] ? { recoverLockOwner: values["recover-lock-owner"] } : {}) };
}

if (process.argv[1] && basename(process.argv[1]) === "evict-semantic-target-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) evictSemanticTarget(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
