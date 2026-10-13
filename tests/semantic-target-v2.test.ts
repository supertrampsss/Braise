import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticTarget, buildSemanticTargets, prepareSemanticTargetScoresBatch, TargetBuildInterrupted, targetOrderingStorage, MAX_MEMORY_TARGET_RECORDS } from "../scripts/build-semantic-target-v2.mjs";
import { verifySemanticTarget, verifySemanticTargetsUnderGuard, targetVerificationStorage, MAX_MEMORY_VERIFICATION_RECORDS } from "../scripts/verify-semantic-target-v2.mjs";
import { evictSemanticTarget, evictSemanticTargets } from "../scripts/evict-semantic-target-v2.mjs";

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "braise-target-v2-"));
  return { root, source: join(root, "source.vec"), corpus: join(root, "corpus"), targets: join(root, "targets") };
}
// Windows can briefly report ENOTEMPTY after closed fixture files are unlinked.
// Retry teardown only; eviction assertions and persistent errors stay unchanged.
async function remove(root: string) { await rm(root, { recursive: true, force: true, maxRetries: process.platform === 'win32' ? 3 : 0, retryDelay: 100 }); }

const fixture = "6 2\nalpha 1 0\nbêta 1 0\ngamma 0 1\ndelta 0 -1\nepsilon -1 0\nomega 1 1";

async function decodedTarget(paths: Awaited<ReturnType<typeof workspace>>, targetId: number) {
  const corpusActive = JSON.parse(await readFile(join(paths.corpus, "active.json"), "utf8"));
  const corpusManifest = JSON.parse(await readFile(join(paths.corpus, corpusActive.manifest), "utf8"));
  const targetDir = join(paths.targets, corpusManifest.corpusId, "targets", String(targetId).padStart(10, "0"));
  const active = JSON.parse(await readFile(join(targetDir, "active.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(targetDir, active.manifest), "utf8"));
  const values = gunzipSync(await readFile(join(targetDir, "pages", manifest.valuePages[0].file)));
  const order = gunzipSync(await readFile(join(targetDir, "pages", manifest.orderPages[0].file)));
  const count = manifest.stats.dictionarySize; const scores = []; const ranks = []; const ids = [];
  for (let index = 0; index < count; index++) { scores.push(values.readInt16LE(64 + index * 2)); ranks.push(values.readUInt32LE(64 + count * 2 + index * 4)); ids.push(order.readUInt32LE(64 + index * 4)); }
  return { active, manifest, scores, ranks, ids };
}

test("every admitted BRV2 word is eligible as a fully verified target", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    for (let targetId = 0; targetId < 6; targetId++) {
      const manifest = await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId, pageEntries: 256 });
      assert.equal(manifest.stats.dictionarySize, 6); assert.equal(manifest.histogram.reduce((sum: number, value: number) => sum + value, 0), 6);
      const verified = await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId });
      assert.equal(verified.dictionarySize, 6); assert.equal(verified.targetId, targetId);
    }
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 6 }), /outside the admitted corpus/);
  } finally { await remove(paths.root); }
});

test("quantized cosine, competition ranks and stable tie order are exact", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 3 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, pageEntries: 256 });
    const target = await decodedTarget(paths, 0);
    assert.deepEqual(target.scores, [10_000, 10_000, 0, 0, -10_000, 7_071]);
    assert.deepEqual(target.ranks, [1, 1, 4, 4, 6, 3]);
    assert.deepEqual(target.ids, [0, 1, 5, 2, 3, 4]);
    assert.equal(target.manifest.config.contract.rankEncoding, "uint32-little-endian");
  } finally { await remove(paths.root); }
});

