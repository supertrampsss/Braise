import test from "node:test";
import assert from "node:assert/strict";
import { isV2TargetEligible, validateEditorialCatalogue, type EditorialCatalogue, type EditorialEntry } from "../lib/editorial-catalogue";

const hash = "a".repeat(64);
function entry(targetId: number): EditorialEntry {
  return { targetId, word: `mot${String.fromCharCode(97 + targetId % 26)}${String.fromCharCode(97 + Math.floor(targetId / 26) % 26)}${String.fromCharCode(97 + Math.floor(targetId / 676) % 26)}`, category: "quotidien", ambiguity: "low", review: { actor: "review-agent", kind: "agent", reviewedAt: "2026-09-08T08:00:00.000Z", decision: "candidate" }, lexicalStatus: "agent-reviewed", numericalStatus: "not-prepared", neighborhood: { status: "not-measured", neighbors: [] }, hints: { status: "not-reviewed", words: [] }, approval: "pending" };
}
function catalogue(): EditorialCatalogue {
  const entries = Array.from({ length: 400 }, (_, id) => entry(id));
  return { schemaVersion: 1, id: "fr-v2-editorial-catalogue-1", corpus: { id: "fr-fasttext-v2", manifestSha256: hash, semanticSha256: hash, dictionarySize: 1_013_881 }, status: "inactive-editorial-workbench", counts: { selected: 400, lexicalReviewed: 400, neighborhoodEvidenceReady: 0, approved: 0 }, entries };
}

test("400 agent-reviewed candidates remain distinct from approved targets", () => {
  const result = validateEditorialCatalogue(catalogue());
  assert.equal(result.entries.length, 400); assert.equal(result.counts.approved, 0);
  assert.equal(isV2TargetEligible(1_013_880, 1_013_881), true);
  assert.equal(isV2TargetEligible(1_013_881, 1_013_881), false);
});

test("catalogue refuses duplicate identities and unproven approvals", () => {
  const duplicate = catalogue(); duplicate.entries[1].targetId = duplicate.entries[0].targetId;
  assert.throws(() => validateEditorialCatalogue(duplicate), /invalid-editorial-entry/);
  const forged = catalogue(); const first = forged.entries[0];
  first.approval = "approved-agent"; forged.counts.approved = 1;
  assert.throws(() => validateEditorialCatalogue(forged), /invalid-unprepared-editorial-state|unproven-editorial-approval/);
  const misattributed = catalogue(); misattributed.entries[0].lexicalStatus = "human-reviewed";
  assert.throws(() => validateEditorialCatalogue(misattributed), /invalid-editorial-entry/);
  const malformed = catalogue(); malformed.entries[0].neighborhood.neighbors = [{ id: -1, word: "voisin" }, { id: -1, word: "voisin" }];
  assert.throws(() => validateEditorialCatalogue(malformed), /invalid-editorial-neighbor/);
  const badHints = catalogue(); badHints.entries[0].hints = { status: "reviewed", words: [null, 0, {}] as unknown as string[] };
  assert.throws(() => validateEditorialCatalogue(badHints), /invalid-editorial-hint/);
  const unexplainedRejection = catalogue(); unexplainedRejection.entries[0].approval = "rejected";
  assert.throws(() => validateEditorialCatalogue(unexplainedRejection), /invalid-unprepared-editorial-state|unproven-editorial-rejection/);
  const wrongHints = catalogue(); const reviewed = wrongHints.entries[0];
  reviewed.numericalStatus = "verified-archived-evidence";
  reviewed.neighborhood = { status: "reviewed-approved", neighbors: Array.from({ length: 6 }, (_, id) => ({ id: id + 500, word: `voisin${String.fromCharCode(97 + id)}` })), targetManifestSha256: hash, evidenceSha256: hash };
  reviewed.hints = { status: "reviewed", words: ["indicea", "indiceb", "indicec"] };
  reviewed.approval = "approved-agent";
  reviewed.approvalReview = { actor: "approval-agent", kind: "agent", reviewedAt: "2026-09-08T09:00:00.000Z", rationale: "Fixture.", evidenceSha256: hash };
  wrongHints.counts = { ...wrongHints.counts, neighborhoodEvidenceReady: 1, approved: 1 };
  assert.throws(() => validateEditorialCatalogue(wrongHints), /unproven-editorial-approval/);
  const forgedSupersession = catalogue(); const superseded = forgedSupersession.entries[0];
  superseded.numericalStatus = "verified-archived-evidence";
  superseded.neighborhood = { status: "reviewed-approved", neighbors: Array.from({ length: 6 }, (_, id) => ({ id: id + 500, word: `voisin${String.fromCharCode(97 + id)}` })), targetManifestSha256: hash, evidenceSha256: hash };
  superseded.hints = { status: "reviewed", words: superseded.neighborhood.neighbors.slice(0, 3).map(item => item.word) };
  superseded.approval = "approved-agent";
  superseded.approvalReview = { actor: "approval-agent", kind: "agent", reviewedAt: "2026-09-08T09:00:00.000Z", rationale: "Fixture.", evidenceSha256: hash, supersedesEvidenceSha256: "f".repeat(64) };
  forgedSupersession.counts = { ...forgedSupersession.counts, neighborhoodEvidenceReady: 1, approved: 1 };
  assert.throws(() => validateEditorialCatalogue(forgedSupersession), /missing-editorial-review-history/);
  const hiddenHistory = structuredClone(forgedSupersession);
  hiddenHistory.entries[0].neighborhood.supersedesEvidenceSha256 = "f".repeat(64);
  delete hiddenHistory.entries[0].approvalReview!.supersedesEvidenceSha256;
  assert.throws(() => validateEditorialCatalogue(hiddenHistory), /missing-editorial-review-history|invalid-editorial-evidence-history/);
});
