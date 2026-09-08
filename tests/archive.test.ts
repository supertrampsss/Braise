import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { archiveDateStatus, isCalendarDate, latestArchiveDate, parisDate, shiftCalendarDate } from "../lib/calendar";
import { evaluateWord, findWord, getArchivePuzzle, getPuzzle, nextHint } from "../lib/semantic";
import { setSemanticObjectLoaderForTests } from "../lib/semantic-storage";
import { GET, POST } from "../app/api/game/route";
import { getStreak, type SavedGame } from "../lib/game-types";
import { loadLocalProfile, profileActivitiesForGame, recordLocalGameProgress, type ProfileStorage } from "../lib/profile-storage";

setSemanticObjectLoaderForTests(async key => {
  try { const value = await readFile(`public/${key}`); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
  catch { return null; }
});

const post = (body: unknown) => POST(new Request("https://braise.test/api/game", { method: "POST", body: JSON.stringify(body) }));

class MemoryStorage implements ProfileStorage {
  readonly values = new Map<string, string>();
  failWrites = false;
  constructor(entries: Iterable<readonly [string, string]> = []) { for (const [key, value] of entries) this.values.set(key, value); }
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error("write denied"); this.values.set(key, value); }
}

test("archive dates are strict civil dates bounded by launch and Paris today", () => {
  for (const invalid of [null, "", " 2026-09-07", "2026-9-7", "2026-02-29", "2026-04-31", "2026-09-07T00:00:00Z"]) {
    assert.equal(isCalendarDate(invalid), false);
    assert.equal(archiveDateStatus(invalid, new Date("2026-09-08T12:00:00Z")), "invalid");
  }
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(archiveDateStatus("2026-09-06", new Date("2026-09-08T12:00:00Z")), "before-start");
  assert.equal(archiveDateStatus("2026-09-07", new Date("2026-09-08T12:00:00Z")), "available");
  assert.equal(archiveDateStatus("2026-09-08", new Date("2026-09-08T12:00:00Z")), "today-or-future");
  assert.equal(archiveDateStatus("2026-09-09", new Date("2026-09-08T12:00:00Z")), "today-or-future");
});

test("archive availability changes exactly at Paris midnight across both DST seasons", () => {
  assert.equal(parisDate(new Date("2027-03-27T22:59:59Z")), "2027-03-27");
  assert.equal(parisDate(new Date("2027-03-27T23:00:00Z")), "2027-03-28");
  assert.equal(archiveDateStatus("2027-03-27", new Date("2027-03-27T22:59:59Z")), "today-or-future");
  assert.equal(archiveDateStatus("2027-03-27", new Date("2027-03-27T23:00:00Z")), "available");
  assert.equal(latestArchiveDate(new Date("2027-03-27T23:00:00Z")), "2027-03-27");

  assert.equal(parisDate(new Date("2027-10-30T21:59:59Z")), "2027-10-30");
  assert.equal(parisDate(new Date("2027-10-30T22:00:00Z")), "2027-10-31");
  assert.equal(archiveDateStatus("2027-10-30", new Date("2027-10-30T21:59:59Z")), "today-or-future");
  assert.equal(archiveDateStatus("2027-10-30", new Date("2027-10-30T22:00:00Z")), "available");
  assert.equal(shiftCalendarDate("2027-10-31", -1), "2027-10-30");
});

test("an archive resolves the exact historical daily target without exposing the answer", () => {
  const historical = getPuzzle("daily", "", new Date("2026-09-07T12:00:00Z"));
  const archive = getArchivePuzzle("2026-09-07", new Date("2026-09-08T12:00:00Z"));
  assert.equal(archive.targetIndex, historical.targetIndex);
  assert.equal(archive.publicPuzzle.id, historical.publicPuzzle.id);
  assert.equal(archive.publicPuzzle.seed, historical.publicPuzzle.seed);
  assert.equal(archive.publicPuzzle.number, historical.publicPuzzle.number);
  assert.equal(archive.publicPuzzle.mode, "archive");
  assert.equal(archive.publicPuzzle.ref.context, "archive");
  assert.equal(archive.publicPuzzle.ref.calendar?.date, "2026-09-07");
  assert.equal(Object.hasOwn(archive.publicPuzzle, "word"), false);
  assert.equal(Object.hasOwn(archive.publicPuzzle, "targetIndex"), false);
});