test("target scoring resumes identically across every durable score boundary", async () => {
  for (const stop of ["checkpoint", "sync", "pages"] as const) {
    const resumed = await workspace(); const clean = await workspace();
    try {
      await writeFile(resumed.source, fixture); await writeFile(clean.source, fixture);
      await buildSemanticCorpus({ sourcePath: resumed.source, outputDir: resumed.corpus, segmentEntries: 2 });
      await buildSemanticCorpus({ sourcePath: clean.source, outputDir: clean.corpus, segmentEntries: 2 });
      const interruption = stop === "checkpoint" ? { testStopAfterCorpusSegments: 1 } : stop === "sync" ? { testStopAfterScoreSync: 2 } : { testStopAfterPages: true };
      await assert.rejects(buildSemanticTarget({ corpusDir: resumed.corpus, outputDir: resumed.targets, targetId: 5, pageEntries: 256, ...interruption }), TargetBuildInterrupted);
      const resumedManifest = await buildSemanticTarget({ corpusDir: resumed.corpus, outputDir: resumed.targets, targetId: 5, pageEntries: 256 });
      const cleanManifest = await buildSemanticTarget({ corpusDir: clean.corpus, outputDir: clean.targets, targetId: 5, pageEntries: 256 });
      assert.deepEqual(resumedManifest.valuePages.map((page: { objectSha256: string }) => page.objectSha256), cleanManifest.valuePages.map((page: { objectSha256: string }) => page.objectSha256));
      assert.deepEqual(resumedManifest.orderPages.map((page: { objectSha256: string }) => page.objectSha256), cleanManifest.orderPages.map((page: { objectSha256: string }) => page.objectSha256));
      await verifySemanticTarget({ corpusDir: resumed.corpus, outputDir: resumed.targets, targetId: 5 });
    } finally { await remove(resumed.root); await remove(clean.root); }
  }
});

test("corrupt pages and incompatible rebuilds never receive a new activation", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, pageEntries: 256 });
    const before = await decodedTarget(paths, 1); const targetDir = join(paths.targets, before.manifest.corpus.id, "targets", "0000000001");
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, pageEntries: 512 }), /does not match/);
    assert.deepEqual(JSON.parse(await readFile(join(targetDir, "active.json"), "utf8")), before.active);
    const pagePath = join(targetDir, "pages", before.manifest.valuePages[0].file); const bytes = await readFile(pagePath); bytes[Math.floor(bytes.length / 2)] ^= 1; await writeFile(pagePath, bytes);
    await assert.rejects(verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1 }), /hash mismatch|invalid target page/i);
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, pageEntries: 256 }), /hash mismatch|invalid target page/i);
  } finally { await remove(paths.root); }
});

test("uint32 ranks and order cross the 65,535 boundary", async () => {
  const paths = await workspace();
  try {
    const count = 65_537; const letters = (value: number) => { let word = ""; for (let current = value + 1; current > 0; current = Math.floor((current - 1) / 26)) word = String.fromCharCode(97 + (current - 1) % 26) + word; return `mot${word}`; };
    const rows = Array.from({ length: count }, (_, index) => `${letters(index)} ${index === count - 1 ? -1 : 1}`).join("\n");
    await writeFile(paths.source, `${count} 1\n${rows}`);
    await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 4_096 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, pageEntries: 65_536 });
    const verified = await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
    assert.equal(verified.dictionarySize, count);
    const corpusActive = JSON.parse(await readFile(join(paths.corpus, "active.json"), "utf8"));
    const corpusManifest = JSON.parse(await readFile(join(paths.corpus, corpusActive.manifest), "utf8"));
    const targetDir = join(paths.targets, corpusManifest.corpusId, "targets", "0000000000");
    const active = JSON.parse(await readFile(join(targetDir, "active.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(targetDir, active.manifest), "utf8"));
    const firstValues = gunzipSync(await readFile(join(targetDir, "pages", manifest.valuePages[0].file)));
    const lastValues = gunzipSync(await readFile(join(targetDir, "pages", manifest.valuePages[1].file)));
    const lastOrder = gunzipSync(await readFile(join(targetDir, "pages", manifest.orderPages[1].file)));
    assert.equal(firstValues.readUInt32LE(64 + manifest.valuePages[0].count * 2), 1);
    assert.equal(lastValues.readUInt32LE(64 + manifest.valuePages[1].count * 2), count);
    assert.equal(lastOrder.readUInt32LE(64), count - 1);
  } finally { await remove(paths.root); }
});

test("the global staging quota prevents quadratic target accumulation", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, maxCachedTargets: 2 });
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 2, maxCachedTargets: 2 }), /cache quota reached/);
    await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
  } finally { await remove(paths.root); }
});

