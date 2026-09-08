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
  PROFILE_V2_IMPORT_PREFIX,
  createLocalProfileExport,
  importLocalProfile,
  inspectLocalProfileImport,
  isProfileStorageKey,
  loadLocalProfile,
  profileActivitiesForGame,
  recordLocalGameProgress,
  refreshLocalProfile,
  setLocalCosmetic,
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
  for (const completedMode of [["daily"], { toString: null }]) {
    const corrupted = restoreLegacyGame("daily-2026-09-08", 2, { getItem: () => JSON.stringify({ guesses: [guess("ancien", 7)], pins: ["ancien"], hints: 0, startedAt: 1, completedMode }) });
    assert.equal(corrupted.guesses.length, 1);
    assert.equal(corrupted.completedMode, undefined);
  }
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

test("a migrated profile exports in clear and imports atomically into a fresh profile", () => {
  const raw = saves.fixtures[0].storage["braise.v1.profile"];
  const source = new MemoryStorage([["braise.v1.profile", raw]]);
  const sourceSnapshot = loadLocalProfile(source);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  assert.match(exported.text, /"format": "braise-personal-profile"/);
  assert.match(exported.filename, /^braise-profil-2026-09-08\.json$/);

  const destination = new MemoryStorage();
  const fresh = loadLocalProfile(destination);
  assert.equal(fresh.status, "ready");
  const beforePreview = new Map(destination.values);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.status, "ready");
  assert.deepEqual(destination.values, beforePreview);
  assert.ok(preview.planId);

  const imported = importLocalProfile(exported.text, preview.planId!, destination, fresh, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(imported.persisted, true);
  assert.deepEqual(imported.snapshot?.profile, sourceSnapshot.profile);
  assert.equal(destination.getItem("braise.v1.profile"), null);
  assert.equal([...destination.values.keys()].filter(key => key.startsWith(PROFILE_V2_IMPORT_PREFIX)).length, 1);
});

test("reimporting the same profile is idempotent and does not create more records", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "exported", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;

  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  const firstPreview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.ok(firstPreview.planId);
  assert.equal(importLocalProfile(exported.text, firstPreview.planId!, destination, undefined, new Date("2026-09-08T02:00:00.000Z")).persisted, true);
  const recordCount = destination.values.size;
  for (let repeat = 0; repeat < 10; repeat += 1) {
    const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
    assert.equal(preview.status, "unchanged");
    assert.ok(preview.planId);
    const result = importLocalProfile(exported.text, preview.planId!, destination, undefined, new Date("2026-09-08T02:00:00.000Z"));
    assert.equal(result.persisted, true);
    assert.equal(destination.values.size, recordCount);
  }
});

test("fresh profile imports preserve both sides and reconcile preferences deterministically", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "source", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;

  const destination = new MemoryStorage();
  let destinationSnapshot = loadLocalProfile(destination);
  destinationSnapshot = setLocalSound(false, "2026-09-08T00:20:00.000Z", "destination", destination, destinationSnapshot);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.addedActivities, 1);
  assert.ok(preview.planId);
  const result = importLocalProfile(exported.text, preview.planId!, destination, destinationSnapshot, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.persisted, true);
  assert.equal(result.snapshot?.profile.sound, false);
  assert.deepEqual(new Set(result.snapshot?.activityIds), new Set(["sound:source", "sound:destination"]));
});

test("different V1 histories conflict without writing any import record", () => {
  const source = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 1, sound: false })]]);
  const destination = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 2, sound: false })]]);
  const exported = createLocalProfileExport(loadLocalProfile(source), new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  loadLocalProfile(destination);
  const before = new Map(destination.values);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.status, "conflict");
  assert.deepEqual(destination.values, before);
  assert.equal([...destination.values.keys()].some(key => key.startsWith(PROFILE_V2_IMPORT_PREFIX)), false);
});

test("a concurrent local change makes a confirmed import stale before any write", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "source", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  let destinationSnapshot = loadLocalProfile(destination);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.ok(preview.planId);
  destinationSnapshot = setLocalSound(false, "2026-09-08T00:20:00.000Z", "concurrent", destination, destinationSnapshot);
  const beforeConfirm = new Map(destination.values);
  const result = importLocalProfile(exported.text, preview.planId!, destination, destinationSnapshot, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.status, "stale");
  assert.equal(result.persisted, false);
  assert.deepEqual(destination.values, beforeConfirm);
});

