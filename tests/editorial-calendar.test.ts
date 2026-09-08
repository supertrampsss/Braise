import test from "node:test";
import assert from "node:assert/strict";
import { createInactiveEditorialCalendar, validateEditorialCalendar } from "../lib/editorial-calendar";
import type { EditorialCatalogue } from "../lib/editorial-catalogue";

const hash = "b".repeat(64);
const targets = Array.from({ length: 400 }, (_, index) => index + 1000);
const stableJson = (value: unknown): string => Array.isArray(value) ? `[${value.map(stableJson).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
async function sha(value: unknown) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value))))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function catalogue(count = 400): EditorialCatalogue {
  const entries = targets.slice(0, count).map((targetId, index) => {
    const neighbors = Array.from({ length: 6 }, (_, offset) => ({ id: 10_000 + index * 10 + offset, word: `voisin${String.fromCharCode(97 + offset)}${String.fromCharCode(97 + index % 26)}` }));
    return { targetId, word: `mot${String.fromCharCode(97 + index % 26)}${String.fromCharCode(97 + Math.floor(index / 26) % 26)}${String.fromCharCode(97 + Math.floor(index / 676) % 26)}`, category: "quotidien", ambiguity: "low" as const, review: { actor: "lexical-agent", kind: "agent" as const, reviewedAt: "2026-09-08T08:00:00.000Z", decision: "candidate" as const }, lexicalStatus: "agent-reviewed" as const, numericalStatus: "verified-staging-column" as const, neighborhood: { status: "reviewed-approved" as const, neighbors, targetManifestSha256: hash, evidenceSha256: hash }, hints: { status: "reviewed" as const, words: neighbors.slice(0, 3).map(item => item.word) }, approval: "approved-agent" as const, approvalReview: { actor: "approval-agent", kind: "agent" as const, reviewedAt: "2026-09-08T09:00:00.000Z", rationale: "Fixture explicite de contrat.", evidenceSha256: hash } };
  });
  return { schemaVersion: 1, id: "fr-v2-editorial-catalogue-1", corpus: { id: "fr-fasttext-v2", manifestSha256: hash, semanticSha256: hash, dictionarySize: 1_013_881 }, status: "ready", counts: { selected: count, lexicalReviewed: count, neighborhoodEvidenceReady: count, approved: count }, entries };
}

test("an inactive 365-day Paris edition is explicit, contiguous and non-repeating", async () => {
  const source = catalogue(); const calendar = await createInactiveEditorialCalendar({ id: "paris-daily-v2-edition-1", catalogue: source, catalogueSha256: await sha(source), startDate: "2027-03-02" });
  assert.equal(calendar.status, "inactive"); assert.equal(calendar.assignments.length, 365);
  assert.equal(new Set(calendar.assignments.map(item => item.targetId)).size, 365);
  assert.ok(calendar.assignments.some(item => item.date === "2028-02-29"));
});

test("calendar refuses gaps, repeats, forged hashes and insufficient approvals", async () => {
  const source = catalogue(); const calendar = await createInactiveEditorialCalendar({ id: "paris-daily-v2-edition-1", catalogue: source, catalogueSha256: await sha(source), startDate: "2027-03-01" });
  const gap = structuredClone(calendar); gap.assignments[10].date = "2027-03-20";
  await assert.rejects(validateEditorialCalendar(gap, source), /invalid-editorial-assignment/);
  const repeat = structuredClone(calendar); repeat.assignments[10].targetId = repeat.assignments[9].targetId;
  await assert.rejects(validateEditorialCalendar(repeat, source), /invalid-editorial-assignment/);
  await assert.rejects(createInactiveEditorialCalendar({ id: "forged", catalogue: source, catalogueSha256: hash, startDate: "2027-03-01" }), /insufficient-approved-targets/);
  const short = catalogue(364); await assert.rejects(createInactiveEditorialCalendar({ id: "too-short", catalogue: short, catalogueSha256: await sha(short), startDate: "2027-03-01" }), /invalid-editorial-catalogue|insufficient-approved-targets/);
});