test("an interrupted target reserves its bounded cache slot before the first checkpoint", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 1, testStopAfterScoreSync: 1 }), TargetBuildInterrupted);
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, maxCachedTargets: 1 }), /cache quota reached/);
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 1 });
    await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
  } finally { await remove(paths.root); }
});

test("explicit eviction is verified, frees one slot and regenerates identical immutable pages", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, maxCachedTargets: 2 });
    const before = await decodedTarget(paths, 0);
    const result = await evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
    assert.equal(result.evicted, true);
    await assert.rejects(verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 }), /ENOENT|no such file/i);
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 2, maxCachedTargets: 2 });
    await evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 2 });
    const after = await decodedTarget(paths, 0);
    assert.equal(after.active.manifestSha256, before.active.manifestSha256);
    assert.deepEqual(after.manifest.valuePages.map((page: { objectSha256: string }) => page.objectSha256), before.manifest.valuePages.map((page: { objectSha256: string }) => page.objectSha256));
  } finally { await remove(paths.root); }
});

test("eviction never removes a target while a verified reader owns the shared guard", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
    let releaseReader!: () => void; let acquired!: () => void;
    const locked = new Promise<void>(resolve => { acquired = resolve; });
    const hold = new Promise<void>(resolve => { releaseReader = resolve; });
    const reader = verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, testOnCacheLock: async () => { acquired(); await hold; } });
    try {
      await Promise.race([locked, reader]);
      await assert.rejects(evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 }), /cache operation owns/);
    } finally { releaseReader(); await reader; }
    assert.equal((await reader).targetId, 0);
    assert.equal((await evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 })).evicted, true);
  } finally { await remove(paths.root); }
});

test("shared verification accepts the empty legacy cache guard created by B1c", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 });
    const corpusActive = JSON.parse(await readFile(join(paths.corpus, "active.json"), "utf8")); const corpusManifest = JSON.parse(await readFile(join(paths.corpus, corpusActive.manifest), "utf8"));
    await writeFile(join(paths.targets, corpusManifest.corpusId, "targets", ".cache-guard.sqlite"), Buffer.alloc(0));
    assert.equal((await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 })).targetId, 0);
  } finally { await remove(paths.root); }
});

test("interrupted eviction remains counted and resumes before another cache mutation", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 1 });
    await assert.rejects(evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, testStopAfterRename: true }), /Test interruption/);
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 2 }), /interrupted eviction/);
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, maxCachedTargets: 1 }), /cache quota reached/);
    const corpusActive = JSON.parse(await readFile(join(paths.corpus, "active.json"), "utf8")); const corpusManifest = JSON.parse(await readFile(join(paths.corpus, corpusActive.manifest), "utf8")); const targetsRoot = join(paths.targets, corpusManifest.corpusId, "targets");
    const tombstone = (await readdir(targetsRoot)).find(name => name.startsWith(".evicted-0000000000-")); assert.ok(tombstone); await rm(join(targetsRoot, tombstone), { recursive: true });
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, maxCachedTargets: 2 }), /interrupted eviction/);
    assert.equal((await evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 })).evicted, false);
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1, maxCachedTargets: 1 });
    await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 1 });
  } finally { await remove(paths.root); }
});