test("invalid and future transfer files are rejected without touching local progress", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "future", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  const before = new Map(destination.values);
  assert.equal(inspectLocalProfileImport(exported.text.slice(0, -5), destination, new Date("2026-09-08T02:00:00.000Z")).status, "invalid");
  const future = JSON.parse(exported.text);
  future.activities[0].occurredAt = "2027-09-08T00:10:00.000Z";
  assert.equal(inspectLocalProfileImport(JSON.stringify(future), destination, new Date("2026-09-08T02:00:00.000Z")).status, "invalid");
  future.extra = true;
  assert.equal(inspectLocalProfileImport(JSON.stringify(future), destination, new Date("2026-09-08T02:00:00.000Z")).status, "invalid");
  assert.deepEqual(destination.values, before);
});

test("a failed atomic import reports unavailability and keeps the previous snapshot", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "source", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  const fallback = loadLocalProfile(destination);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.ok(preview.planId);
  const before = new Map(destination.values);
  destination.failWrites = true;
  const result = importLocalProfile(exported.text, preview.planId!, destination, fallback, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.status, "unavailable");
  assert.equal(result.persisted, false);
  assert.deepEqual(result.snapshot?.profile, fallback.profile);
  assert.deepEqual(destination.values, before);
});

test("an import preserves and atomically persists progress that was only in memory", () => {
  const source = new MemoryStorage();
  const exported = createLocalProfileExport(loadLocalProfile(source), new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  const durable = loadLocalProfile(destination);
  destination.failWrites = true;
  const pending = setLocalSound(true, "2026-09-08T00:10:00.000Z", "pending", destination, durable);
  assert.equal(pending.pendingActivities.length, 1);
  destination.failWrites = false;
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"), pending);
  assert.equal(preview.status, "unchanged");
  assert.ok(preview.planId);
  const result = importLocalProfile(exported.text, preview.planId!, destination, pending, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.persisted, true);
  assert.equal(result.snapshot?.profile.sound, true);
  assert.equal(result.snapshot?.pendingActivities.length, 0);
  assert.ok(result.snapshot?.activityIds.includes("sound:pending"));
});

test("an unmigrated V1 destination is a real boundary and conflicts before any write", () => {
  const source = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 10, sound: false })]]);
  const destination = new MemoryStorage([["braise.v1.profile", JSON.stringify({ wins: [], guesses: 20, sound: false })]]);
  const exported = createLocalProfileExport(loadLocalProfile(source), new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const before = new Map(destination.values);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.status, "conflict");
  assert.deepEqual(destination.values, before);
});

test("a missing historical backup remains a conflict", () => {
  const raw = JSON.stringify({ wins: [], guesses: 3, sound: true });
  const storage = new MemoryStorage([["braise.v1.profile", raw]]);
  const migrated = loadLocalProfile(storage);
  assert.equal(migrated.status, "migrated");
  storage.values.delete("braise.v1.profile");
  for (const key of [...storage.values.keys()]) if (key.startsWith(PROFILE_V1_BACKUP_PREFIX)) storage.values.delete(key);
  const result = loadLocalProfile(storage);
  assert.equal(result.status, "conflict");
  assert.equal(result.persisted, false);
});

