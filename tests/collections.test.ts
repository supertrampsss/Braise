import { test } from "node:test";
import assert from "node:assert/strict";
import { COLLECTIONS, NATURE_COLLECTION, collectionProgress } from "../lib/collections";
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
test("all five immutable collections map to twelve distinct real targets each", () => {
  const expected = new Map<string, string[]>([["cuisine-v1",["pain","beurre","farine","œuf","carotte","soupe","salade","pâtes","gâteau","pomme","citron","fraise"]],["voyage-v1",["valise","avion","train","gare","aéroport","port","route","chemin","pont","ville","mer","désert"]],["emotions-v1",["peur","bonheur","curiosité","amour","sourire","surprise","plaisir","calme","espoir","humour","patience","rêve"]],["cinema-v1",["cinéma","théâtre","écran","appareil","lampe","piano","chanter","danser","sourire","peur","surprise","rêve"]]]);
  assert.equal(COLLECTIONS.length, 5);
  for (const collection of COLLECTIONS) {
    assert.equal(collection.seeds.length, 12);
    const answers = collection.seeds.map(seed => manifest.targets[getLegacyPuzzle("challenge", seed).legacyIndex]);
    assert.equal(new Set(answers).size, 12);
    if (expected.has(collection.id)) assert.deepEqual(answers, expected.get(collection.id));
    assert.equal(collectionProgress([], collection).next, 0);
    const wins = collection.seeds.map(seed => ({ id: `free-${seed}`, date: "2026-09-08", mode: "challenge" as const, tries: 1, hints: 0 }));
    assert.equal(collectionProgress([...wins, ...wins], collection).count, 12);
    assert.equal(collectionProgress(wins, collection).next, -1);
  }
});