test("bounded verifier memory has a hard 10 MiB record cap and keeps the SQLite fallback", () => {
  assert.equal(MAX_MEMORY_VERIFICATION_RECORDS * 10, 10 * 1024 * 1024);
  assert.equal(targetVerificationStorage(MAX_MEMORY_VERIFICATION_RECORDS), "bounded-memory");
  assert.equal(targetVerificationStorage(MAX_MEMORY_VERIFICATION_RECORDS + 1), "sqlite");
  assert.equal(targetVerificationStorage(6, "sqlite"), "sqlite");
  for (const invalid of [0, -1, NaN, 1.5, 0x1_0000_0000]) assert.throws(() => targetVerificationStorage(invalid), /Invalid/);
  assert.throws(() => targetVerificationStorage(6, "unbounded"), /Invalid/);
});

test("memory counting verification equals the original SQL oracle at signed extremes and exact ties", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    for (const targetId of [0, 1, 4, 5]) {
      await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId, pageEntries: 256 });
      const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetId };
      const sqlite = await verifySemanticTarget({ ...options, verificationStorage: "sqlite" });
      const memory = await verifySemanticTarget(options);
      assert.deepEqual(memory, sqlite);
    }
  } finally { await remove(paths.root); }
});


test("grouped score preparation reproduces scalar manifests and resumes both durable boundaries", async () => {
  for (const boundary of ["clean", "checkpoint", "sync"] as const) {
    const paths = await workspace();
    try {
      await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
      const scalarDir = join(paths.root, "scalar"); const ids = [0, 1, 3, 5];
      const reference = [];
      for (const targetId of ids) reference.push(await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: scalarDir, targetId, pageEntries: 256 }));
      const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: ids, pageEntries: 256 };
      if (boundary !== "clean") await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, ...(boundary === "checkpoint" ? { testStopAfterSegment: 1 } : { testStopAfterScoreSyncTargetId: 1 }) }), TargetBuildInterrupted);
      await prepareSemanticTargetScoresBatch(options);
      const corpus = reference[0].corpus.id;
      for (const targetId of ids) await assert.rejects(readFile(join(paths.targets, corpus, "targets", String(targetId).padStart(10, "0"), "active.json")), /ENOENT/);
      for (let index = 0; index < ids.length; index++) {
        const actual = await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: ids[index], pageEntries: 256 });
        assert.deepEqual(actual, reference[index]);
        const verified = await verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: ids[index], verificationStorage: "sqlite" });
        assert.equal(verified.dictionarySize, 6);
      }
    } finally { await remove(paths.root); }
  }
});

test("grouped preparation does not bypass quota, live locks, incompatible checkpoints or target bounds", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, "10 2\nalpha 1 0\nbeta 0 1\ngamma -1 0\ndelta 0 -1\nepsilon 1 1\nomega -1 -1\nsigma 1 -1\ntheta -1 1\nlambda 2 1\nkappa 1 2");
    const corpus = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0, 1, 2, 3, 4, 5, 6, 7] };
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [...options.targetIds, 8] }), /one to eight/);
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [0, 0] }), /distinct/);
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [10] }), /outside/);
    await prepareSemanticTargetScoresBatch(options);
    await assert.rejects(buildSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 8 }), /cache quota/);
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [8] }), /cache quota/);
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [0], pageEntries: 256 }), /configuration/);
    const targetDir = join(paths.targets, corpus.corpusId, "targets", "0000000000");
    const lockBytes = JSON.stringify({ owner: "live-owner", pid: process.pid }); await writeFile(join(targetDir, ".target.lock"), lockBytes);
    await assert.rejects(prepareSemanticTargetScoresBatch({ ...options, targetIds: [0] }), /Another target build owns/);
    assert.equal(await readFile(join(targetDir, ".target.lock"), "utf8"), lockBytes);
  } finally { await remove(paths.root); }
});


