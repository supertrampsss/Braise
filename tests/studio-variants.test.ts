import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "./support/social-database";
import { randomToken } from "../lib/server-security";
import { validateStudio } from "../lib/studio-catalogue";
import { projectionFreshness, sanitizeProjection } from "../lib/projection";
import { summarizeIntruder, answerIntruder } from "../lib/intruder-server";
import { POST as summary } from "../app/api/intruder/summary/route";

test("Studio bounded plain metadata, preset enum and catalogue anti-repetition", () => {
  assert.ok(validateStudio("Mon titre personnel", ["nature-v1:0"], "À votre rythme.", "paper"));
  for (const [title, description, visual] of [[" ", "", "ember"], ["x".repeat(81), "", "ember"], ["Titre", "x".repeat(321), "ember"], ["<script>", "", "ember"], ["Titre", "ligne\ntexte", "ember"], ["Titre", "", "https://evil.test"]]) assert.equal(validateStudio(title, ["nature-v1:0"], description, visual), false);
  assert.equal(validateStudio("Titre", ["nature-v1:0", "nature-v1:0"]), false);
  assert.equal(validateStudio("Titre", ["arbitrary-target"]), false);
});
test("real Studio store snapshots all metadata, duplicates only own drafts and refuses revoked mutation", async () => {
  const { sqlite, store, studio } = database();
  try {
    const ta = randomToken(), tb = randomToken(); await store.createGuest("A", ta, "csrf"); await store.createGuest("B", tb, "csrf"); const a = (await store.session(ta))!, b = (await store.session(tb))!;
    const first = await studio.save(a, "draft", -1, "Titre A", ["nature-v1:0"], Date.now(), "Description A", "paper"); assert.equal(first?.visual, "paper");
    const edition = (await studio.publish(a, "draft", 0))!;
    assert.equal(await studio.duplicate(b, "draft", "copy-other"), null);
    const duplicate = (await studio.duplicate(a, "draft", "copy"))!; assert.equal(duplicate.revision, 0); assert.equal(duplicate.description, "Description A"); assert.deepEqual(await studio.editions(a.guest_id, "copy"), []);
    await studio.save(a, "draft", 0, "Titre B", ["nature-v1:1"], Date.now(), "Description B", "night");
    const frozen = (await studio.edition(edition.id))!; assert.equal(frozen.title, "Titre A"); assert.equal(frozen.description, "Description A"); assert.equal(frozen.visual, "paper");
    const progress = (await studio.progress(b.guest_id, edition.id))!; assert.equal(progress.description, "Description A"); assert.ok(!JSON.stringify(progress).includes("nature-v1"));
    assert.equal((await studio.draft(a.guest_id, "copy"))?.title, "Titre A");
    await store.revokeSession(a); assert.equal(await studio.duplicate(a, "draft", "revoked-copy"), null);
  } finally { sqlite.close(); }
});
test("projection is an explicit numeric allowlist and freshness uses real timestamp", () => {
  const value = sanitizeProjection({ game: { revision: 1, state: "open" }, guesses: [{ temperature: 12.25, word: "secret", target: "solution", opponent: "never" }] }, 1000);
  assert.deepEqual(value, { revision: 1, won: false, temperatures: [12.25], refreshedAt: 1000 });
  assert.equal(projectionFreshness(null, 2000), "unknown"); assert.equal(projectionFreshness(1000, 46000), "fresh"); assert.equal(projectionFreshness(1000, 46001), "stale"); assert.equal(projectionFreshness(2000, 1000), "stale");
});
test("Intrus summary counts real choices, refuses incomplete/duplicate indices and returns explanations", async () => {
  const attempts = Array.from({ length: 20 }, (_, index) => ({ edition: "intrus-v1", index, choice: index % 4 }));
  const result = summarizeIntruder(attempts); assert.equal(result.completed, 20); assert.equal(result.correct, attempts.filter(a => answerIntruder(a.index, a.choice).correct).length); assert.ok(result.results.every(r => r.explanation));
  for (const bad of [attempts.slice(1), [...attempts.slice(1), attempts[1]], attempts.map((a, i) => i === 1 ? { ...a, index: 20 } : a)]) assert.throws(() => summarizeIntruder(bad));
  const response = await summary(new Request("https://braiz.io/api/intruder/summary", { method: "POST", body: JSON.stringify({ attempts }) })); assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
});

test("duplicate receipt recovers exactly one copy after source changes, rejects identity reuse and survives quota", async () => {
  const { sqlite, store, studio } = database();
  try {
    const ta = randomToken(), tb = randomToken(); await store.createGuest("A", ta, "csrf"); await store.createGuest("B", tb, "csrf"); const a = (await store.session(ta))!, b = (await store.session(tb))!;
    await studio.save(a, "source", -1, "Original", ["nature-v1:0"]); await studio.save(a, "other-source", -1, "Other", ["nature-v1:1"]);
    const first = (await studio.duplicate(a, "source", "copy"))!; assert.equal((await studio.duplicate(a, "source", "copy"))?.id, first.id);
    await studio.save(a, "source", 0, "Updated", ["nature-v1:1"], Date.now(), "Updated description", "night");
    assert.equal((await studio.duplicate(a, "source", "copy"))?.title, "Original");
    assert.equal(await studio.duplicate(a, "other-source", "copy"), null); assert.equal(await studio.duplicate(b, "source", "copy"), null); assert.equal(await studio.duplicate(a, "source", "other-source"), null);
    assert.equal((await studio.list(a.guest_id)).length, 3);
    const fresh = (await studio.duplicate(a, "source", "intentional-new-copy"))!; assert.equal(fresh.title, "Updated"); assert.notEqual(fresh.id, first.id);
    for (let i = 4; i < 50; i++) assert.ok(await studio.save(a, "filler-" + i, -1, "Filler", ["nature-v1:0"]));
    assert.equal((await studio.list(a.guest_id)).length, 50); assert.equal(await studio.duplicate(a, "source", "over-quota"), null); assert.equal((await studio.duplicate(a, "source", "copy"))?.id, "copy");
    await store.revokeSession(a); assert.equal(await studio.duplicate(a, "source", "copy"), null);
  } finally { sqlite.close(); }
});
