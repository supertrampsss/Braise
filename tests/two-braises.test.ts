import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateTwoBraises, twoBraisesPuzzle } from "../lib/two-braises-server";
import { setSemanticObjectLoaderForTests } from "../lib/semantic-storage";
import { COLLECTIONS } from "../lib/collections";
import { getPuzzle, findWord, evaluateWord } from "../lib/semantic";
import { readTwoBraises, saveTwoBraises } from "../lib/profile-storage";
setSemanticObjectLoaderForTests(async key => { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); });
test("twelve pairs reproduce both individual real scores without combined metric", async () => {
  const seeds = [...COLLECTIONS[0].seeds, ...COLLECTIONS[1].seeds];
  for (let pair = 0; pair < 12; pair++) {
    const result = await evaluateTwoBraises(pair, "arbre"); assert.ok(result);
    assert.equal(Object.hasOwn(twoBraisesPuzzle(pair), "seeds"), false);
    assert.equal(Object.hasOwn(result, "temperature"), false);
    for (let side = 0; side < 2; side++) assert.deepEqual(result.values[side], await evaluateWord(getPuzzle("challenge", seeds[pair * 2 + side]).targetIndex, findWord("arbre")!));
  }
  assert.equal((await evaluateTwoBraises(0, "arbre"))?.values[0].found, true);
  assert.equal((await evaluateTwoBraises(0, "fleur"))?.values[1].found, true);
  assert.equal(await evaluateTwoBraises(0, "zzzzzzzzzzzzzz"), null);
  await assert.rejects(evaluateTwoBraises(12, "arbre"));
});
test("two-braises saves distinct guesses idempotently without classic profile mutation", async () => {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const evaluated = await evaluateTwoBraises(0, "arbre"); assert.ok(evaluated);
  const guess = { edition: "deux-braises-v1" as const, pair: 0, word: evaluated.word, values: evaluated.values as [typeof evaluated.values[0], typeof evaluated.values[0]], acceptedAt: "2026-09-08T07:00:00.000Z" };
  assert.equal(saveTwoBraises(guess, storage), true); assert.equal(saveTwoBraises(guess, storage), true);
  assert.deepEqual(readTwoBraises(0, storage), [guess]); assert.equal(values.size, 1);
  assert.deepEqual(readTwoBraises(1, storage), []);
  values.clear(); values.set("braise.v2.two-braises.guess.0.arbre", "{corrupt");
  assert.equal(saveTwoBraises(guess, storage), true);
  assert.deepEqual(readTwoBraises(0, storage), [guess]);
  assert.equal(values.get("braise.v2.two-braises.guess.0.arbre"), "{corrupt");
});