test("a recovered daily win played through archives remains transferable", () => {
  const source = new MemoryStorage();
  const initial = loadLocalProfile(source);
  const archive = puzzle("daily-2026-09-07", "archive");
  archive.ref.context = "archive";
  archive.ref.calendar = { version: "paris-daily-v1", date: "2026-09-07" };
  const won: SavedGame = {
    guesses: [guess("réponse", 1, true)], pins: [], hints: 0, startedAt: 1,
    solvedAt: Date.parse("2026-09-08T00:00:01.000Z"), completedMode: "daily", profileV2StartIndex: 0,
  };
  const snapshot = recordLocalGameProgress(archive, won, source, initial);
  const exported = createLocalProfileExport(snapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  assert.equal(inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z")).status, "ready");
});

test("hostile JSON values and forged weekly rewards return controlled rejection", () => {
  const source = new MemoryStorage();
  const exported = createLocalProfileExport(loadLocalProfile(source), new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  const hostile = JSON.parse(exported.text);
  hostile.sourceStatus = { toString: null };
  assert.doesNotThrow(() => inspectLocalProfileImport(JSON.stringify(hostile), destination, new Date("2026-09-08T02:00:00.000Z")));
  assert.equal(inspectLocalProfileImport(JSON.stringify(hostile), destination, new Date("2026-09-08T02:00:00.000Z")).status, "invalid");

  const forged = JSON.parse(exported.text);
  forged.activities = [{
    schemaVersion: 2,
    id: "weekly-reward:weekly-ritual-v1:2026-09-07:explore-15",
    type: "weeklyRewardEarned",
    rewardId: "weekly-ritual-v1:2026-09-07:explore-15",
    value: "copper",
    occurredAt: "2026-09-08T00:00:00.000Z",
    provenance: "personal-local",
  }];
  forged.summary.activities = 1;
  assert.equal(inspectLocalProfileImport(JSON.stringify(forged), destination, new Date("2026-09-08T02:00:00.000Z")).status, "invalid");
});

test("exports refuse ignored records and transfer limits use UTF-8 bytes", () => {
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  storage.setItem(`${PROFILE_V2_EVENT_PREFIX}broken`, "{broken");
  const partial = loadLocalProfile(storage);
  assert.equal(partial.ignoredEvents, 1);
  assert.equal(createLocalProfileExport(partial, new Date("2026-09-08T01:00:00.000Z")).ok, false);

  const unicodeOversize = `${"é".repeat(4_300_000)}{}`;
  assert.ok(unicodeOversize.length < 8 * 1024 * 1024);
  const preview = inspectLocalProfileImport(unicodeOversize, new MemoryStorage(), new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.status, "invalid");
  assert.match(preview.reason, /8 Mio/);
});

test("memory-only V1 migration exports a valid recovery file", () => {
  const raw = JSON.stringify({ wins: [], guesses: 7, sound: true });
  const source = new MemoryStorage([["braise.v1.profile", raw]]);
  source.failWrites = true;
  const memory = loadLocalProfile(source);
  assert.equal(memory.status, "memory-only");
  const exported = createLocalProfileExport(memory, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  assert.equal(inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z")).status, "ready");
});

test("a permanent reward keeps its historical proof through reconciliation and transfer", () => {
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  const archiveRef = {
    contractVersion: 1 as const, id: "daily-2026-08-30", corpusVersion: "fr-fasttext-30000-v1", rulesVersion: "classic-v1",
    context: "archive" as const, variant: "classic" as const, calendar: { version: "paris-daily-v1", date: "2026-08-30" },
  };
  const dailyRef = { ...archiveRef, context: "daily" as const };
  const freeRef = {
    contractVersion: 1 as const, id: "free-1234", corpusVersion: "fr-fasttext-30000-v1", rulesVersion: "classic-v1",
    context: "free" as const, variant: "classic" as const, calendar: null,
  };
  const archiveWin = { schemaVersion: 2, id: "win:daily-2026-08-30", type: "puzzleWon", puzzleRef: archiveRef, win: { id: "daily-2026-08-30", date: "2026-08-30", mode: "archive", tries: 4, hints: 0, completedAt: "2026-08-31T10:00:00.000Z" }, occurredAt: "2026-08-31T10:00:00.000Z", provenance: "personal-local" };
  const dailyWin = { schemaVersion: 2, id: "win:daily-2026-08-30", type: "puzzleWon", puzzleRef: dailyRef, win: { id: "daily-2026-08-30", date: "2026-08-30", mode: "daily", tries: 4, hints: 0, completedAt: "2026-08-30T20:00:00.000Z" }, occurredAt: "2026-08-30T20:00:00.000Z", provenance: "personal-local" };
  const freeWin = { schemaVersion: 2, id: "win:free-1234", type: "puzzleWon", puzzleRef: freeRef, win: { id: "free-1234", date: "2026-08-31", mode: "free", tries: 5, hints: 0, completedAt: "2026-08-31T11:00:00.000Z" }, occurredAt: "2026-08-31T11:00:00.000Z", provenance: "personal-local" };
  const rewardId = "weekly-ritual-v1:2026-08-31:clear-2";
  const reward = { schemaVersion: 2, id: `weekly-reward:${rewardId}`, type: "weeklyRewardEarned", rewardId, value: "solar", occurredAt: "2026-08-31T11:01:00.000Z", provenance: "personal-local" };
  for (const [key, value] of [["archive", archiveWin], ["free", freeWin], ["reward", reward], ["daily", dailyWin]] as const) {
    storage.setItem(`${PROFILE_V2_EVENT_PREFIX}${key}`, JSON.stringify(value));
  }
  const reconciled = loadLocalProfile(storage);
  assert.equal(reconciled.profile.wins.find(win => win.id === "daily-2026-08-30")?.mode, "daily");
  const exported = createLocalProfileExport(reconciled, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;
  assert.match(exported.text, /"evidence"/);
  const destination = new MemoryStorage();
  loadLocalProfile(destination);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(preview.status, "ready");
  assert.ok(preview.planId);
  const imported = importLocalProfile(exported.text, preview.planId!, destination, undefined, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(imported.persisted, true);
  assert.ok(imported.snapshot?.activityIds.includes(`weekly-reward:${rewardId}`));
});

test("the final merged bundle is byte-bounded before storage is changed", () => {
  const source = new MemoryStorage();
  let sourceSnapshot = loadLocalProfile(source);
  sourceSnapshot = setLocalSound(true, "2026-09-08T00:10:00.000Z", "small", source, sourceSnapshot);
  const exported = createLocalProfileExport(sourceSnapshot, new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(exported.ok, true);
  if (!exported.ok) return;

  const hugeLegacy = JSON.stringify({ wins: [], guesses: 2, sound: false, padding: "é".repeat(4_300_000) });
  const destination = new MemoryStorage([["braise.v1.profile", hugeLegacy]]);
  const fallback = loadLocalProfile(destination);
  const preview = inspectLocalProfileImport(exported.text, destination, new Date("2026-09-08T02:00:00.000Z"), fallback);
  assert.equal(preview.status, "ready");
  assert.ok(preview.planId);
  const beforeImportKeys = [...destination.values.keys()].filter(key => key.startsWith(PROFILE_V2_IMPORT_PREFIX));
  const result = importLocalProfile(exported.text, preview.planId!, destination, fallback, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.status, "unavailable");
  assert.equal(result.persisted, false);
  assert.match(result.reason, /8 Mio/);
  assert.deepEqual([...destination.values.keys()].filter(key => key.startsWith(PROFILE_V2_IMPORT_PREFIX)), beforeImportKeys);
});

test("a pending preferred win keeps the imported reward proof it replaces", () => {
  const source = new MemoryStorage();
  const blank = createLocalProfileExport(loadLocalProfile(source), new Date("2026-09-08T01:00:00.000Z"));
  assert.equal(blank.ok, true);
  if (!blank.ok) return;
  const file = JSON.parse(blank.text);
  const archiveRef = { contractVersion: 1, id: "daily-2026-08-30", corpusVersion: "fr-fasttext-30000-v1", rulesVersion: "classic-v1", context: "archive", variant: "classic", calendar: { version: "paris-daily-v1", date: "2026-08-30" } };
  const freeRef = { contractVersion: 1, id: "free-1234", corpusVersion: "fr-fasttext-30000-v1", rulesVersion: "classic-v1", context: "free", variant: "classic", calendar: null };
  const archiveWin = { schemaVersion: 2, id: "win:daily-2026-08-30", type: "puzzleWon", puzzleRef: archiveRef, win: { id: "daily-2026-08-30", date: "2026-08-30", mode: "archive", tries: 1, hints: 0, completedAt: "2026-08-31T10:00:00.000Z" }, occurredAt: "2026-08-31T10:00:00.000Z", provenance: "personal-local" };
  const freeWin = { schemaVersion: 2, id: "win:free-1234", type: "puzzleWon", puzzleRef: freeRef, win: { id: "free-1234", date: "2026-08-31", mode: "free", tries: 1, hints: 0, completedAt: "2026-08-31T11:00:00.000Z" }, occurredAt: "2026-08-31T11:00:00.000Z", provenance: "personal-local" };
  const rewardId = "weekly-ritual-v1:2026-08-31:clear-2";
  file.activities = [archiveWin, freeWin, { schemaVersion: 2, id: `weekly-reward:${rewardId}`, type: "weeklyRewardEarned", rewardId, value: "solar", occurredAt: "2026-08-31T11:01:00.000Z", provenance: "personal-local" }];
  file.summary = { guesses: 0, wins: 2, activities: 3 };
  const text = JSON.stringify(file);

  const destination = new MemoryStorage();
  const durable = loadLocalProfile(destination);
  destination.failWrites = true;
  const daily = puzzle("daily-2026-08-30");
  const pending = recordLocalGameProgress(daily, { guesses: [{ ...guess("réponse", 1, true), acceptedAt: "2026-08-30T20:00:00.000Z" }], pins: [], hints: 0, startedAt: 1, solvedAt: Date.parse("2026-08-30T20:00:00.000Z"), completedMode: "daily", profileV2StartIndex: 0 }, destination, durable);
  destination.failWrites = false;
  const preview = inspectLocalProfileImport(text, destination, new Date("2026-09-08T02:00:00.000Z"), pending);
  assert.equal(preview.status, "ready");
  assert.ok(preview.planId);
  const result = importLocalProfile(text, preview.planId!, destination, pending, new Date("2026-09-08T02:00:00.000Z"));
  assert.equal(result.persisted, true);
  assert.ok(result.snapshot?.activityIds.includes(`weekly-reward:${rewardId}`));
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

test("cosmetic preferences converge without changing historical progress", () => {
  const storage = new MemoryStorage();
  const initial = loadLocalProfile(storage);
  const first = setLocalCosmetic("copper", "2026-09-08T10:00:00.000Z", "tab-a", storage, initial);
  const second = setLocalCosmetic("classic", "2026-09-08T11:00:00.000Z", "tab-b", storage, first);
  const restored = loadLocalProfile(storage);
  assert.equal(restored.persisted, true);
  assert.equal(restored.profile.guesses, 0);
  assert.deepEqual(restored.profile.wins, []);
  assert.equal(restored.profile.sound, false);
  assert.deepEqual(restored.activities.filter(activity => activity.type === "cosmeticChanged").map(activity => activity.value), ["copper", "classic"]);

  storage.failWrites = true;
  const pending = setLocalCosmetic("copper", "2026-09-08T12:00:00.000Z", "tab-c", storage, second);
  assert.equal(pending.persisted, false);
  assert.equal(pending.pendingActivities.filter(activity => activity.type === "cosmeticChanged").length, 1);
  storage.failWrites = false;
  const recovered = refreshLocalProfile(pending, storage);
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.pendingActivities.length, 0);
  assert.equal(recovered.activities.filter(activity => activity.type === "cosmeticChanged").length, 3);
});

test("invalid cosmetic events are ignored instead of changing sound or progress", () => {
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  storage.setItem(`${PROFILE_V2_EVENT_PREFIX}invalid-cosmetic`, JSON.stringify({
    schemaVersion: 2,
    id: "cosmetic:invalid",
    type: "cosmeticChanged",
    value: "unknown",
    occurredAt: "2026-09-08T10:00:00.000Z",
    provenance: "personal-local",
  }));
  const snapshot = loadLocalProfile(storage);
  assert.equal(snapshot.status, "partial");
  assert.equal(snapshot.profile.sound, false);
  assert.equal(snapshot.profile.guesses, 0);
  assert.equal(snapshot.activities.length, 0);
});

test("completed weekly objectives materialize one durable reward identity", () => {
  const storage = new MemoryStorage();
  loadLocalProfile(storage);
  const current = puzzle("free-weekly", "free");
  const game: SavedGame = {
    guesses: Array.from({ length: 15 }, (_, index) => guess(`mot-${index}`, index + 1)),
    pins: [],
    hints: 0,
    startedAt: 1,
    profileV2StartIndex: 0,
  };
  const first = recordLocalGameProgress(current, game, storage);
  const rewards = first.activities.filter(activity => activity.type === "weeklyRewardEarned");
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].value, "copper");
  assert.equal(rewards[0].id, `weekly-reward:${rewards[0].rewardId}`);

  recordLocalGameProgress(current, game, storage, first);
  const restored = refreshLocalProfile(undefined, storage);
  assert.equal(restored.activities.filter(activity => activity.type === "weeklyRewardEarned").length, 1);
});