test("archive API validates the date and version before scoring guesses or hints", async () => {
  for (const date of ["", "2026-02-29", "2026-09-06", "9999-12-31"]) {
    const response = await GET(new Request(`https://braise.test/api/game?mode=archive&date=${encodeURIComponent(date)}`));
    assert.equal(response.status, 400);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(Object.hasOwn(body, "temperature"), false);
    assert.equal(Object.hasOwn(body, "rank"), false);
  }

  const response = await GET(new Request("https://braise.test/api/game?mode=archive&date=2026-09-07"));
  assert.equal(response.status, 200);
  const puzzle = await response.json() as ReturnType<typeof getArchivePuzzle>["publicPuzzle"];
  const base = { mode: "archive", date: puzzle.date, puzzleId: puzzle.id, puzzleRef: puzzle.ref };
  for (const date of [undefined, "2026-02-29", "2026-09-06", parisDate(), "9999-12-31"]) {
    for (const action of ["guess", "hint"]) {
      const denied = await post({ ...base, date, action, word: "livre", hintLevel: 0, guesses: ["justice", "musique", "sport", "livre", "enfant"] });
      assert.equal(denied.status, 400);
      const deniedBody = await denied.json() as Record<string, unknown>;
      assert.equal(Object.hasOwn(deniedBody, "temperature"), false);
      assert.equal(Object.hasOwn(deniedBody, "rank"), false);
    }
  }
  const guessResponse = await post({ ...base, action: "guess", word: "livre" });
  assert.equal(guessResponse.status, 200);
  const expectedGuess = await evaluateWord(getArchivePuzzle(puzzle.date).targetIndex, findWord("livre")!);
  assert.deepEqual(await guessResponse.json(), { ...expectedGuess, puzzleRef: puzzle.ref });
  const guesses = ["justice", "musique", "sport", "livre", "enfant"];
  const hintResponse = await post({ ...base, action: "hint", hintLevel: 0, guesses });
  assert.equal(hintResponse.status, 200);
  const expectedHint = await nextHint(getArchivePuzzle(puzzle.date).targetIndex, 0, guesses);
  assert.deepEqual(await hintResponse.json(), { ...expectedHint, puzzleRef: puzzle.ref });
  assert.equal((await post({ ...base, puzzleRef: undefined, action: "guess", word: "livre" })).status, 409);
  for (const puzzleRef of [
    { ...puzzle.ref, context: "daily" },
    { ...puzzle.ref, id: "daily-2026-09-08" },
    { ...puzzle.ref, calendar: { ...puzzle.ref.calendar!, date: "2026-09-08" } },
    { ...puzzle.ref, corpusVersion: "unknown" },
  ]) {
    const forged = await post({ ...base, puzzleRef, action: "guess", word: "livre" });
    assert.equal(forged.status, 409);
    assert.equal(Object.hasOwn(await forged.json(), "temperature"), false);
  }
  const forgedHint = await post({ ...base, puzzleRef: { ...puzzle.ref, context: "daily" }, action: "hint", hintLevel: 0, guesses });
  assert.equal(forgedHint.status, 409);
  assert.equal(Object.hasOwn(await forgedHint.json(), "temperature"), false);
  assert.equal((await post({ ...base, puzzleId: "daily-2026-09-08", action: "guess", word: "livre" })).status, 409);
});

test("an expired daily request stays expired instead of becoming an archive", async () => {
  const oldDaily = getPuzzle("daily", "", new Date("2026-09-07T12:00:00Z")).publicPuzzle;
  const response = await post({ mode: "daily", seed: "", puzzleId: oldDaily.id, puzzleRef: oldDaily.ref, action: "guess", word: "livre" });
  assert.equal(response.status, 409);
  assert.equal(Object.hasOwn(await response.json(), "temperature"), false);
});

test("archive completion time is distinct and never extends the daily streak", () => {
  const puzzle = getArchivePuzzle("2026-09-07", new Date("2026-09-08T12:00:00Z")).publicPuzzle;
  const completedAt = "2026-09-08T10:15:00.000Z";
  const game: SavedGame = {
    guesses: [{ word: "ordinateur", temperature: 100, rank: 1, found: true, order: 1, acceptedAt: completedAt }],
    pins: [], hints: 0, startedAt: 1, solvedAt: Date.parse(completedAt), completedMode: "archive", profileV2StartIndex: 0,
  };
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  const result = recordLocalGameProgress(puzzle, game, storage);
  assert.equal(result.profile.wins.length, 1);
  assert.equal(result.profile.wins[0].date, "2026-09-07");
  assert.equal(result.profile.wins[0].completedAt, completedAt);
  assert.equal(result.profile.wins[0].mode, "archive");
  assert.equal(getStreak(result.profile.wins, "2026-09-08"), 0);
  assert.deepEqual(loadLocalProfile(storage).profile, result.profile);
});