test("producer comparison sorting is bounded and keeps a forced independent SQL baseline", () => {
  assert.equal(MAX_MEMORY_TARGET_RECORDS * 6, 6 * 1024 * 1024);
  assert.equal(targetOrderingStorage(MAX_MEMORY_TARGET_RECORDS), "bounded-memory");
  assert.equal(targetOrderingStorage(MAX_MEMORY_TARGET_RECORDS + 1), "sqlite");
  assert.equal(targetOrderingStorage(6, "sqlite"), "sqlite");
  for (const value of [0, -1, NaN, 1.5, 0x1_0000_0000]) assert.throws(() => targetOrderingStorage(value), /Invalid/);
});

import { acquireTargetCacheGuard, releaseTargetCacheGuard, loadActiveCorpus, sha256 } from "../scripts/semantic-target-v2-common.mjs";
import { canonicalGzip } from "../scripts/canonical-gzip.mjs";
import { captureEditorialEvidenceBatch } from "../scripts/editorial-evidence-v2.mjs";
import { checkRuntimeArchive } from "../scripts/semantic-runtime-archive.mjs";

test("eight grouped targets and independent grouped oracle exactly equal scalar SQL manifests and proofs", async () => {
  const paths = await workspace();
  try {
    const lines = ["32 32"];
    for (let row = 0; row < 32; row++) {
      const word = `mot${String.fromCharCode(97 + Math.floor(row / 26))}${String.fromCharCode(97 + row % 26)}`;
      const vector = Array.from({ length: 32 }, (_, column) => ((row * 17 + column * 11) % 31 - 15) / 17);
      lines.push(`${word} ${vector.join(" ")}`);
    }
    await writeFile(paths.source, lines.join("\n"));
    await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 3 });
    const targetIds = [0, 1, 2, 3, 4, 5, 6, 7]; const scalarDir = join(paths.root, "scalar"); const baseline = [];
    for (const targetId of targetIds) baseline.push(await buildSemanticTarget({ corpusDir: paths.corpus, outputDir: scalarDir, targetId, pageEntries: 256, orderingStorage: "sqlite" }));
    const grouped = await buildSemanticTargets({ corpusDir: paths.corpus, outputDir: paths.targets, targetIds, pageEntries: 256 });
    assert.deepEqual(grouped.manifests, baseline);
    const corpus = await loadActiveCorpus(paths.corpus);
    const guard = acquireTargetCacheGuard(join(paths.targets, corpus.manifest.corpusId, "targets"), "shared");
    try {
      const requests = targetIds.map(targetId => ({ targetId }));
      const actual = await verifySemanticTargetsUnderGuard({ corpusDir: paths.corpus, outputDir: paths.targets, requests }, guard);
      const original = await verifySemanticTargetsUnderGuard({ corpusDir: paths.corpus, outputDir: paths.targets, requests: targetIds.map(targetId => ({ targetId, verificationStorage: "sqlite" })) }, guard);
      assert.deepEqual(actual, original);
      await assert.rejects(verifySemanticTargetsUnderGuard({ corpusDir: paths.corpus, outputDir: paths.targets, requests: [...requests, { targetId: 8 }] }, guard), /one to eight/);
      await assert.rejects(verifySemanticTargetsUnderGuard({ corpusDir: paths.corpus, outputDir: paths.targets, requests: [{ targetId: 0 }, { targetId: 0 }] }, guard), /Invalid/);
    } finally { releaseTargetCacheGuard(guard); }
  } finally { await remove(paths.root); }
});

