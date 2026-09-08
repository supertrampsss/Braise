import { test } from "node:test";
import assert from "node:assert/strict";
import { NATURE_COLLECTION, collectionProgress } from "../lib/collections";
import { getLegacyPuzzle } from "../lib/legacy-puzzles";
import manifest from "../data/legacy-v1.json";

test("Nature edition preserves twelve distinct real V1 answers", () => {
  const expected = ["arbre", "fleur", "herbe", "rivière", "colline", "volcan", "neige", "orage", "abeille", "renard", "tortue", "aigle"];
  const answers = NATURE_COLLECTION.seeds.map(seed => {
    const resolved = getLegacyPuzzle("challenge", seed);
    assert.equal(resolved.publicPuzzle.ref.corpusVersion, NATURE_COLLECTION.corpusVersion);
    return manifest.targets[resolved.legacyIndex];
  });
  assert.deepEqual(answers, expected); assert.equal(new Set(answers).size, 12);
  assert.ok(!JSON.stringify(NATURE_COLLECTION).includes('"arbre"'));
});

test("collection progress only projects existing wins and deduplicates replay", () => {
  assert.equal(collectionProgress([]).count, 0);
  const wins = NATURE_COLLECTION.seeds.map(seed => ({ id: `free-${seed}`, date: "2026-09-08", mode: "challenge" as const, tries: 3, hints: 0 }));
  assert.equal(collectionProgress(wins.slice(0, 3)).next, 3);
  assert.equal(collectionProgress([...wins, ...wins]).count, 12);
  assert.equal(collectionProgress(wins).next, -1);
  assert.equal(collectionProgress(wins.map(win => ({ ...win, mode: "daily" as const }))).count, 0);
});
