import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticTarget } from "../scripts/build-semantic-target-v2.mjs";
import { evictSemanticTarget } from "../scripts/evict-semantic-target-v2.mjs";
import { captureEditorialEvidence, expandEditorialEvidence, verifyEditorialEvidence, verifyEditorialEvidenceBatch } from "../scripts/editorial-evidence-v2.mjs";
import { buildEditorialCatalogue } from "../scripts/build-editorial-catalogue-v2.mjs";
import { verifyEditorialCatalogue } from "../scripts/verify-editorial-catalogue-v2.mjs";
import { sha256, stableJson } from "../scripts/semantic-target-v2-common.mjs";

test("bounded batch verification matches the unchanged scalar oracle and rejects forged evidence", async t => {
  const root = await mkdtemp(join(tmpdir(), "braise-editorial-batch-"));
  try {
    const corpusDir = join(root, "corpus"), targetsDir = join(root, "targets"), evidenceDir = join(root, "evidence");
    const sourcePath = join(root, "source.vec"), selectionPath = join(root, "selection.json"), cataloguePath = join(root, "catalogue.json");
    const rows = Array.from({ length: 400 }, (_, i) => {
      const word = `mot${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`;
      const vector = i < 80 ? [1, 0, 0] : i === 80 ? [0, 1, 0] : i === 81 ? [-1, 0, 0] : i === 82 ? [0, 0, 1] : [Math.sin(i * 0.137), Math.cos(i * 0.231), Math.sin(i * 0.019)];
      return `${word} ${vector.join(" ")}`;
    });
    await writeFile(sourcePath, `400 3\n${rows.join("\n")}\n`);
    const manifest = await buildSemanticCorpus({ sourcePath, outputDir: corpusDir, segmentEntries: 64 });
    const ids = [399, 0, 81, 80, 82, 200, 180, 120, 250];
    for (const targetId of ids) {
      await buildSemanticTarget({ corpusDir, outputDir: targetsDir, targetId, pageEntries: 256, maxCachedTargets: 1 });
      await captureEditorialEvidence({ corpusDir, targetsDir, evidenceDir, targetId });
      await evictSemanticTarget({ corpusDir, outputDir: targetsDir, targetId });
    }
    const indexPath = join(evidenceDir, "index.json");
    const index = JSON.parse(await readFile(indexPath, "utf8"));
    const original = index.entries.find((entry: { targetId: number }) => entry.targetId === 399);
    const legacy = JSON.parse(await readFile(join(evidenceDir, original.file), "utf8"));
    legacy.schemaVersion = 1; legacy.neighborhood.entries = legacy.neighborhood.entries.slice(0, 12);
    delete legacy.supersedesEvidenceSha256; delete legacy.verification.neighborhoodVerifierContract;
    const legacySha = sha256(Buffer.from(stableJson(legacy))), legacyFile = `evidence-0000000399-${legacySha}.json`;
    await writeFile(join(evidenceDir, legacyFile), JSON.stringify(legacy));
    Object.assign(original, { file: legacyFile, sha256: legacySha, revisions: [] });
    await writeFile(indexPath, JSON.stringify(index));
    await expandEditorialEvidence({ corpusDir, evidenceDir, targetId: 399, parentSha256: legacySha });
    const finalIndex = JSON.parse(await readFile(indexPath, "utf8"));
    const requests = ids.map(targetId => ({ targetId, expectedSha256: finalIndex.entries.find((e: { targetId: number }) => e.targetId === targetId).sha256 as string }));

    await t.test("one and eight targets retain scalar parity, signed scores and stable cutoff ties", async () => {
      for (const batch of [requests.slice(0, 1), requests.slice(0, 8)]) {
        const expected = [];
        for (const request of batch) expected.push(await verifyEditorialEvidence({ corpusDir, evidenceDir, ...request }));
        assert.deepEqual(await verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: batch }), expected);
      }
      const zero = finalIndex.entries.find((e: { targetId: number }) => e.targetId === 0);
      const proof = JSON.parse(await readFile(join(evidenceDir, zero.file), "utf8"));
      assert.deepEqual(proof.neighborhood.entries.map((e: { id: number }) => e.id), Array.from({ length: 64 }, (_, i) => i + 1));
      assert.equal(proof.neighborhood.entries[0].score, 10000);
      const histogram: number[] = JSON.parse(proof.targetManifest.utf8).histogram;
      assert.ok(histogram[0] > 0 && histogram[10000] > 0 && histogram[20000] > 0);
    });
    await t.test("mixed legacy and head requests use their exact hash and preserve request order", async () => {
      const mixed = [requests[1], { targetId: 399, expectedSha256: legacySha }];
      const result = await verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: mixed });
      assert.deepEqual(result.map(row => [row.targetId, row.neighbors]), [[0, 64], [399, 12]]);
      assert.deepEqual(result[1], await verifyEditorialEvidence({ corpusDir, evidenceDir, targetId: 399, expectedSha256: legacySha }));
    });
    await t.test("request metadata cannot override the pinned corpus or evidence directory", async () => {
      const injected = { ...requests[0], corpus: {}, evidenceDir: join(root, "untrusted") };
      assert.deepEqual(await verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [injected] }), [await verifyEditorialEvidence({ corpusDir, evidenceDir, ...requests[0] })]);
    });
    await t.test("caller mutations after invocation cannot enlarge the batch or change its pins", async () => {
      const mutable = [{ ...requests[0] }];
      const pending = verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: mutable });
      mutable[0].expectedSha256 = "f".repeat(64); mutable[0].targetId = 1;
      mutable.push(...requests);
      assert.deepEqual(await pending, [await verifyEditorialEvidence({ corpusDir, evidenceDir, ...requests[0] })]);
    });
    await t.test("empty, duplicate, oversized and missing-hash batches fail explicitly", async () => {
      assert.deepEqual(await verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [] }), []);
      await assert.rejects(verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests }), /Invalid editorial verification batch/);
      await assert.rejects(verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [requests[0], requests[0]] }), /Invalid editorial verification batch/);
      await assert.rejects(verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [{ targetId: 0, expectedSha256: "f".repeat(64) }] }), /missing or changed/);
    });
    await t.test("corrupt ancestors are not ignored for head or legacy requests", async () => {
      const path = join(evidenceDir, legacyFile), bytes = await readFile(path);
      await writeFile(path, "{}");
      for (const expectedSha256 of [legacySha, requests[0].expectedSha256]) await assert.rejects(verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [{ targetId: 399, expectedSha256 }] }), /contract is invalid/);
      await writeFile(path, bytes);
    });
    await t.test("a self-consistent forged histogram still fails exhaustive verification", async () => {
      const indexBytes = await readFile(indexPath);
      const item = finalIndex.entries.find((entry: { targetId: number }) => entry.targetId === 0);
      const proof = JSON.parse(await readFile(join(evidenceDir, item.file), "utf8"));
      const archived = JSON.parse(proof.targetManifest.utf8);
      archived.histogram[0]--; archived.histogram[1]++;
      proof.targetManifest.utf8 = JSON.stringify(archived);
      proof.targetManifest.sha256 = sha256(Buffer.from(proof.targetManifest.utf8));
      proof.verification.histogramSha256 = sha256(Buffer.from(stableJson(archived.histogram)));
      const hash = sha256(Buffer.from(stableJson(proof))), file = `evidence-0000000000-${hash}.json`;
      await writeFile(join(evidenceDir, file), JSON.stringify(proof));
      const forgedIndex = JSON.parse(indexBytes.toString());
      Object.assign(forgedIndex.entries.find((entry: { targetId: number }) => entry.targetId === 0), { file, sha256: hash });
      await writeFile(indexPath, JSON.stringify(forgedIndex));
      await assert.rejects(verifyEditorialEvidenceBatch({ corpusDir, evidenceDir, requests: [{ targetId: 0, expectedSha256: hash }] }), /exhaustive histogram mismatch/);
      await writeFile(indexPath, indexBytes);
    });
    const active = JSON.parse(await readFile(join(corpusDir, "active.json"), "utf8"));
    await writeFile(selectionPath, JSON.stringify({ schemaVersion: 1, corpusId: manifest.corpusId, corpusManifestSha256: active.manifestSha256, semanticSha256: manifest.semanticSha256, status: "lexical-agent-reviewed-neighbors-pending", reviews: [{ actor: "synthetic-fixture-agent", kind: "agent", reviewedAt: "2026-09-08T08:00:00.000Z", groups: { "quotidien.low": Array.from({ length: 400 }, (_, id) => id) } }] }));
    await buildEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, selectionPath, outputPath: cataloguePath });
    await t.test("catalogue progress reports successful bounded batches, not whole-catalogue completion", async () => {
      const progress: number[] = [];
      const result = await verifyEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, cataloguePath, onProgress: event => { assert.equal(event.stage, "editorial-evidence"); assert.equal(event.total, 9); progress.push(event.completed); } });
      assert.deepEqual(progress, [8, 9]); assert.equal(result.evidenceReady, 9);
      await assert.rejects(verifyEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, cataloguePath, onProgress: () => { throw new Error("observer stopped"); } }), /observer stopped/);
    });
    await t.test("a forged ninth proof cannot emit second-batch success", async () => {
      const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
      const last = catalogue.entries.filter((entry: { numericalStatus: string }) => entry.numericalStatus !== "not-prepared").at(-1);
      const item = finalIndex.entries.find((entry: { targetId: number }) => entry.targetId === last.targetId);
      const proof = JSON.parse(await readFile(join(evidenceDir, item.file), "utf8"));
      proof.neighborhood.entries.at(-1).score--;
      const hash = sha256(Buffer.from(stableJson(proof))), file = `evidence-${String(last.targetId).padStart(10, "0")}-${hash}.json`;
      await writeFile(join(evidenceDir, file), JSON.stringify(proof));
      Object.assign(item, { file, sha256: hash }); await writeFile(indexPath, JSON.stringify(finalIndex));
      last.neighborhood.evidenceSha256 = hash; await writeFile(cataloguePath, JSON.stringify(catalogue));
      const progress: number[] = [];
      await assert.rejects(verifyEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, cataloguePath, onProgress: e => { progress.push(e.completed); } }), /neighborhood differs/);
      assert.deepEqual(progress, [8]);
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