test("self-consistent forged grouped score checkpoints cannot activate any target", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); const corpus = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0, 1], pageEntries: 256 };
    await prepareSemanticTargetScoresBatch(options);
    const root = join(paths.targets, corpus.corpusId, "targets"); const directory = join(root, "0000000001");
    const bytes = await readFile(join(directory, "scores.tmp")); const oldScore = bytes.readInt16LE(0); bytes.writeInt16LE(oldScore - 1, 0);
    const checkpoint = JSON.parse(await readFile(join(directory, "checkpoint.json"), "utf8"));
    checkpoint.histogram[oldScore + 10000]--; checkpoint.histogram[oldScore - 1 + 10000]++;
    const part = checkpoint.scoreParts[0]; part.sha256 = sha256(bytes.subarray(part.offset, part.offset + part.bytes));
    await writeFile(join(directory, "scores.tmp"), bytes); await writeFile(join(directory, "checkpoint.json"), JSON.stringify(checkpoint));
    await assert.rejects(buildSemanticTargets(options), /Target score mismatch/);
    for (const id of [0, 1]) {
      await assert.rejects(readFile(join(root, String(id).padStart(10, "0"), "active.json")), /ENOENT/);
      await assert.rejects(readFile(join(root, String(id).padStart(10, "0"), ".target.lock")), /ENOENT/);
    }
    await assert.rejects(buildSemanticTargets(options), /Target score mismatch/);
  } finally { await remove(paths.root); }
});

test("grouped eviction detects callback mutation before deleting even an earlier valid target", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0, 1] };
    const built = await buildSemanticTargets(options); const root = join(paths.targets, built.manifests[0].corpus.id, "targets");
    const page = join(root, "0000000001", "pages", built.manifests[1].valuePages[0].file); const original = await readFile(page);
    await assert.rejects(evictSemanticTargets({ ...options, beforeEviction: async proofs => {
      proofs[1].manifestSha256 = "0".repeat(64); const changed = Buffer.from(original); changed[changed.length - 1] ^= 1;
      await writeFile(page, changed); return [null, null];
    } }), /Verified target object changed/);
    for (const id of [0, 1]) assert.ok(await readFile(join(root, String(id).padStart(10, "0"), "active.json")));
    await writeFile(page, original);
    await assert.rejects(evictSemanticTargets({ ...options, beforeEviction: async () => { throw new Error("group archive failed"); } }), /group archive failed/);
    for (const id of [0, 1]) assert.ok(await readFile(join(root, String(id).padStart(10, "0"), "active.json")));
    const capture = await captureEditorialEvidenceBatch({ corpusDir: paths.corpus, targetsDir: paths.targets, targetIds: [0, 1], evidenceDir: join(paths.root, "e"), archiveDir: join(paths.root, "a") });
    assert.equal(capture.results.length, 2);
    const corpus = await loadActiveCorpus(paths.corpus);
    for (const id of [0, 1]) { await checkRuntimeArchive({ corpus, archiveDir: join(paths.root, "a"), targetId: id }); await assert.rejects(readFile(join(root, String(id).padStart(10, "0"), "active.json")), /ENOENT/); }
  } finally { await remove(paths.root); }
});


