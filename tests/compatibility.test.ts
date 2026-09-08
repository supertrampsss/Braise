import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import reference from "./fixtures/v1-reference.json";
import saves from "./fixtures/v1-saves.json";
import baseline from "../docs/program/BASELINE.json";
import manifest from "../data/legacy-v1.json";
import dataset from "../data/semantic-fr.json";
import { evaluateWord, findWord, getPuzzle } from "../lib/semantic";
import { setSemanticObjectLoaderForTests } from "../lib/semantic-storage";
import { getLegacyPuzzle, resolveLegacyTargetIndexes } from "../lib/legacy-puzzles";
import { LEGACY_VERSIONS, samePuzzleRef, type EvaluationResponse } from "../lib/game-contracts";
import { EMPTY_PROFILE, readLocal, restoreLegacyGame, restoreLegacyProfile, writeLocal } from "../lib/legacy-storage";
import type { Mode, Puzzle } from "../lib/game-types";
import { GET, POST } from "../app/api/game/route";

setSemanticObjectLoaderForTests(async key => {
  try { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
  catch { return null; }
});
const post = (body: unknown) => POST(new Request("https://braise.test/api/game", { method: "POST", body: JSON.stringify(body) }));

test("the frozen V1 corpus and target identities match the original source fingerprint", () => {
  assert.equal(createHash("sha256").update(readFileSync("data/semantic-fr.json")).digest("hex"), baseline.corpus_sha256);
  assert.equal(reference.sourceCommit, baseline.source_commit);
  assert.equal(reference.corpusSha256, baseline.corpus_sha256);
  assert.equal(manifest.corpusSha256, baseline.corpus_sha256);
  assert.deepEqual(manifest.targets, baseline.v1_target_order);
  assert.deepEqual(dataset.puzzles.map(p => p.word), baseline.v1_target_order);
  assert.equal(dataset.words.length, baseline.dictionary_size);
  assert.equal(manifest.corpusVersion, LEGACY_VERSIONS.corpus);
  assert.equal(manifest.rulesVersion, LEGACY_VERSIONS.rules);
  assert.equal(manifest.calendarVersion, LEGACY_VERSIONS.calendar);
});

test("legacy daily dates and exact string seeds reproduce the pinned V1 oracle", () => {
  for (const fixture of [...reference.daily, ...reference.seeds, ...reference.boundaries]) {
    const { publicPuzzle, targetIndex } = getPuzzle(fixture.mode as Exclude<Mode, "archive">, fixture.seed, new Date(fixture.now));
    const { ref, resetAt, ...legacyFields } = publicPuzzle;
    const { resetAt: expectedReset, ...expectedFields } = fixture.publicPuzzle;
    assert.deepEqual(legacyFields, expectedFields, fixture.now + ":" + fixture.seed);
    assert.ok(Math.abs(Date.parse(resetAt) - Date.parse(expectedReset)) <= 1000);
    assert.equal(targetIndex, fixture.targetIndex);
    assert.equal(dataset.puzzles[targetIndex].word, fixture.answer);
    assert.equal(ref.context, fixture.mode);
    assert.equal(ref.id, publicPuzzle.id);
  }
  assert.notEqual(getPuzzle("free", "1").targetIndex, getPuzzle("free", "0001").targetIndex);
});

test("V1 selection survives a reordered and extended target catalogue", () => {
  // The additional entry is a test-only mutation, never a game or real score.
  const reordered = [{ word: "test-only-additional-target" }, ...dataset.puzzles.toReversed()];
  const indexes = resolveLegacyTargetIndexes(reordered);
  for (const fixture of [...reference.daily, ...reference.seeds]) {
    const { legacyIndex } = getLegacyPuzzle(fixture.mode as Exclude<Mode, "archive">, fixture.seed, new Date(fixture.now));
    assert.equal(reordered[indexes[legacyIndex]].word, fixture.answer);
  }
  assert.throws(() => resolveLegacyTargetIndexes(dataset.puzzles.slice(1)), /Missing V1/);
  assert.throws(() => resolveLegacyTargetIndexes([...dataset.puzzles, dataset.puzzles[0]]), /Duplicate/);
});

test("real V1 temperatures and ranks match independently captured samples for all 120 targets", async () => {
  for (const fixture of reference.scores) {
    const targetIndex = dataset.puzzles.findIndex(p => p.word === fixture.target);
    for (const expected of fixture.evaluations) {
      const wordIndex = findWord(expected.word);
      assert.notEqual(wordIndex, undefined);
      assert.deepEqual(await evaluateWord(targetIndex, wordIndex!), expected);
    }
  }
});

test("API accepts existing tabs and enforces every supplied puzzle version and context", async () => {
  const metaResponse = await GET(new Request("https://braise.test/api/game?mode=free&seed=0001"));
  assert.equal(metaResponse.status, 200);
  const puzzle = await metaResponse.json() as Puzzle;
  const body = { mode: "free", seed: "0001", puzzleId: puzzle.id, action: "guess", word: "océan" };
  const oldResponse = await post(body);
  const newResponse = await post({ ...body, puzzleRef: puzzle.ref });
  assert.equal(oldResponse.status, 200); assert.equal(newResponse.status, 200);
  assert.deepEqual(await oldResponse.json(), await newResponse.json());
  for (const mismatch of [
    null, [], {}, { ...puzzle.ref, contractVersion: 2 }, { ...puzzle.ref, corpusVersion: "unknown" },
    { ...puzzle.ref, rulesVersion: "unknown" }, { ...puzzle.ref, context: "challenge" },
    { ...puzzle.ref, variant: "intruder" }, { ...puzzle.ref, id: "free-1" },
    { ...puzzle.ref, calendar: { version: "unknown", date: "2026-09-07" } },
  ]) {
    const response = await post({ ...body, puzzleRef: mismatch });
    assert.equal(response.status, 409);
    assert.equal(Object.hasOwn(await response.json(), "temperature"), false);
  }
  assert.equal((await post({ ...body, puzzleId: "free-1" })).status, 409);
  const publicKeys = Object.keys(puzzle).concat(Object.keys(puzzle.ref));
  for (const secret of ["word", "answer", "scores", "targetIndex", "legacyIndex"]) assert.ok(!publicKeys.includes(secret));
});

test("calendar references and hints are checked against the same canonical puzzle", async () => {
  const { publicPuzzle: daily } = getPuzzle("daily");
  const body = { mode: "daily", puzzleId: daily.id, action: "guess", word: "livre" };
  const badRef = { ...daily.ref, calendar: { ...daily.ref.calendar, version: "unknown" } };
  assert.equal((await post({ ...body, puzzleRef: badRef })).status, 409);
  assert.equal(samePuzzleRef({ ...daily.ref, calendar: { ...daily.ref.calendar, date: "2000-01-01" } }, daily.ref), false);
  const { publicPuzzle: free } = getPuzzle("free", "1234");
  const response = await post({ mode: "free", seed: "1234", puzzleId: free.id, puzzleRef: free.ref, action: "hint", hintLevel: 0, guesses: ["justice", "musique", "sport", "livre", "enfant"] });
  assert.equal(response.status, 200);
  const hint = await response.json() as EvaluationResponse;
  assert.ok(samePuzzleRef(hint.puzzleRef, free.ref));
  assert.equal(hint.word, saves.fixtures[2].game.guesses[5].word);
  for (const invalidSeed of ["2147483648", "00000000000", "-1", "1.0", ""]) {
    assert.equal((await GET(new Request("https://braise.test/api/game?mode=free&seed=" + invalidSeed))).status, 400);
  }
});

test("a semantic storage failure returns 503 without inventing a result", async () => {
  const { publicPuzzle } = getPuzzle("free", "1234");
  setSemanticObjectLoaderForTests(async () => null);
  const originalError = console.error; console.error = () => {};
  const response = await post({ mode: "free", seed: "1234", puzzleId: publicPuzzle.id, puzzleRef: publicPuzzle.ref, action: "guess", word: "livre" }).finally(() => { console.error = originalError; });
  assert.equal(response.status, 503);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(Object.hasOwn(body, "temperature"), false); assert.equal(Object.hasOwn(body, "rank"), false);
  setSemanticObjectLoaderForTests(async key => {
    try { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
    catch { return null; }
  });
});

test("synthetic V1 saves restore through the actual UI reader with no storage writes or new wins", () => {
  for (const fixture of saves.fixtures) {
    assert.equal(fixture.synthetic, true);
    const values = new Map(Object.entries(fixture.storage));
    const reader = { getItem: (key: string) => values.get(key) ?? null };
    const original = [...values.entries()];
    const first = restoreLegacyGame(fixture.puzzleId, 1800000000000, reader);
    assert.deepEqual(first, fixture.game);
    assert.deepEqual(restoreLegacyGame(fixture.puzzleId, 1800000000001, reader), first);
    assert.deepEqual(restoreLegacyProfile(reader), fixture.profile);
    assert.deepEqual(restoreLegacyProfile(reader), fixture.profile);
    assert.deepEqual([...values.entries()], original);
    assert.equal(first.guesses.some(g => g.found), fixture.name === "daily-won");
    if (fixture.freeSeed) {
      assert.equal(readLocal("freeSeed", "", reader), fixture.freeSeed);
      const challenge = getPuzzle("challenge", fixture.freeSeed).publicPuzzle;
      assert.deepEqual(restoreLegacyGame(challenge.id, 1800000000000, reader), first);
    }
  }
});

test("missing, corrupted or inaccessible local storage falls back without overwriting raw data", () => {
  for (const raw of [null, "{broken", "null", '"unexpected"', '{"guesses":[],"pins":[],"hints":9}']) {
    const reader = { getItem: () => raw };
    assert.deepEqual(restoreLegacyGame("daily-2026-09-07", 123, reader), { guesses: [], pins: [], hints: 0, startedAt: 123 });
    assert.deepEqual(restoreLegacyProfile(reader), EMPTY_PROFILE);
  }
  const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.equal(restoreLegacyGame("free-1234", 123, denied).startedAt, 123);
  assert.equal(writeLocal("profile", EMPTY_PROFILE, denied), false);
  const values = new Map<string, string>();
  assert.equal(writeLocal("profile", EMPTY_PROFILE, { setItem: (k, v) => { values.set(k, v); } }), true);
  assert.equal(values.get("braise.v1.profile"), JSON.stringify(EMPTY_PROFILE));
});
