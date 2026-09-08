import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the weekly interface exposes measurable objectives without an ad dependency", async () => {
  const source = await readFile(new URL("../../components/weekly-ritual.tsx", import.meta.url), "utf8");
  assert.match(source, /projection\.objectives\.map/);
  assert.match(source, /aria-valuetext/);
  assert.match(source, /Terminé/);
  assert.match(source, /sans publicité/);
  assert.doesNotMatch(source, /Réclamer|decideAd|AdPlacement/);
});

test("the cosmetic picker names equipped and locked states", async () => {
  const source = await readFile(new URL("../../components/weekly-ritual.tsx", import.meta.url), "utf8");
  assert.match(source, /COSMETICS\.map/);
  assert.match(source, /Équipé/);
  assert.match(source, /Verrouillé/);
  assert.match(source, /Terminez «/);
  assert.match(source, /jamais les scores ni les indices/);
  assert.match(source, /aria-pressed/);
});

test("the game memoizes weekly history independently from the one-second clock", async () => {
  const source = await readFile(new URL("../../components/game.tsx", import.meta.url), "utf8");
  assert.match(source, /const ritual = useMemo/);
  assert.match(source, /\[profileSnapshot, today\]/);
});
