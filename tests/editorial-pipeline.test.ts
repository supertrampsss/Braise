import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticTarget } from "../scripts/build-semantic-target-v2.mjs";
import { buildEditorialCatalogue } from "../scripts/build-editorial-catalogue-v2.mjs";
import { verifyEditorialCatalogue } from "../scripts/verify-editorial-catalogue-v2.mjs";

function word(index: number) {
  let value = index; let suffix = "";
  do { suffix = String.fromCharCode(97 + value % 26) + suffix; value = Math.floor(value / 26); } while (value);
  return `mot${suffix}`;
}

test("B2 pipeline resolves 400 exact corpus identities and keeps approval pending", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-editorial-"));
  try {
    const source = join(root, "source.vec"), corpus = join(root, "corpus"), targets = join(root, "targets"), selectionPath = join(root, "selection.json"), outputPath = join(root, "catalogue.json");
    const rows = Array.from({ length: 400 }, (_, index) => `${word(index)} ${1 + index / 1000} ${1 - index / 2000}`);
    await writeFile(source, `400 2\n${rows.join("\n")}\n`);
    const manifest = await buildSemanticCorpus({ sourcePath: source, outputDir: corpus });
    await buildSemanticTarget({ corpusDir: corpus, outputDir: targets, targetId: 0 });
    const active = JSON.parse(await readFile(join(corpus, "active.json"), "utf8"));
    await writeFile(selectionPath, JSON.stringify({ schemaVersion: 1, corpusId: manifest.corpusId, corpusManifestSha256: active.manifestSha256, semanticSha256: manifest.semanticSha256, status: "lexical-agent-reviewed-neighbors-pending", reviews: [{ actor: "fixture-agent", kind: "agent", reviewedAt: "2026-09-08T08:00:00.000Z", groups: { "quotidien.low": Array.from({ length: 400 }, (_, id) => id) } }] }));
    const built = await buildEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, selectionPath, outputPath });
    assert.deepEqual({ selected: built.selected, evidence: built.neighborhoodEvidenceReady, approved: built.approved }, { selected: 400, evidence: 1, approved: 0 });
    const verified = await verifyEditorialCatalogue({ corpusDir: corpus, targetsDir: targets, cataloguePath: outputPath });
    assert.deepEqual({ selected: verified.selected, evidence: verified.evidenceReady, approved: verified.approved }, { selected: 400, evidence: 1, approved: 0 });
  } finally { await rm(root, { recursive: true, force: true }); }
});
