import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticTarget } from "../scripts/build-semantic-target-v2.mjs";
import { evictSemanticTarget } from "../scripts/evict-semantic-target-v2.mjs";
import { captureEditorialEvidence, verifyEditorialEvidence } from "../scripts/editorial-evidence-v2.mjs";
import { buildEditorialCatalogue } from "../scripts/build-editorial-catalogue-v2.mjs";
import { verifyEditorialCatalogue } from "../scripts/verify-editorial-catalogue-v2.mjs";
import { sha256, stableJson } from "../scripts/semantic-target-v2-common.mjs";

function word(index: number) {
  let value = index; let suffix = "";
  do { suffix = String.fromCharCode(97 + value % 26) + suffix; value = Math.floor(value / 26); } while (value);
  return `mot${suffix}`;
}

test("durable B2 evidence survives eviction, keeps review binding and frees the quota", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-editorial-"));
  try {
    const source = join(root, "source.vec"), corpus = join(root, "corpus"), targets = join(root, "targets"), evidence = join(root, "evidence"), selectionPath = join(root, "selection.json"), outputPath = join(root, "catalogue.json");
    const rows = Array.from({ length: 400 }, (_, index) => `${word(index)} ${1 + index / 1000} ${1 - index / 2000}`);
    await writeFile(source, `400 2\n${rows.join("\n")}\n`);
    const manifest = await buildSemanticCorpus({ sourcePath: source, outputDir: corpus });
    await buildSemanticTarget({ corpusDir: corpus, outputDir: targets, targetId: 0, pageEntries: 256, maxCachedTargets: 1 });
    const active = JSON.parse(await readFile(join(corpus, "active.json"), "utf8"));
    const selection: Record<string, unknown> = { schemaVersion: 1, corpusId: manifest.corpusId, corpusManifestSha256: active.manifestSha256, semanticSha256: manifest.semanticSha256, status: "lexical-agent-reviewed-neighbors-pending", reviews: [{ actor: "fixture-agent", kind: "agent", reviewedAt: "2026-09-08T08:00:00.000Z", groups: { "quotidien.low": Array.from({ length: 400 }, (_, id) => id) } }] };
    await writeFile(selectionPath, JSON.stringify(selection));
    const captured = await captureEditorialEvidence({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, targetId: 0, capturedAt: "2026-09-08T09:00:00.000Z" });

    const pending = await buildEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, selectionPath, outputPath });
    assert.deepEqual({ evidence: pending.neighborhoodEvidenceReady, approved: pending.approved }, { evidence: 1, approved: 0 });

    const proof = JSON.parse(await readFile(join(evidence, captured.file), "utf8"));
    const hints = proof.neighborhood.entries.slice(0, 3).map((entry: { word: string }) => entry.word);
    selection.decisions = [{ targetId: 0, decision: "approved", kind: "agent", actor: "fixture-approval-agent", reviewedAt: "2026-09-08T09:05:00.000Z", rationale: "Voisinage synthétique vérifié pour le contrat.", hints, evidenceSha256: captured.evidenceSha256 }];
    await writeFile(selectionPath, JSON.stringify(selection));
    await buildEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, selectionPath, outputPath });
    assert.equal((await verifyEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, cataloguePath: outputPath })).approved, 1);

    const targetDir = join(targets, manifest.corpusId, "targets", "0000000000");
    const targetActive = JSON.parse(await readFile(join(targetDir, "active.json"), "utf8"));
    const targetManifest = JSON.parse(await readFile(join(targetDir, targetActive.manifest), "utf8"));
    const missingPage = join(targetDir, "pages", targetManifest.valuePages[0].file); const hiddenPage = `${missingPage}.hidden`;
    await rename(missingPage, hiddenPage);
    const falselyArchived = JSON.parse(await readFile(outputPath, "utf8")); falselyArchived.entries[0].numericalStatus = "verified-archived-evidence";
    await writeFile(outputPath, JSON.stringify(falselyArchived));
    await assert.rejects(verifyEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, cataloguePath: outputPath }), /ENOENT|no such file/i);
    await rename(hiddenPage, missingPage); await buildEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, selectionPath, outputPath });

    assert.equal((await evictSemanticTarget({ corpusDir: corpus, outputDir: targets, targetId: 0 })).evicted, true);
    await buildSemanticTarget({ corpusDir: corpus, outputDir: targets, targetId: 1, maxCachedTargets: 1 });
    await buildEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, selectionPath, outputPath });
    const archived = JSON.parse(await readFile(outputPath, "utf8")).entries[0];
    assert.equal(archived.numericalStatus, "verified-archived-evidence");
    assert.equal(archived.approval, "approved-agent");
    assert.equal((await verifyEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, evidenceDir: evidence, cataloguePath: outputPath })).approved, 1);
    const targetDirectories = (await readdir(join(targets, manifest.corpusId, "targets"), { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{10}$/.test(entry.name));
    assert.deepEqual(targetDirectories.map(entry => entry.name), ["0000000001"]);

    const tampered = structuredClone(proof); tampered.neighborhood.entries[0].score--;
    const tamperedSha = sha256(Buffer.from(stableJson(tampered))); const tamperedFile = `evidence-0000000000-${tamperedSha}.json`;
    await writeFile(join(evidence, tamperedFile), JSON.stringify(tampered));
    const index = JSON.parse(await readFile(join(evidence, "index.json"), "utf8"));
    Object.assign(index.entries[0], { file: tamperedFile, sha256: tamperedSha });
    await writeFile(join(evidence, "index.json"), JSON.stringify(index));
    await assert.rejects(verifyEditorialEvidence({ corpusDir: corpus, evidenceDir: evidence, targetId: 0, expectedSha256: tamperedSha }), /neighborhood differs/);

    const malformed = structuredClone(proof); const archivedManifest = JSON.parse(malformed.targetManifest.utf8);
    archivedManifest.valuePages = []; archivedManifest.orderPages = []; archivedManifest.configHash = "0".repeat(64);
    malformed.targetManifest.utf8 = JSON.stringify(archivedManifest); malformed.targetManifest.sha256 = sha256(Buffer.from(malformed.targetManifest.utf8));
    const malformedSha = sha256(Buffer.from(stableJson(malformed))); const malformedFile = `evidence-0000000000-${malformedSha}.json`;
    await writeFile(join(evidence, malformedFile), JSON.stringify(malformed));
    Object.assign(index.entries[0], { file: malformedFile, sha256: malformedSha }); await writeFile(join(evidence, "index.json"), JSON.stringify(index));
    await assert.rejects(verifyEditorialEvidence({ corpusDir: corpus, evidenceDir: evidence, targetId: 0, expectedSha256: malformedSha }), /manifest contract is invalid/);

    const duplicated = structuredClone(proof); const duplicatedManifest = JSON.parse(duplicated.targetManifest.utf8);
    const secondFirstId = duplicatedManifest.valuePages[1].firstId;
    duplicatedManifest.valuePages[1] = { ...duplicatedManifest.valuePages[0], firstId: secondFirstId };
    duplicated.targetManifest.utf8 = JSON.stringify(duplicatedManifest); duplicated.targetManifest.sha256 = sha256(Buffer.from(duplicated.targetManifest.utf8));
    const duplicatedSha = sha256(Buffer.from(stableJson(duplicated))); const duplicatedFile = `evidence-0000000000-${duplicatedSha}.json`;
    await writeFile(join(evidence, duplicatedFile), JSON.stringify(duplicated));
    Object.assign(index.entries[0], { file: duplicatedFile, sha256: duplicatedSha }); await writeFile(join(evidence, "index.json"), JSON.stringify(index));
    await assert.rejects(verifyEditorialEvidence({ corpusDir: corpus, evidenceDir: evidence, targetId: 0, expectedSha256: duplicatedSha }), /manifest contract is invalid/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("evidence capture refuses direct and symbolic destinations inside target staging", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-editorial-path-"));
  try {
    const source = join(root, "source.vec"), corpus = join(root, "corpus"), targets = join(root, "targets");
    const rows = Array.from({ length: 400 }, (_, index) => `${word(index)} ${1 + index / 1000} ${1 - index / 2000}`);
    await writeFile(source, `400 2\n${rows.join("\n")}\n`); const manifest = await buildSemanticCorpus({ sourcePath: source, outputDir: corpus });
    await buildSemanticTarget({ corpusDir: corpus, outputDir: targets, targetId: 0, maxCachedTargets: 1 });
    const targetRoot = join(targets, manifest.corpusId, "targets");
    await assert.rejects(captureEditorialEvidence({ corpusDir: corpus, targetsDir: targets, evidenceDir: join(targetRoot, "proofs"), targetId: 0 }), /outside target staging/);
    const alias = join(root, "target-alias"); await symlink(targetRoot, alias, "dir");
    await assert.rejects(captureEditorialEvidence({ corpusDir: corpus, targetsDir: targets, evidenceDir: join(alias, "proofs"), targetId: 0 }), /outside target staging/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
