import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import dataset from "../data/semantic-fr.json";
import { getPuzzle, parisDate, nextParisMidnight, findWord, evaluateWord, nextHint } from "../lib/semantic";
import { setSemanticObjectLoaderForTests } from "../lib/semantic-storage";
import { getStreak } from "../lib/game-types";
import { GET, POST } from "../app/api/game/route";

setSemanticObjectLoaderForTests(async key => {
  try { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
  catch { return null; }
});
const requestGuess = (fields: Record<string, unknown>) => new Request("https://braise.test/api/game", { method: "POST", body: JSON.stringify(fields) });

test("same daily puzzle for everyone, all 120 targets visited before repeating", () => {
  const indexes = new Set<number>();
  for (let day = 0; day < 120; day++) {
    const now = new Date(Date.UTC(2026, 8, 7 + day, 12));
    const a = getPuzzle("daily", "alice", now); const b = getPuzzle("daily", "bob", now);
    assert.equal(a.targetIndex, b.targetIndex); assert.equal(a.publicPuzzle.id, b.publicPuzzle.id);
    indexes.add(a.targetIndex);
  }
  assert.equal(indexes.size, 120);
});

test("Paris reset respects midnight and daylight saving transitions", () => {
  assert.equal(parisDate(new Date("2026-09-07T22:00:00Z")), "2026-09-08");
  for (const [now, reset] of [
    ["2026-09-07T10:00:00Z", "2026-09-07T22:00:00Z"],
    ["2026-03-28T23:01:00Z", "2026-03-29T22:00:00Z"],
    ["2026-10-24T22:01:00Z", "2026-10-25T23:00:00Z"],
  ]) assert.ok(Math.abs(Date.parse(nextParisMidnight(new Date(now))) - Date.parse(reset)) <= 1000);
});

test("challenge and free share the exact puzzle, without answer in public metadata", () => {
  const a = getPuzzle("challenge", "1234"); const b = getPuzzle("free", "1234");
  assert.equal(a.targetIndex, b.targetIndex); assert.equal(a.publicPuzzle.id, b.publicPuzzle.id);
  assert.equal(Object.hasOwn(a.publicPuzzle, "word"), false);
  assert.equal(Object.hasOwn(a.publicPuzzle, "scores"), false);
});

test("every answer wins, has rank 1 and its own score 100", async () => {
  for (const [target, p] of dataset.puzzles.entries()) {
    const word = findWord(p.word); assert.notEqual(word, undefined);
    const result = await evaluateWord(target, word!);
    assert.equal(result.found, true); assert.equal(result.rank, 1); assert.equal(result.temperature, 100);
  }
});

test("real semantic scores rank ocean closer to sea than cheese", async () => {
  const target = dataset.puzzles.findIndex(p => p.word === "mer");
  const ocean = await evaluateWord(target, findWord("océan")!);
  const cheese = await evaluateWord(target, findWord("fromage")!);
  assert.ok(ocean.temperature > cheese.temperature + 30);
  assert.ok(ocean.rank < cheese.rank);
  assert.equal(findWord("  ORDINATEUR "), findWord("ordinateur"));
  assert.equal(findWord("azertyqwertyuipasunmot"), undefined);
  assert.equal(findWord("bibliotheque"), findWord("bibliothèque"));
});

test("hints are real valid words, never the answer, never an existing guess", async () => {
  for (const [target, p] of dataset.puzzles.entries()) {
    const used = ["justice", "musique", "sport", "livre", "enfant"];
    for (let level = 0; level < 3; level++) {
      const hint = await nextHint(target, level, used);
      assert.ok(hint); assert.notEqual(hint.word, p.word); assert.ok(!used.includes(hint.word));
      assert.equal(hint.found, false); used.push(hint.word);
    }
  }
});

test("invalid words never receive made-up semantic scores; errors preserve protocol", async () => {
  const { publicPuzzle } = getPuzzle("daily");
  const base = { mode: "daily", seed: "", puzzleId: publicPuzzle.id, action: "guess" };
  const unknown = await POST(requestGuess({ ...base, word: "azertyqwertyuipasunmot" }));
  assert.equal(unknown.status, 422); assert.equal(Object.hasOwn(await unknown.json(), "temperature"), false);
  assert.equal((await POST(requestGuess({ ...base, word: "deux mots" }))).status, 400);
  assert.equal((await POST(requestGuess({ ...base, word: "train", puzzleId: "daily-2000-01-01" }))).status, 409);
  assert.equal((await GET(new Request("https://braise.test/api/game?mode=challenge&seed=nope"))).status, 400);
  assert.equal((await POST(requestGuess({ ...base, word: "train" }))).status, 200);
  assert.equal((await POST(requestGuess({ ...base, action: "hint", hintLevel: 0, guesses: [] }))).status, 400);
});

test("daily streak includes yesterday, excludes free games, and resets after a miss", () => {
  const win = (date: string) => ({ id: date, date, mode: "daily" as const, tries: 10, hints: 0 });
  const wins = [win("2026-09-05"), win("2026-09-06")];
  assert.equal(getStreak(wins, "2026-09-07"), 2);
  assert.equal(getStreak(wins, "2026-09-08"), 0);
  assert.equal(getStreak([...wins, { ...win("2026-09-07"), mode: "free" }], "2026-09-07"), 2);
});
