import { test } from "node:test";
import assert from "node:assert/strict";
import saves from "./fixtures/v1-saves.json";
import type { Puzzle, SavedGame } from "../lib/game-types";
import {
  PROFILE_V1_BACKUP_PREFIX,
  PROFILE_V2_BASE_KEY,
  PROFILE_V2_BASE_PREFIX,
  PROFILE_V2_BATCH_PREFIX,
  PROFILE_V2_EVENT_PREFIX,
  isProfileStorageKey,
  loadLocalProfile,
  profileActivitiesForGame,
  recordLocalGameProgress,
  refreshLocalProfile,
  setLocalSound,
  type ProfileStorage,
} from "../lib/profile-storage";
import { restoreLegacyGame } from "../lib/legacy-storage";

class MemoryStorage implements ProfileStorage {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  constructor(entries: Iterable<readonly [string, string]> = []) { for (const [key, value] of entries) this.values.set(key, value); }
  get length() { if (this.failReads) throw new Error("read denied"); return this.values.size; }
  key(index: number) { if (this.failReads) throw new Error("read denied"); return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { if (this.failReads) throw new Error("read denied"); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error("write denied"); this.values.set(key, value); }
}

function puzzle(id: string, mode: Puzzle["mode"] = "daily"): Puzzle {
  const date = id.startsWith("daily-") ? id.slice(6) : "2026-09-08";
  return {
    id,
    mode,
    seed: mode === "daily" ? "" : id.replace(/^free-/, ""),
    date,
    number: 1,
    vocabularySize: 30000,
    resetAt: "2026-09-08T22:00:00.000Z",
    ref: {
      contractVersion: 1,
      id,
      corpusVersion: "fr-fasttext-30000-v1",
      rulesVersion: "classic-v1",
      context: mode,
      variant: "classic",
      calendar: mode === "daily" ? { version: "paris-daily-v1", date } : null,
    },
  };
}

const guess = (word: string, order: number, found = false, hint = false) => ({ word, order, found, hint, temperature: found ? 100 : 25, rank: found ? 1 : 5000, acceptedAt: `2026-09-08T00:00:${String(order).padStart(2, "0")}.000Z` });

test("V1 profiles migrate once with an exact immutable backup and identical progress", () => {
  for (const fixture of saves.fixtures) {
    const raw = fixture.storage["braise.v1.profile"];
    const storage = new MemoryStorage([["braise.v1.profile", raw]]);
    const first = loadLocalProfile(storage);
    assert.equal(first.status, "migrated");
    assert.equal(first.persisted, true);
    assert.equal(first.backupConfirmed, true);
    assert.deepEqual(first.profile, fixture.profile);
    const backupKey = [...storage.values.keys()].find(key => key.startsWith(PROFILE_V1_BACKUP_PREFIX));
    assert.ok(backupKey);
    assert.equal(storage.getItem(backupKey), raw);
    assert.equal(storage.getItem("braise.v1.profile"), raw);
    const primaryKey = [...storage.values.keys()].find(key => key.startsWith(PROFILE_V2_BASE_PREFIX));
    assert.ok(primaryKey);
    const primary = storage.getItem(primaryKey);
    for (let repeat = 0; repeat < 10; repeat += 1) {
      const next = loadLocalProfile(storage);
      assert.deepEqual(next.profile, fixture.profile);
      assert.equal(next.eventCount, 0);
      assert.equal(storage.getItem(backupKey), raw);
      assert.equal(storage.getItem(primaryKey), primary);
    }
    const xp = first.profile.wins.length * 150 + Math.min(first.profile.guesses, 10000) * 2;
    assert.equal(xp, fixture.profile.wins.length * 150 + Math.min(fixture.profile.guesses, 10000) * 2);
  }
});

test("partial legacy data keeps valid facts without inventing invalid history", () => {
  const raw = JSON.stringify({
    wins: [
      { id: "daily-2026-09-08", date: "2026-09-08", mode: "daily", tries: 8, hints: 1 },
      { id: "daily-2026-02-30", date: "2026-02-30", mode: "daily", tries: 4, hints: 0 },
      { id: "daily-2026-09-08", date: "2026-09-08", mode: "daily", tries: 9, hints: 0 },
    ],
    guesses: -2,
    sound: "yes",
  });
  const storage = new MemoryStorage([["braise.v1.profile", raw]]);
  const result = loadLocalProfile(storage);
  assert.equal(result.status, "partial");
  assert.equal(result.profile.wins.length, 1);
  assert.equal(result.profile.wins[0].id, "daily-2026-09-08");
  assert.equal(result.profile.guesses, 0);
  assert.equal(result.profile.sound, false);
  const backupKey = [...storage.values.keys()].find(key => key.startsWith(PROFILE_V1_BACKUP_PREFIX));
  assert.ok(backupKey);
  assert.equal(storage.getItem(backupKey), raw);
});

test("corrupt, conflicting and future data is preserved instead of overwritten", () => {
  const broken = new MemoryStorage([["braise.v1.profile", "{broken"]]);
  assert.equal(loadLocalProfile(broken).status, "corrupt");
  const brokenBackup = [...broken.values.keys()].find(key => key.startsWith(PROFILE_V1_BACKUP_PREFIX));
  assert.ok(brokenBackup);
  assert.equal(broken.getItem(brokenBackup), "{broken");
  assert.equal([...broken.values.keys()].some(key => key.startsWith(PROFILE_V2_BASE_PREFIX)), false);

  const futureRaw = JSON.stringify({ schemaVersion: 3, future: true });
  const future = new MemoryStorage([[PROFILE_V2_BASE_KEY, futureRaw], ["braise.v1.profile", JSON.stringify({ wins: [], guesses: 4, sound: true })]]);
  assert.equal(loadLocalProfile(future).status, "unsupported");
  assert.equal(future.getItem(PROFILE_V2_BASE_KEY), futureRaw);
  assert.equal([...future.values.keys()].some(key => key.startsWith(PROFILE_V1_BACKUP_PREFIX)), false);

  const changedLegacy = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 1, sound: false })]]);
  assert.equal(loadLocalProfile(changedLegacy).status, "migrated");
  changedLegacy.setItem("braise.v1.profile", JSON.stringify({ wins: [], guesses: 2, sound: false }));
  const detected = loadLocalProfile(changedLegacy);
  assert.equal(detected.status, "conflict");
  assert.equal(detected.profile.guesses, 1);
});

