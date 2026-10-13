import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { canonicalDirectoryWithoutLinks } from "./semantic-paths.mjs";
import { canonicalGzip } from "./canonical-gzip.mjs";
import {
  SCORE_BUCKETS, SCORE_CONTRACT, SCORE_MAX, SCORE_MIN,
  acquireTargetCacheGuard, assertTargetCacheGuard, corpusEntries, durableWrite, installImmutable, loadActiveCorpus,
  quantizedCosine, scoreIndex, sha256, stableJson, vectorNorm,
  releaseTargetCacheGuard,
} from "./semantic-target-v2-common.mjs";

export const DEFAULT_TARGET_PAGE_ENTRIES = 65_536;
export const MIN_TARGET_PAGE_ENTRIES = 256;
export const MAX_TARGET_PAGE_ENTRIES = 262_144;
export const DEFAULT_MAX_CACHED_TARGETS = 8;
export const MAX_CACHED_TARGETS = 64;
const PAGE_HEADER_BYTES = 64;
// Disposable producer state: int16 scores + uint32 sorted IDs (6 MiB maximum).
// Comparator sorting is deliberately independent of the verifier's bucket placement.
export const MAX_MEMORY_TARGET_RECORDS = 1_048_576;
export function targetOrderingStorage(dictionarySize, preference = "auto") {
  if (!["auto", "sqlite"].includes(preference) || !Number.isSafeInteger(dictionarySize) || dictionarySize < 1 || dictionarySize > 0xffff_ffff) throw new Error("Invalid target ordering storage request");
  return preference === "auto" && dictionarySize <= MAX_MEMORY_TARGET_RECORDS ? "bounded-memory" : "sqlite";
}

export class TargetBuildInterrupted extends Error {
  constructor(message) { super(message); this.name = "TargetBuildInterrupted"; }
}