test("grouped verification refuses rehashed wrong ranks and tie order without deleting any target", async () => {
  for (const kind of ["rank", "order"]) {
    const paths = await workspace();
    try {
      await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
      const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0, 1] };
      const built = await buildSemanticTargets(options); const root = join(paths.targets, built.manifests[0].corpus.id, "targets"); const directory = join(root, "0000000001");
      const active = JSON.parse(await readFile(join(directory, "active.json"), "utf8")); const manifest = built.manifests[1];
      const page = kind === "rank" ? manifest.valuePages[0] : manifest.orderPages[0];
      const raw = gunzipSync(await readFile(join(directory, "pages", page.file)));
      if (kind === "rank") raw.writeUInt32LE(2, 64 + page.count * 2);
      else { const first = raw.readUInt32LE(64); raw.writeUInt32LE(raw.readUInt32LE(68), 64); raw.writeUInt32LE(first, 68); }
      const compressed = canonicalGzip(raw); page.rawSha256 = sha256(raw); page.objectSha256 = sha256(compressed); page.compressedBytes = compressed.length;
      page.file = page.file.replace(/[0-9a-f]{16}\.brt\.gz$/, `${page.objectSha256.slice(0, 16)}.brt.gz`);
      await writeFile(join(directory, "pages", page.file), compressed);
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`); active.manifestSha256 = sha256(manifestBytes); active.manifest = `manifest-${manifest.configHash.slice(0, 16)}-${active.manifestSha256.slice(0, 16)}.json`;
      await writeFile(join(directory, active.manifest), manifestBytes); await writeFile(join(directory, "active.json"), JSON.stringify(active));
      await assert.rejects(evictSemanticTargets(options), kind === "rank" ? /Competition rank mismatch/ : /Stable order mismatch/);
      for (const id of [0, 1]) assert.ok(await readFile(join(root, String(id).padStart(10, "0"), "active.json")));
    } finally { await remove(paths.root); }
  }
});

test("complete grouped checkpoints cannot hide late corpus corruption from activation", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); const corpus = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const options = { corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0, 1] }; await prepareSemanticTargetScoresBatch(options);
    const last = corpus.segments.at(-1); const file = join(paths.corpus, "segments", last.file); const bytes = await readFile(file); bytes[bytes.length - 1] ^= 1; await writeFile(file, bytes);
    await assert.rejects(buildSemanticTargets(options), /Corpus object hash mismatch/);
    for (const id of [0, 1]) await assert.rejects(readFile(join(paths.targets, corpus.corpusId, "targets", String(id).padStart(10, "0"), "active.json")), /ENOENT/);
  } finally { await remove(paths.root); }
});

test("later grouped archive failure retains all staged targets and the previous valid archive", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const evidenceDir = join(paths.root, "e"), archiveDir = join(paths.root, "a"); const capture = { corpusDir: paths.corpus, targetsDir: paths.targets, evidenceDir, archiveDir };
    await buildSemanticTargets({ corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [0] });
    await captureEditorialEvidenceBatch({ ...capture, targetIds: [0] });
    const corpus = await loadActiveCorpus(paths.corpus); const previous = await checkRuntimeArchive({ archiveDir, corpus, targetId: 0 });
    const original = await readFile(join(previous.root, `inventory-${previous.inventorySha256}.json`));
    await buildSemanticTargets({ corpusDir: paths.corpus, outputDir: paths.targets, targetIds: [1, 2] });
    await writeFile(join(archiveDir, corpus.manifest.corpusId, "targets", "0000000002"), "blocked");
    await assert.rejects(captureEditorialEvidenceBatch({ ...capture, targetIds: [1, 2] }), /EEXIST|ENOTDIR/);
    for (const id of [1, 2]) assert.ok(await readFile(join(paths.targets, corpus.manifest.corpusId, "targets", String(id).padStart(10, "0"), "active.json")));
    assert.deepEqual(await readFile(join(previous.root, `inventory-${previous.inventorySha256}.json`)), original);
    assert.equal((await checkRuntimeArchive({ archiveDir, corpus, targetId: 0 })).inventorySha256, previous.inventorySha256);
  } finally { await remove(paths.root); }
});


test("forced SQL oracle still opens its full-UUID temporary file under the Windows legacy 261-character path", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, fixture); const corpus = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2 });
    const tail = join(corpus.corpusId, "targets", "0000000000", ".verify-target-00000000-0000-0000-0000-000000000000.sqlite");
    const prefixLength = 261 - tail.length - 1;
    const outputDir = join(paths.root, "p".repeat(prefixLength - paths.root.length - 1));
    assert.equal(join(outputDir, tail).length, 261);
    await buildSemanticTarget({ corpusDir: paths.corpus, outputDir, targetId: 0 });
    const proof = await verifySemanticTarget({ corpusDir: paths.corpus, outputDir, targetId: 0, verificationStorage: "sqlite" });
    assert.equal(proof.dictionarySize, 6);
    assert.ok(!(await readdir(join(outputDir, corpus.corpusId, "targets", "0000000000"))).some(name => /^\.v[0-9a-f]{32}\.db$/.test(name)));
  } finally { await remove(paths.root); }
});