test("divergent concurrent migration bases stay conflicted and never absorb another boundary journal", () => {
  const oldRaw = JSON.stringify({ wins: [], guesses: 1, sound: false });
  const newRaw = JSON.stringify({ wins: [], guesses: 2, sound: false });
  const oldSide = new MemoryStorage([["braise.v1.profile", oldRaw]]);
  const newSide = new MemoryStorage([["braise.v1.profile", newRaw]]);
  loadLocalProfile(oldSide);
  const oldGame: SavedGame = { guesses: [guess("nouveau", 1)], pins: [], hints: 0, startedAt: 1, profileV2StartIndex: 0 };
  recordLocalGameProgress(puzzle("daily-2026-09-08"), oldGame, oldSide);
  loadLocalProfile(newSide);
  for (const [key, value] of newSide.values) if (key.startsWith(PROFILE_V2_BASE_PREFIX) || key.startsWith(PROFILE_V1_BACKUP_PREFIX)) oldSide.setItem(key, value);
  oldSide.setItem("braise.v1.profile", newRaw);
  const result = loadLocalProfile(oldSide);
  assert.equal(result.status, "conflict");
  assert.equal(result.persisted, false);
  assert.equal(result.profile.guesses, 2);
});

test("storage failures never report a persisted migration", () => {
  const denied = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 3, sound: true })]]);
  denied.failWrites = true;
  const result = loadLocalProfile(denied);
  assert.equal(result.persisted, false);
  assert.equal(result.profile.guesses, 3);
  assert.equal(result.profile.sound, true);
  assert.equal([...denied.values.keys()].some(key => key.startsWith(PROFILE_V2_BASE_PREFIX)), false);

  const unreadable = new MemoryStorage();
  unreadable.failReads = true;
  assert.equal(loadLocalProfile(unreadable).persisted, false);

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("SecurityError"); } });
  try { assert.equal(loadLocalProfile().persisted, false); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test("memory-only progress survives later commands and is retried when storage returns", () => {
  const storage = new MemoryStorage();
  const durable = loadLocalProfile(storage);
  storage.failWrites = true;
  const current = puzzle("daily-2026-09-08");
  const won: SavedGame = {
    guesses: [guess("maison", 1), guess("réponse", 2, true)],
    pins: [], hints: 0, startedAt: 1, solvedAt: Date.parse("2026-09-08T00:00:02.000Z"), profileV2StartIndex: 0,
  };
  const pendingWin = recordLocalGameProgress(current, won, storage, durable);
  assert.equal(pendingWin.persisted, false);
  assert.equal(pendingWin.profile.guesses, 2);
  assert.equal(pendingWin.profile.wins.length, 1);
  const pendingSound = setLocalSound(true, "2026-09-08T00:00:03.000Z", "sound-a", storage, pendingWin);
  assert.equal(pendingSound.profile.guesses, 2);
  assert.equal(pendingSound.profile.wins.length, 1);
  assert.equal(pendingSound.profile.sound, true);
  assert.equal(refreshLocalProfile(pendingSound, storage).profile.wins.length, 1);
  storage.failWrites = false;
  const recovered = refreshLocalProfile(pendingSound, storage);
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.pendingActivities.length, 0);
  assert.equal(recovered.profile.guesses, 2);
  assert.equal(recovered.profile.wins.length, 1);
  assert.equal(recovered.profile.sound, true);
});