async function acquireLock(targetDir, metadata, recoverLockOwner) {
  const guardPath = join(targetDir, ".target-lock.sqlite"); let guard;
  try {
    guard = new DatabaseSync(guardPath);
    guard.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS target_guard(id INTEGER PRIMARY KEY);");
  } catch {
    try { guard?.close(); } catch {}
    throw new Error(`Another target build or recovery owns ${targetDir}`);
  }
  const lockPath = join(targetDir, ".target.lock");
  try {
    let existing = null;
    try { existing = JSON.parse(await readFile(lockPath, "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") throw new Error("Existing target lock is unreadable"); }
    if (existing) {
      if (!recoverLockOwner || existing.owner !== recoverLockOwner || !Number.isSafeInteger(existing.pid) || existing.pid < 1) throw new Error(`Another target build owns ${lockPath}`);
      let alive = true;
      try { process.kill(existing.pid, 0); }
      catch (error) { if (error?.code === "ESRCH") alive = false; else throw error; }
      if (alive) throw new Error(`Target lock owner ${recoverLockOwner} is still running`);
    }
    await durableWrite(lockPath, `${JSON.stringify(metadata)}\n`);
    return { guard, lockPath, owner: metadata.owner };
  } catch (error) {
    try { guard.exec("ROLLBACK"); } catch {}
    try { guard.close(); } catch {}
    throw error;
  }
}

async function releaseLock(lock) {
  if (!lock) return;
  try {
    const current = JSON.parse(await readFile(lock.lockPath, "utf8"));
    if (current.owner === lock.owner) await rm(lock.lockPath, { force: true });
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  finally { try { lock.guard.exec("ROLLBACK"); } catch {} try { lock.guard.close(); } catch {} }
}

async function enforceCacheQuota(targetsRoot, targetId, maxCachedTargets) {
  const currentName = String(targetId).padStart(10, "0"); const occupied = []; let currentTombstone = false;
  for (const entry of await readdir(targetsRoot, { withFileTypes: true })) {
    const canonical = /^\d{10}$/.test(entry.name); const tombstone = /^\.evicted-\d{10}-[0-9a-f-]{36}$/.test(entry.name);
    if (!canonical && !tombstone) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Unsafe target cache entry: ${entry.name}`);
    if (tombstone && entry.name.startsWith(`.evicted-${currentName}-`)) currentTombstone = true;
    occupied.push(entry.name);
  }
  let journals = [];
  try { journals = await readdir(join(targetsRoot, ".evictions"), { withFileTypes: true }); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  for (const entry of journals) {
    if (!entry.isFile() || !/^eviction-[0-9a-f-]{36}\.json$/.test(entry.name)) continue;
    let journal; try { journal = JSON.parse(await readFile(join(targetsRoot, ".evictions", entry.name), "utf8")); } catch { throw new Error(`Unsafe eviction journal: ${entry.name}`); }
    if (journal.complete !== true && journal.targetName === currentName) currentTombstone = true;
  }
  if (currentTombstone) throw new Error(`Target ${targetId} has an interrupted eviction that must be resumed explicitly`);
  if (!occupied.includes(currentName) && occupied.length >= maxCachedTargets) throw new Error(`Target cache quota reached (${maxCachedTargets}); evict a staged target explicitly before generating another`);
}

async function targetVectorFor(corpusDir, manifest, targetId) {
  for await (const { entries } of corpusEntries(corpusDir, manifest)) {
    if (targetId >= entries[0].id && targetId <= entries.at(-1).id) return entries[targetId - entries[0].id];
  }
  throw new Error(`Target id ${targetId} is absent from the corpus`);
}

async function verifyScoreCheckpoint(path, checkpoint, manifest) {
  const info = await stat(path);
  if (info.size < checkpoint.scoresBytes) throw new Error("Target score checkpoint is truncated");
  const handle = await open(path, "r");
  const histogram = new Array(SCORE_BUCKETS).fill(0); let offset = 0;
  try {
    for (let index = 0; index < checkpoint.scoreParts.length; index++) {
      const part = checkpoint.scoreParts[index]; const segment = manifest.segments[index]; const expectedBytes = segment.count * 2;
      if (part.corpusSegment !== segment.file || part.offset !== offset || part.bytes !== expectedBytes || expectedBytes > manifest.config.segmentEntries * 2 || !/^[0-9a-f]{64}$/.test(part.sha256)) throw new Error("Target score checkpoint range is invalid");
      const buffer = Buffer.allocUnsafe(part.bytes); const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead !== buffer.length || sha256(buffer) !== part.sha256) throw new Error("Target score checkpoint hash mismatch");
      for (let cursor = 0; cursor < buffer.length; cursor += 2) histogram[scoreIndex(buffer.readInt16LE(cursor))]++;
      offset += buffer.length;
    }
  } finally { await handle.close(); }
  if (offset !== checkpoint.scoresBytes) throw new Error("Target score checkpoint parts do not cover the committed prefix");
  if (JSON.stringify(histogram) !== JSON.stringify(checkpoint.histogram)) throw new Error("Target score checkpoint histogram mismatch");
  if (info.size > checkpoint.scoresBytes) { const writable = await open(path, "r+"); try { await writable.truncate(checkpoint.scoresBytes); await writable.sync(); } finally { await writable.close(); } }
}

async function prepareIncompleteCheckpoint({ checkpoint, config, configHash, manifest, scorePath }) {
  if (!checkpoint) checkpoint = { schemaVersion: 1, complete: false, config, configHash, processedCorpusSegments: 0, scoresWritten: 0, scoresBytes: 0, histogram: new Array(SCORE_BUCKETS).fill(0), scoreParts: [] };
  if (checkpoint.schemaVersion !== 1 || checkpoint.complete !== false || checkpoint.configHash !== configHash || stableJson(checkpoint.config) !== stableJson(config) || !Number.isInteger(checkpoint.processedCorpusSegments) || checkpoint.processedCorpusSegments < 0 || checkpoint.processedCorpusSegments > manifest.segments.length || checkpoint.scoresWritten < 0 || checkpoint.scoresWritten > manifest.stats.accepted || checkpoint.scoresBytes !== checkpoint.scoresWritten * 2 || !Array.isArray(checkpoint.histogram) || checkpoint.histogram.length !== SCORE_BUCKETS || !checkpoint.histogram.every(value => Number.isSafeInteger(value) && value >= 0) || !Array.isArray(checkpoint.scoreParts) || checkpoint.scoreParts.length !== checkpoint.processedCorpusSegments) throw new Error("Target checkpoint does not match corpus or configuration");
  if (checkpoint.scoresWritten > 0) await verifyScoreCheckpoint(scorePath, checkpoint, manifest);
  else await rm(scorePath, { force: true });
  return checkpoint;
}

function pageHeader(magic, targetId, first, count, dictionarySize, payloadOffset, rawBytes, corpusManifestSha256, contractHash) {
  const header = Buffer.alloc(PAGE_HEADER_BYTES);
  header.write(magic, 0, 4, "ascii"); header.writeUInt16LE(2, 4); header.writeUInt16LE(magic === "BSV2" ? 0b11 : 0b1, 6);
  header.writeUInt32LE(targetId, 8); header.writeUInt32LE(first, 12); header.writeUInt32LE(count, 16); header.writeUInt32LE(dictionarySize, 20);
  header.writeUInt32LE(PAGE_HEADER_BYTES, 24); header.writeUInt32LE(payloadOffset, 28); header.writeUInt32LE(rawBytes, 32);
  Buffer.from(corpusManifestSha256.slice(0, 32), "hex").copy(header, 40);
  Buffer.from(contractHash.slice(0, 16), "hex").copy(header, 56);
  return header;
}

async function persistPage(pageDir, prefix, raw, metadata) {
  const compressed = canonicalGzip(raw, { level: 9 }); const rawSha256 = sha256(raw); const objectSha256 = sha256(compressed);
  const file = `${prefix}-${objectSha256.slice(0, 16)}.brt.gz`;
  await installImmutable(join(pageDir, file), compressed);
  return { ...metadata, file, rawBytes: raw.length, compressedBytes: compressed.length, rawSha256, objectSha256 };
}

async function readScores(handle, firstId, count) {
  const buffer = Buffer.allocUnsafe(count * 2); const { bytesRead } = await handle.read(buffer, 0, buffer.length, firstId * 2);
  if (bytesRead !== buffer.length) throw new Error("Target scores are truncated"); return buffer;
}

/** @param {{corpusDir:string, outputDir:string, targetId:number, pageEntries?:number, maxCachedTargets?:number, recoverLockOwner?:string|null, testStopAfterCorpusSegments?:number|null, testStopAfterScoreSync?:number|null, testStopAfterScores?:boolean, testStopAfterPages?:boolean, testHoldAfterLockMs?:number}} options */
async function buildSemanticTargetInternal({
  corpusDir, outputDir, targetId, pageEntries = DEFAULT_TARGET_PAGE_ENTRIES,
  maxCachedTargets = DEFAULT_MAX_CACHED_TARGETS,
  recoverLockOwner = null, testStopAfterCorpusSegments = null,
  testStopAfterScoreSync = null,
  testStopAfterScores = false, testStopAfterPages = false, testHoldAfterLockMs = 0, orderingStorage = "auto",
}, operation = null) {
  corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  if (!Number.isInteger(targetId) || targetId < 0 || targetId > 0xffff_ffff) throw new Error("targetId must be an unsigned 32-bit integer");
  if (!Number.isInteger(pageEntries) || pageEntries < MIN_TARGET_PAGE_ENTRIES || pageEntries > MAX_TARGET_PAGE_ENTRIES) throw new Error(`pageEntries must be between ${MIN_TARGET_PAGE_ENTRIES} and ${MAX_TARGET_PAGE_ENTRIES}`);
  if (!Number.isInteger(maxCachedTargets) || maxCachedTargets < 1 || maxCachedTargets > MAX_CACHED_TARGETS) throw new Error(`maxCachedTargets must be between 1 and ${MAX_CACHED_TARGETS}`);
  const corpus = await loadActiveCorpus(corpusDir); const { manifest, manifestSha256 } = corpus;
  if (targetId >= manifest.stats.accepted) throw new Error(`Target id ${targetId} is outside the admitted corpus`);
  const contractHash = sha256(stableJson(SCORE_CONTRACT));
  const config = { schemaVersion: 1, formatVersion: 2, pageEntries, contract: SCORE_CONTRACT, contractHash, corpusId: manifest.corpusId, corpusManifestSha256: manifestSha256, semanticSha256: manifest.semanticSha256, targetId };
  const configHash = sha256(stableJson(config));
  const targetsRoot = join(outputDir, manifest.corpusId, "targets"); await mkdir(targetsRoot, { recursive: true });
  const cacheGuard = operation?.cacheGuard ?? acquireTargetCacheGuard(targetsRoot, "exclusive");
  assertTargetCacheGuard(cacheGuard, targetsRoot);
  const targetDir = join(targetsRoot, String(targetId).padStart(10, "0")); const pageDir = join(targetDir, "pages");
  let lock;
  const checkpointPath = join(targetDir, "checkpoint.json"); const scorePath = join(targetDir, "scores.tmp");
  let scoreHandle; let orderDatabase;
  try {
    await enforceCacheQuota(targetsRoot, targetId, maxCachedTargets); await mkdir(pageDir, { recursive: true });
    const owner = randomUUID(); lock = await acquireLock(targetDir, { schemaVersion: 1, owner, pid: process.pid, createdAt: new Date().toISOString(), corpusDir, targetId, configHash }, recoverLockOwner);
    if (testHoldAfterLockMs > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, testHoldAfterLockMs));
    let checkpoint;
    try { checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") throw new Error(`Cannot read target checkpoint: ${error.message}`); }
    if (checkpoint?.complete === true) {
      if (checkpoint.configHash !== configHash) throw new Error("Completed target does not match corpus, target or configuration");
      const active = JSON.parse(await readFile(join(targetDir, "active.json"), "utf8"));
      const { verifySemanticTargetUnderGuard } = await import("./verify-semantic-target-v2.mjs");
      const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir, targetId }, cacheGuard);
      if (verified.dictionarySize !== manifest.stats.accepted || active.targetId !== targetId) throw new Error("Completed target verification failed");
      await rm(scorePath, { force: true });
      return JSON.parse(await readFile(join(targetDir, active.manifest), "utf8"));
    }
    checkpoint = await prepareIncompleteCheckpoint({ checkpoint, config, configHash, manifest, scorePath });
    const target = await targetVectorFor(corpusDir, manifest, targetId); const targetNorm = vectorNorm(target.vector, manifest.config.dimensions);
    scoreHandle = await open(scorePath, checkpoint.scoresWritten ? "r+" : "w+");
    let expectedId = 0;
    if (checkpoint.processedCorpusSegments < manifest.segments.length) for await (const { segmentIndex, segment, entries } of corpusEntries(corpusDir, manifest)) {
      if (segmentIndex < checkpoint.processedCorpusSegments) { expectedId += entries.length; continue; }
      if (entries[0].id !== expectedId) throw new Error("Corpus id sequence changed during target build");
      const scores = Buffer.allocUnsafe(entries.length * 2);
      entries.forEach((entry, index) => {
        const score = quantizedCosine(entry.vector, target.vector, manifest.config.dimensions, targetNorm, entry.id === targetId);
        scores.writeInt16LE(score, index * 2); checkpoint.histogram[scoreIndex(score)]++;
      });
      await scoreHandle.write(scores, 0, scores.length, checkpoint.scoresBytes); await scoreHandle.sync();
      if (testStopAfterScoreSync === checkpoint.processedCorpusSegments + 1) throw new TargetBuildInterrupted("Test interruption after score sync before checkpoint");
      checkpoint.scoreParts.push({ corpusSegment: segment.file, offset: checkpoint.scoresBytes, bytes: scores.length, sha256: sha256(scores) });
      checkpoint.processedCorpusSegments++; checkpoint.scoresWritten += entries.length; checkpoint.scoresBytes += scores.length;
      await durableWrite(checkpointPath, `${JSON.stringify(checkpoint)}\n`); expectedId += entries.length;
      if (testStopAfterCorpusSegments === checkpoint.processedCorpusSegments) throw new TargetBuildInterrupted("Test interruption after target score checkpoint");
    }
    await scoreHandle.close(); scoreHandle = null;
    if (checkpoint.scoresWritten !== manifest.stats.accepted || checkpoint.histogram.reduce((sum, value) => sum + value, 0) !== manifest.stats.accepted) throw new Error("Target scores do not cover every admitted entry");
    if (testStopAfterScores) throw new TargetBuildInterrupted("Test interruption after complete target scores");
    const finalizationStarted = performance.now(); let orderingMs = null; let valuePagesMs = 0; let orderPagesMs = 0;
    const storage = targetOrderingStorage(manifest.stats.accepted, orderingStorage);
    const scoreColumn = storage === "bounded-memory" ? new Int16Array(manifest.stats.accepted) : null;
    const higher = new Uint32Array(SCORE_BUCKETS); let above = 0;
    for (let index = SCORE_BUCKETS - 1; index >= 0; index--) { higher[index] = above; above += checkpoint.histogram[index]; }
    const valuePages = []; const orderPages = []; const scoresReader = await open(scorePath, "r");
    const orderDbPath = join(targetDir, "order.tmp.sqlite"); await rm(orderDbPath, { force: true });
    if (!scoreColumn) { orderDatabase = new DatabaseSync(orderDbPath); orderDatabase.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE scored(id INTEGER PRIMARY KEY, score INTEGER NOT NULL); CREATE INDEX score_order ON scored(score DESC, id ASC);"); }
    const insert = orderDatabase?.prepare("INSERT INTO scored(id, score) VALUES (?, ?)");
    try {
      const valuesStarted = performance.now();
      for (let firstId = 0; firstId < manifest.stats.accepted; firstId += pageEntries) {
        const count = Math.min(pageEntries, manifest.stats.accepted - firstId); const scores = await readScores(scoresReader, firstId, count);
        const ranks = Buffer.allocUnsafe(count * 4); orderDatabase?.exec("BEGIN");
        try {
          for (let index = 0; index < count; index++) { const score = scores.readInt16LE(index * 2); ranks.writeUInt32LE(higher[scoreIndex(score)] + 1, index * 4); if (scoreColumn) scoreColumn[firstId + index] = score; else insert.run(firstId + index, score); }
          orderDatabase?.exec("COMMIT");
        } catch (error) { orderDatabase?.exec("ROLLBACK"); throw error; }
        const rawBytes = PAGE_HEADER_BYTES + scores.length + ranks.length;
        const raw = Buffer.concat([pageHeader("BSV2", targetId, firstId, count, manifest.stats.accepted, PAGE_HEADER_BYTES + scores.length, rawBytes, manifestSha256, contractHash), scores, ranks], rawBytes);
        valuePages.push(await persistPage(pageDir, `values-${String(firstId).padStart(10, "0")}`, raw, { firstId, count }));
      }
      valuePagesMs = Math.round(performance.now() - valuesStarted);
      const orderStarted = performance.now();
      let firstPosition = 0; let ids = [];
      const flushOrder = async () => {
        if (!ids.length) return;
        const payload = Buffer.allocUnsafe(ids.length * 4); ids.forEach((id, index) => payload.writeUInt32LE(id, index * 4));
        const rawBytes = PAGE_HEADER_BYTES + payload.length;
        const raw = Buffer.concat([pageHeader("BSO2", targetId, firstPosition, ids.length, manifest.stats.accepted, PAGE_HEADER_BYTES, rawBytes, manifestSha256, contractHash), payload], rawBytes);
        orderPages.push(await persistPage(pageDir, `order-${String(firstPosition).padStart(10, "0")}`, raw, { firstPosition, count: ids.length }));
        firstPosition += ids.length; ids = [];
      };
      const orderingStarted = performance.now();
      let sortedIds = null;
      if (scoreColumn) {
        sortedIds = Uint32Array.from({ length: manifest.stats.accepted }, (_, id) => id);
        sortedIds.sort((left, right) => scoreColumn[right] - scoreColumn[left] || left - right);
      }
      orderingMs = scoreColumn ? Math.round(performance.now() - orderingStarted) : null;
      const ordered = sortedIds ?? orderDatabase.prepare("SELECT id FROM scored ORDER BY score DESC, id ASC").iterate();
      for (const row of ordered) { ids.push(sortedIds ? row : row.id); if (ids.length === pageEntries) await flushOrder(); }
      await flushOrder();
      orderPagesMs = Math.round(performance.now() - orderStarted);
    } finally { await scoresReader.close(); orderDatabase?.close(); orderDatabase = null; await rm(orderDbPath, { force: true }); }
    if (valuePages.reduce((sum, page) => sum + page.count, 0) !== manifest.stats.accepted || orderPages.reduce((sum, page) => sum + page.count, 0) !== manifest.stats.accepted) throw new Error("Target pages do not cover the complete corpus");
    if (testStopAfterPages) throw new TargetBuildInterrupted("Test interruption after immutable target pages");
    const targetWordSha256 = sha256(Buffer.from(target.word));
    const targetManifest = { schemaVersion: 1, complete: true, format: "BRT2-pages", formatVersion: 2, corpus: { id: manifest.corpusId, manifestSha256, semanticSha256: manifest.semanticSha256, dictionarySize: manifest.stats.accepted, dimensions: manifest.config.dimensions }, target: { id: targetId, wordSha256: targetWordSha256 }, config, configHash, stats: { dictionarySize: manifest.stats.accepted, scoreMin: SCORE_MIN, scoreMax: SCORE_MAX, valuePages: valuePages.length, orderPages: orderPages.length }, histogram: checkpoint.histogram, valuePages, orderPages };
    const manifestBytes = Buffer.from(`${JSON.stringify(targetManifest, null, 2)}\n`); const targetManifestSha256 = sha256(manifestBytes);
    const manifestName = `manifest-${configHash.slice(0, 16)}-${targetManifestSha256.slice(0, 16)}.json`;
    await installImmutable(join(targetDir, manifestName), manifestBytes);
    const built = { targetId, targetDir, targetManifest, manifestName, targetManifestSha256, checkpoint, checkpointPath, scorePath,
      finalizationMs: Math.round(performance.now() - finalizationStarted), orderingMs, valuePagesMs, orderPagesMs, storage };
    if (operation) return built; // Private provisional result; the public group must verify before activation.
    const { verifySemanticTargetUnderGuard } = await import("./verify-semantic-target-v2.mjs");
    const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir, targetId, manifestName, expectedManifestSha256: targetManifestSha256 }, cacheGuard);
    return await activateBuiltTarget(built, verified, corpusDir);
  } finally {
    try { await scoreHandle?.close(); } catch {}
    try { orderDatabase?.close(); } catch {}
    try { await releaseLock(lock); } finally { if (!operation) releaseTargetCacheGuard(cacheGuard); }
  }
}

async function activateBuiltTarget(built, verified, corpusDir) {
  const currentCorpus = await loadActiveCorpus(corpusDir);
  if (currentCorpus.manifestSha256 !== built.targetManifest.corpus.manifestSha256 || currentCorpus.manifest.corpusId !== built.targetManifest.corpus.id) throw new Error("Corpus identity changed before target activation");
  const { targetId, targetDir, targetManifest, manifestName, targetManifestSha256, checkpoint, checkpointPath, scorePath } = built;
  if (verified.dictionarySize !== targetManifest.stats.dictionarySize || verified.targetId !== targetId || verified.manifestSha256 !== targetManifestSha256) throw new Error("Independent target verification did not cover the corpus");
  await durableWrite(join(targetDir, "active.json"), `${JSON.stringify({ schemaVersion: 1, targetId, corpusId: targetManifest.corpus.id, manifest: manifestName, manifestSha256: targetManifestSha256 }, null, 2)}\n`);
  checkpoint.complete = true; checkpoint.manifest = manifestName; checkpoint.manifestSha256 = targetManifestSha256;
  await durableWrite(checkpointPath, `${JSON.stringify(checkpoint)}\n`);
  await rm(scorePath, { force: true });
  return targetManifest;
}

/** Public scalar builder never exposes the private provisional/activation interface. */
export async function buildSemanticTarget(options) { return buildSemanticTargetInternal(options); }

/** Build one to eight provisional columns and verify ALL before activating any. */
export async function buildSemanticTargets({ corpusDir, outputDir, targetIds, pageEntries = DEFAULT_TARGET_PAGE_ENTRIES, orderingStorage = "auto" }) {
  if (!Array.isArray(targetIds) || targetIds.length < 1 || targetIds.length > 8) throw new Error("Target build requires one to eight IDs");
  targetIds = [...targetIds]; corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  const preparationStarted = performance.now();
  const preparation = await prepareSemanticTargetScoresBatch({ corpusDir, outputDir, targetIds, pageEntries });
  const preparationMs = Math.round(performance.now() - preparationStarted);
  const corpus = await loadActiveCorpus(corpusDir); const targetsRoot = join(outputDir, corpus.manifest.corpusId, "targets");
  await canonicalDirectoryWithoutLinks(targetsRoot);
  const cacheGuard = acquireTargetCacheGuard(targetsRoot, "exclusive");
  try {
    const built = [];
    for (const targetId of targetIds) built.push(await buildSemanticTargetInternal({ corpusDir, outputDir, targetId, pageEntries, orderingStorage }, { cacheGuard }));
    const { verifySemanticTargetsUnderGuard } = await import("./verify-semantic-target-v2.mjs");
    const verificationStarted = performance.now();
    const verified = await verifySemanticTargetsUnderGuard({ corpusDir, outputDir, requests: built.map(item => ({ targetId: item.targetId, manifestName: item.manifestName, expectedManifestSha256: item.targetManifestSha256 })) }, cacheGuard);
    const verificationMs = Math.round(performance.now() - verificationStarted);
    const manifests = [];
    for (let index = 0; index < built.length; index++) manifests.push(await activateBuiltTarget(built[index], verified[index], corpusDir));
    return { manifests, preparation, preparationMs, verificationMs, finalizations: built.map(({ targetId, finalizationMs, orderingMs, valuePagesMs, orderPagesMs, storage }) => ({ targetId, finalizationMs, orderingMs, valuePagesMs, orderPagesMs, storage })) };
  } finally { releaseTargetCacheGuard(cacheGuard); }
}

/** Prepare at most eight provisional score columns in one bounded corpus pass.
 * No pages or active pointer are created. The ordinary builder subsequently
 * validates checkpoints, creates canonical pages and independently verifies them.
 * @param {{corpusDir:string,outputDir:string,targetIds:number[],pageEntries?:number,testStopAfterSegment?:number,testStopAfterScoreSyncTargetId?:number}} options
 */
export async function prepareSemanticTargetScoresBatch({ corpusDir, outputDir, targetIds, pageEntries = DEFAULT_TARGET_PAGE_ENTRIES, testStopAfterSegment = 0, testStopAfterScoreSyncTargetId = -1 }) {
  if (!Array.isArray(targetIds) || targetIds.length < 1 || targetIds.length > DEFAULT_MAX_CACHED_TARGETS || new Set(targetIds).size !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0 || id > 0xffff_ffff)) throw new Error("Score preparation requires one to eight distinct target IDs");
  targetIds = [...targetIds]; corpusDir = resolve(corpusDir); outputDir = resolve(outputDir);
  if (!Number.isInteger(pageEntries) || pageEntries < MIN_TARGET_PAGE_ENTRIES || pageEntries > MAX_TARGET_PAGE_ENTRIES) throw new Error("Invalid target page entries");
  const corpus = await loadActiveCorpus(corpusDir); const { manifest, manifestSha256 } = corpus;
  if (targetIds.some(id => id >= manifest.stats.accepted)) throw new Error("Target id is outside the admitted corpus");
  const targetsRoot = join(outputDir, manifest.corpusId, "targets"); await mkdir(targetsRoot, { recursive: true });
  await canonicalDirectoryWithoutLinks(targetsRoot);
  const cacheGuard = acquireTargetCacheGuard(targetsRoot, "exclusive"); const states = [];
  try {
    for (const targetId of targetIds) {
      await enforceCacheQuota(targetsRoot, targetId, DEFAULT_MAX_CACHED_TARGETS);
      const targetDir = join(targetsRoot, String(targetId).padStart(10, "0")); await mkdir(targetDir, { recursive: true });
      const contractHash = sha256(stableJson(SCORE_CONTRACT));
      const config = { schemaVersion: 1, formatVersion: 2, pageEntries, contract: SCORE_CONTRACT, contractHash, corpusId: manifest.corpusId, corpusManifestSha256: manifestSha256, semanticSha256: manifest.semanticSha256, targetId };
      const configHash = sha256(stableJson(config)); const owner = randomUUID();
      const lock = await acquireLock(targetDir, { schemaVersion: 1, owner, pid: process.pid, createdAt: new Date().toISOString(), corpusDir, targetId, configHash }, null);
      const state = { targetId, lock, handle: null, target: null, targetNorm: null, checkpoint: null, scorePath: join(targetDir, "scores.tmp"), checkpointPath: join(targetDir, "checkpoint.json") }; states.push(state);
      let checkpoint;
      try { checkpoint = JSON.parse(await readFile(state.checkpointPath, "utf8")); }
      catch (error) { if (error?.code !== "ENOENT") throw new Error("Cannot read target score checkpoint"); }
      checkpoint = await prepareIncompleteCheckpoint({ checkpoint, config, configHash, manifest, scorePath: state.scorePath });
      state.checkpoint = checkpoint;
      state.handle = await open(state.scorePath, checkpoint.scoresWritten ? "r+" : "w+");
    }
    const pending = states.filter(state => state.checkpoint.processedCorpusSegments < manifest.segments.length);
    if (!pending.length) return { prepared: states.length, scoredSegments: 0 };
    const needed = new Map(pending.map(state => [state.targetId, state]));
    for await (const { entries } of corpusEntries(corpusDir, manifest)) {
      for (const entry of entries) {
        const state = needed.get(entry.id); if (!state) continue;
        state.target = new Float64Array(manifest.config.dimensions);
        for (let dimension = 0; dimension < state.target.length; dimension++) state.target[dimension] = entry.vector.readFloatLE(dimension * 4);
        state.targetNorm = vectorNorm(entry.vector, manifest.config.dimensions); needed.delete(entry.id);
      }
      if (!needed.size) break;
    }
    if (needed.size) throw new Error("Target identities missing from corpus");
    let scoredSegments = 0;
    for await (const { segmentIndex, segment, entries } of corpusEntries(corpusDir, manifest)) {
      const active = pending.filter(state => state.checkpoint.processedCorpusSegments <= segmentIndex);
      if (!active.length) continue;
      const buffers = active.map(() => Buffer.allocUnsafe(entries.length * 2)); const dots = new Float64Array(active.length);
      for (let row = 0; row < entries.length; row++) {
        const entry = entries[row]; dots.fill(0); let squared = 0;
        for (let dimension = 0; dimension < manifest.config.dimensions; dimension++) {
          const value = entry.vector.readFloatLE(dimension * 4);
          if (!Number.isFinite(value)) throw new Error("Non-finite component in target score preparation");
          squared += value * value;
          // Every target dot keeps precisely its original float64 dimension order.
          for (let target = 0; target < active.length; target++) dots[target] += value * active[target].target[dimension];
        }
        const norm = Math.sqrt(squared);
        for (let target = 0; target < active.length; target++) {
          const state = active[target]; const denominator = norm * state.targetNorm;
          if (!(denominator > 0) || !Number.isFinite(denominator)) throw new Error("Invalid target score preparation denominator");
          const scaled = Math.max(-1, Math.min(1, dots[target] / denominator)) * SCORE_MAX;
          const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
          const score = entry.id === state.targetId ? SCORE_MAX : Math.max(SCORE_MIN, Math.min(SCORE_MAX, rounded));
          buffers[target].writeInt16LE(score, row * 2); state.checkpoint.histogram[scoreIndex(score)]++;
        }
      }
      for (let target = 0; target < active.length; target++) {
        const state = active[target], checkpoint = state.checkpoint, scores = buffers[target];
        if (entries[0].id !== checkpoint.scoresWritten || checkpoint.processedCorpusSegments !== segmentIndex) throw new Error("Target preparation checkpoint coverage mismatch");
        await state.handle.write(scores, 0, scores.length, checkpoint.scoresBytes); await state.handle.sync();
        if (testStopAfterScoreSyncTargetId === state.targetId) throw new TargetBuildInterrupted("Test interruption after grouped score sync before checkpoint");
        checkpoint.scoreParts.push({ corpusSegment: segment.file, offset: checkpoint.scoresBytes, bytes: scores.length, sha256: sha256(scores) });
        checkpoint.processedCorpusSegments++; checkpoint.scoresWritten += entries.length; checkpoint.scoresBytes += scores.length;
        await durableWrite(state.checkpointPath, `${JSON.stringify(checkpoint)}\n`);
      }
      scoredSegments++;
      if (testStopAfterSegment === segmentIndex + 1) throw new TargetBuildInterrupted("Test interruption after grouped target checkpoint");
    }
    for (const state of states) if (state.checkpoint.scoresWritten !== manifest.stats.accepted || state.checkpoint.histogram.reduce((sum, n) => sum + n, 0) !== manifest.stats.accepted) throw new Error("Grouped target preparation does not cover the corpus");
    return { prepared: states.length, scoredSegments };
  } finally {
    const cleanups = await Promise.allSettled(states.map(async state => { try { await state.handle?.close(); } finally { await releaseLock(state.lock); } }));
    releaseTargetCacheGuard(cacheGuard);
    const failedCleanup = cleanups.find(result => result.status === "rejected");
    if (failedCleanup) throw failedCleanup.reason;
  }
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: --corpus DIR --output DIR --target-id N [--page-entries N] [--recover-lock-owner ID]"); values[argv[index].slice(2)] = argv[index + 1]; }
  if (!values.corpus || !values.output || values["target-id"] === undefined) throw new Error("--corpus, --output and --target-id are required");
  return { corpusDir: values.corpus, outputDir: values.output, targetId: Number(values["target-id"]), ...(values["page-entries"] ? { pageEntries: Number(values["page-entries"]) } : {}), ...(values["max-cached-targets"] ? { maxCachedTargets: Number(values["max-cached-targets"]) } : {}), ...(values["recover-lock-owner"] ? { recoverLockOwner: values["recover-lock-owner"] } : {}), ...(process.env.BRAISE_TEST_HOLD_AFTER_LOCK_MS ? { testHoldAfterLockMs: Number(process.env.BRAISE_TEST_HOLD_AFTER_LOCK_MS) } : {}) };
}

if (process.argv[1] && basename(process.argv[1]) === "build-semantic-target-v2.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildSemanticTarget(parseArgs(process.argv.slice(2))).then(manifest => console.log(JSON.stringify({ corpusId: manifest.corpus.id, targetId: manifest.target.id, dictionarySize: manifest.stats.dictionarySize, valuePages: manifest.stats.valuePages, orderPages: manifest.stats.orderPages }))).catch(error => { console.error(error.message); process.exitCode = error instanceof TargetBuildInterrupted ? 75 : 1; });
