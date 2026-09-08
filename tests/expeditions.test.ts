import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expeditionStatus } from "../lib/expedition-server";
import { EXPEDITIONS } from "../lib/expeditions";
import { COLLECTIONS } from "../lib/collections";
import { getLegacyPuzzle } from "../lib/legacy-puzzles";
import manifest from "../data/legacy-v1.json";
import { setSemanticObjectLoaderForTests } from "../lib/semantic-storage";
import { POST } from "../app/api/expeditions/route";
import { resumeExpedition } from "../lib/expedition-resume";
import { EMPTY_GAME } from "../lib/legacy-storage";
setSemanticObjectLoaderForTests(async key => {
  const value = await readFile(`public/${key}`);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
});
test("six expeditions reveal only the current stage after exact prior answers", async () => {
  const answers = [["arbre", "fleur", "abeille"], ["farine", "œuf", "gâteau"], ["valise", "gare", "train"], ["curiosité", "espoir", "bonheur"], ["théâtre", "piano", "chanter"], ["chemin", "pont", "mer"]];
  const seeds = new Set<string>();
  for (const [index, edition] of EXPEDITIONS.entries()) {
    for (let stage = 0; stage < 3; stage++) {
      const result = await expeditionStatus(edition.id, answers[index].slice(0, stage));
      assert.equal(result.completed, stage); assert.ok(result.seed);
      assert.equal(manifest.targets[getLegacyPuzzle("challenge", result.seed).legacyIndex], answers[index][stage]);
      assert.equal(Object.hasOwn(result, "reward"), false);
      seeds.add(result.seed);
    }
    const completed = await expeditionStatus(edition.id, answers[index]);
    assert.equal(completed.seed, undefined);
    assert.equal(completed.reward, `expedition:${edition.id}:completed`);
    assert.deepEqual(await expeditionStatus(edition.id, answers[index]), completed);
  }
  assert.equal(seeds.size, 18);
  assert.ok(COLLECTIONS.every(c => c.seeds.every(seed => !seeds.has(seed))));
  assert.ok(!JSON.stringify(EXPEDITIONS).includes("170000"));
});
test("expedition rejects skipped steps, fabricated wins and malformed proofs", async () => {
  for (const proofs of [["fleur"], ["arbre", "abeille"], [true], [{ found: true }], ["arbre", "fleur", "abeille", "mer"], null]) {
    await assert.rejects(expeditionStatus("sous-bois-v1", proofs));
  }
  await assert.rejects(expeditionStatus("__proto__", []));
  const response = await POST(new Request("https://braise.test/api/expeditions", { method: "POST", body: JSON.stringify({ id: "sous-bois-v1", proofs: ["mer"] }) }));
  assert.equal(response.status, 400); assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("resume preserves current-stage data and uses live evidence without storage writes", async () => {
  const won = { ...EMPTY_GAME, guesses: [{ word: "arbre", found: true, temperature: 100, rank: 1, order: 1 }], hints: 1 };
  const ongoing = { ...EMPTY_GAME, startedAt: 123, pins: ["jardin"], guesses: [{ word: "jardin", found: false, temperature: 20, rank: 2000, order: 1 }] };
  const result = await resumeExpedition("sous-bois-v1", { status: expeditionStatus, readGame: id => id === "free-1700000049" ? won : ongoing, isCurrent: () => true });
  assert.equal(result?.status.completed, 1); assert.equal(result?.saved, ongoing);
  assert.equal(result?.tries, 1); assert.equal(result?.hints, 1);
});
test("late expedition response cannot advance after another navigation", async () => {
  let current = true;
  const result = await resumeExpedition("sous-bois-v1", {
    status: async (id, proofs) => { const status = await expeditionStatus(id, proofs); current = false; return status; },
    readGame: () => { throw new Error("must not read another game"); }, isCurrent: () => current,
  });
  assert.equal(result, null);
});