test("invalid V2 metadata never discards an otherwise valid V1 game", () => {
  const raw = JSON.stringify({ guesses: [guess("ancien", 7)], pins: ["ancien"], hints: 0, startedAt: 1, profileV2StartIndex: "0" });
  const restored = restoreLegacyGame("daily-2026-09-08", 2, { getItem: () => raw });
  assert.equal(restored.guesses.length, 1);
  assert.deepEqual(restored.pins, ["ancien"]);
  assert.equal(restored.profileV2StartIndex, undefined);
});

test("append-only events converge across tabs without duplicate guesses or victories", () => {
  const storage = new MemoryStorage();
  assert.equal(loadLocalProfile(storage).persisted, true);
  const firstPuzzle = puzzle("daily-2026-09-08");
  const secondPuzzle = puzzle("free-1234", "free");
  const firstGame: SavedGame = { guesses: [guess("maison", 1)], pins: [], hints: 0, startedAt: 1, profileV2StartIndex: 0 };
  const secondGame: SavedGame = { guesses: [guess("livre", 1), guess("ordinateur", 2, true)], pins: [], hints: 0, startedAt: 2, solvedAt: Date.parse("2026-09-08T00:00:02.000Z"), profileV2StartIndex: 0 };

  recordLocalGameProgress(firstPuzzle, firstGame, storage);
  recordLocalGameProgress(secondPuzzle, secondGame, storage);
  recordLocalGameProgress(secondPuzzle, secondGame, storage);
  const merged = loadLocalProfile(storage);
  assert.equal(merged.profile.guesses, 3);
  assert.equal(merged.profile.wins.length, 1);
  assert.equal(merged.profile.wins[0].id, "free-1234");
  assert.equal(merged.eventCount, 4);

  setLocalSound(true, "2026-09-08T00:00:03.000Z", "tab-a", storage);
  setLocalSound(false, "2026-09-08T00:00:04.000Z", "tab-b", storage);
  assert.equal(loadLocalProfile(storage).profile.sound, false);
  assert.equal([...storage.values.keys()].filter(key => key.startsWith(PROFILE_V2_BATCH_PREFIX) || key.startsWith(PROFILE_V2_EVENT_PREFIX)).length, 4);
});

test("game reconciliation records only post-migration attempts and is repeatable", () => {
  const current = puzzle("daily-2026-09-08");
  const game: SavedGame = {
    guesses: [guess("ancien", 7), guess("nouveau", 2), guess("indice", 3, false, true), guess("réponse", 4, true)],
    pins: [],
    hints: 1,
    startedAt: 1,
    solvedAt: 2,
    profileV2StartIndex: 1,
  };
  const activities = profileActivitiesForGame(current, game);
  assert.deepEqual(activities.map(activity => activity.type), ["guessAccepted", "guessAccepted", "puzzleWon"]);
  const recoveredDate = profileActivitiesForGame(current, { ...game, solvedAt: 1e20 }).find(activity => activity.type === "puzzleWon");
  assert.equal(recoveredDate?.occurredAt, "2026-09-08T00:00:04.000Z");
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  recordLocalGameProgress(current, game, storage);
  const keysAfterFirstPass = [...storage.values.keys()];
  recordLocalGameProgress(current, game, storage);
  const result = loadLocalProfile(storage);
  assert.equal(result.profile.guesses, 2);
  assert.equal(result.profile.wins.length, 1);
  assert.deepEqual([...storage.values.keys()], keysAfterFirstPass);
});

test("profile keys are explicitly recognizable for cross-tab refresh", () => {
  assert.equal(isProfileStorageKey(PROFILE_V2_BASE_KEY), true);
  assert.equal(isProfileStorageKey(`${PROFILE_V1_BACKUP_PREFIX}backup`), true);
  assert.equal(isProfileStorageKey(`${PROFILE_V2_EVENT_PREFIX}event`), true);
  assert.equal(isProfileStorageKey(`${PROFILE_V2_BATCH_PREFIX}batch`), true);
  assert.equal(isProfileStorageKey("braise.v1.game.daily-2026-09-08"), false);
  assert.equal(isProfileStorageKey("braise.v1.profile"), true);
  assert.equal(isProfileStorageKey(null), true);
});