test("a historical daily win keeps priority over replaying the same archive", () => {
  const dailyWin = { id: "daily-2026-09-07", date: "2026-09-07", mode: "daily", tries: 4, hints: 0 } as const;
  const raw = JSON.stringify({ wins: [dailyWin], guesses: 4, sound: false });
  const storage = new MemoryStorage([["braise.v1.profile", raw]]);
  const migrated = loadLocalProfile(storage);
  const puzzle = getArchivePuzzle("2026-09-07", new Date("2026-09-08T12:00:00Z")).publicPuzzle;
  const game: SavedGame = {
    guesses: [{ word: "ordinateur", temperature: 100, rank: 1, found: true, hint: true, order: 4, acceptedAt: "2026-09-08T10:15:00.000Z" }],
    pins: [], hints: 1, startedAt: 1, solvedAt: Date.parse("2026-09-08T10:15:00.000Z"), completedMode: "archive", profileV2StartIndex: 0,
  };
  const replayed = recordLocalGameProgress(puzzle, game, storage, migrated);
  assert.equal(replayed.profile.wins.length, 1);
  assert.deepEqual(replayed.profile.wins[0], dailyWin);
  assert.equal(replayed.profile.guesses, 4);
  assert.equal(getStreak(replayed.profile.wins, "2026-09-08"), 1);
});

test("reconciling an older saved daily win preserves its original completion context", () => {
  const archive = getArchivePuzzle("2026-09-07", new Date("2026-09-08T12:00:00Z")).publicPuzzle;
  const game: SavedGame = {
    guesses: [{ word: "ordinateur", temperature: 100, rank: 1, found: true, order: 1, acceptedAt: "2026-09-07T12:00:00.000Z" }],
    pins: [], hints: 0, startedAt: 1, solvedAt: Date.parse("2026-09-07T12:00:00.000Z"), profileV2StartIndex: 0,
  };
  const activities = profileActivitiesForGame(archive, game);
  const win = activities.find(activity => activity.type === "puzzleWon");
  assert.equal(win?.type, "puzzleWon");
  if (win?.type === "puzzleWon") {
    assert.equal(win.win.mode, "daily");
    assert.equal(win.win.completedAt, "2026-09-07T12:00:00.000Z");
  }
});

test("a pending daily win outranks a concurrent archive win when storage recovers", () => {
  const daily = getPuzzle("daily", "", new Date("2026-09-07T12:00:00Z")).publicPuzzle;
  const archive = getArchivePuzzle("2026-09-07", new Date("2026-09-08T12:00:00Z")).publicPuzzle;
  const acceptedAt = "2026-09-07T12:00:00.000Z";
  const dailyGame: SavedGame = {
    guesses: [{ word: "ordinateur", temperature: 100, rank: 1, found: true, order: 1, acceptedAt }],
    pins: [], hints: 0, startedAt: 1, solvedAt: Date.parse(acceptedAt), completedMode: "daily", profileV2StartIndex: 0,
  };
  const archiveGame: SavedGame = {
    ...dailyGame,
    solvedAt: Date.parse("2026-09-08T10:15:00.000Z"),
    completedMode: "archive",
    guesses: [{ ...dailyGame.guesses[0], acceptedAt: "2026-09-08T10:15:00.000Z" }],
  };
  const storage = new MemoryStorage();
  const initial = loadLocalProfile(storage);
  storage.failWrites = true;
  const pendingDaily = recordLocalGameProgress(daily, dailyGame, storage, initial);
  assert.equal(pendingDaily.persisted, false);
  assert.equal(pendingDaily.profile.wins[0].mode, "daily");
  storage.failWrites = false;
  const archived = recordLocalGameProgress(archive, archiveGame, storage, initial);
  assert.equal(archived.profile.wins[0].mode, "archive");
  const recovered = recordLocalGameProgress(daily, dailyGame, storage, pendingDaily);
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.profile.wins.length, 1);
  assert.equal(recovered.profile.wins[0].mode, "daily");
  assert.equal(getStreak(recovered.profile.wins, "2026-09-08"), 1);

  const second = new MemoryStorage();
  loadLocalProfile(second);
  const persistedDaily = recordLocalGameProgress(daily, dailyGame, second);
  const afterArchive = recordLocalGameProgress(archive, archiveGame, second, persistedDaily);
  assert.equal(afterArchive.profile.wins.length, 1);
  assert.equal(afterArchive.profile.wins[0].mode, "daily");
});
