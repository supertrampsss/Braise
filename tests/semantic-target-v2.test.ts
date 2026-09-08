import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticTarget, TargetBuildInterrupted } from "../scripts/build-semantic-target-v2.mjs";
import { verifySemanticTarget } from "../scripts/verify-semantic-target-v2.mjs";
import { evictSemanticTarget } from "../scripts/evict-semantic-target-v2.mjs";

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "braise-target-v2-"));
  return { root, source: join(root, "source.vec"), corpus: join(root, "corpus"), targets: join(root, "targets") };
}
async function remove(root: string) { await rm(root, { recursive: true, force: true }); }

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
    const reader = verifySemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0, testHoldAfterCacheLockMs: 100 });
    await new Promise(resolveDelay => setTimeout(resolveDelay, 20));
    await assert.rejects(evictSemanticTarget({ corpusDir: paths.corpus, outputDir: paths.targets, targetId: 0 }), /cache operation owns/);
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
