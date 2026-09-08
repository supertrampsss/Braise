import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  acquireTargetCacheGuard, durableWrite, loadActiveCorpus, releaseTargetCacheGuard,
} from "./semantic-target-v2-common.mjs";
import { verifySemanticTargetUnderGuard } from "./verify-semantic-target-v2.mjs";

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

/** @param {{corpusDir:string, outputDir:string, targetId:number, recoverLockOwner?:string|null, testStopAfterRename?:boolean}} options */
export async function evictSemanticTarget({ corpusDir, outputDir, targetId, recoverLockOwner = null, testStopAfterRename = false }) {
  corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  if (!Number.isInteger(targetId) || targetId < 0 || targetId > 0xffff_ffff) throw new Error("targetId must be an unsigned 32-bit integer");
  const corpus = await loadActiveCorpus(corpusDir); const targetsRoot = join(outputDir, corpus.manifest.corpusId, "targets");
  await mkdir(targetsRoot, { recursive: true });
  if (await realpath(targetsRoot) !== targetsRoot) throw new Error("Target cache root cannot contain symbolic links");
  const journalRoot = join(targetsRoot, ".evictions"); await mkdir(journalRoot, { recursive: true });
  if (await existingKind(journalRoot) !== "directory") throw new Error("Eviction journal root is unsafe");
  const guard = acquireTargetCacheGuard(targetsRoot, "exclusive");
  try {
    await finishInterruptedEvictions(targetsRoot, journalRoot);
    const targetName = String(targetId).padStart(10, "0"); const targetDir = join(targetsRoot, targetName);
    const kind = await existingKind(targetDir);
    if (kind === "missing") return { corpusId: corpus.manifest.corpusId, targetId, evicted: false };
    if (kind !== "directory") throw new Error("Target cache entry is not a safe directory");
    await assertRecoverableTargetLock(targetDir, recoverLockOwner);
    const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir, targetId }, guard);
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
    return { corpusId: corpus.manifest.corpusId, targetId, evicted: true, manifestSha256: verified.manifestSha256 };
  } finally { releaseTargetCacheGuard(guard); }
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR --target-id N [--recover-lock-owner ID]"); values[argv[index].slice(2)] = argv[index + 1]; }
  if (!values.corpus || !values.output || values["target-id"] === undefined) throw new Error("--corpus, --output and --target-id are required");
  return { corpusDir: values.corpus, outputDir: values.output, targetId: Number(values["target-id"]), ...(values["recover-lock-owner"] ? { recoverLockOwner: values["recover-lock-owner"] } : {}) };
}

if (process.argv[1] && basename(process.argv[1]) === "evict-semantic-target-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) evictSemanticTarget(parseArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
