import type { PuzzleRef } from "./game-contracts";
import type { Profile, Puzzle, SavedGame, Win } from "./game-types";
import { parisDate } from "./calendar";
import { EMPTY_PROFILE, LEGACY_STORAGE_PREFIX } from "./legacy-storage";
import { isCosmeticId, projectWeeklyRitual, weeklyRewardCosmetic, type CosmeticId } from "./weekly-ritual";

export const PROFILE_SCHEMA_VERSION = 2 as const;
export const PROFILE_V2_BASE_PREFIX = "braise.v2.profile.base.";
export const PROFILE_V2_BASE_KEY = `${PROFILE_V2_BASE_PREFIX}fresh`;
export const PROFILE_V1_BACKUP_PREFIX = "braise.v2.backup.braise.v1.profile.";
export const PROFILE_V2_EVENT_PREFIX = "braise.v2.profile.event.";
export const PROFILE_V2_BATCH_PREFIX = "braise.v2.profile.batch.";
const LEGACY_PROFILE_KEY = `${LEGACY_STORAGE_PREFIX}profile`;

export type ProfileStorage = Pick<Storage, "getItem" | "setItem" | "length" | "key">;
export type ProfileLoadStatus = "ready" | "migrated" | "partial" | "memory-only" | "corrupt" | "unsupported" | "conflict";

type ProfileBaseV2 = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  provenance: "personal-local";
  migration: {
    source: "legacy-v1" | "fresh";
    sourceKey: typeof LEGACY_PROFILE_KEY | null;
    backupKey: string | null;
    status: "complete" | "partial";
    excludedWins: number;
  };
  legacy: { wins: Win[]; guesses: number };
  sound: boolean;
};

type GuessActivity = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "guessAccepted";
  puzzleRef: PuzzleRef;
  word: string;
  order: number;
  occurredAt: string;
  provenance: "personal-local";
};

type WinActivity = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "puzzleWon";
  puzzleRef: PuzzleRef;
  win: Win;
  occurredAt: string;
  provenance: "personal-local";
};

type SoundActivity = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "soundChanged";
  value: boolean;
  occurredAt: string;
  provenance: "personal-local";
};

type CosmeticActivity = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "cosmeticChanged";
  value: CosmeticId;
  occurredAt: string;
  provenance: "personal-local";
};

type WeeklyRewardActivity = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "weeklyRewardEarned";
  rewardId: string;
  value: CosmeticId;
  occurredAt: string;
  provenance: "personal-local";
};

export type ProfileActivity = GuessActivity | WinActivity | SoundActivity | CosmeticActivity | WeeklyRewardActivity;
type ProfileBatch = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  id: string;
  type: "gameProgress";
  activities: Array<GuessActivity | WinActivity>;
};

export type ProfileSnapshot = {
  profile: Profile;
  formatVersion: typeof PROFILE_SCHEMA_VERSION;
  status: ProfileLoadStatus;
  persisted: boolean;
  backupConfirmed: boolean;
  eventCount: number;
  ignoredEvents: number;
  activityIds: string[];
  activities: ProfileActivity[];
  pendingActivities: ProfileActivity[];
};

const EMPTY_SNAPSHOT: ProfileSnapshot = {
  profile: EMPTY_PROFILE,
  formatVersion: PROFILE_SCHEMA_VERSION,
  status: "memory-only",
  persisted: false,
  backupConfirmed: false,
  eventCount: 0,
  ignoredEvents: 0,
  activityIds: [],
  activities: [],
  pendingActivities: [],
};

function browserStorage(): ProfileStorage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

function storageFingerprint(raw: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function isoFromTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function validWinFields(value: Record<string, unknown>, modes: string[]) {
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 160 && isIsoDate(value.date) &&
    modes.includes(String(value.mode)) && Number.isSafeInteger(value.tries) && Number(value.tries) >= 1 &&
    Number.isSafeInteger(value.hints) && Number(value.hints) >= 0 && Number(value.hints) <= 3 && Number(value.hints) <= Number(value.tries);
}

function isLegacyWin(value: unknown): value is Win {
  if (!isRecord(value) || !exactKeys(value, ["id", "date", "mode", "tries", "hints"])) return false;
  return validWinFields(value, ["daily", "free", "challenge"]);
}

function isWin(value: unknown): value is Win {
  if (!isRecord(value)) return false;
  const keys = value.completedAt === undefined ? ["id", "date", "mode", "tries", "hints"] : ["id", "date", "mode", "tries", "hints", "completedAt"];
  return exactKeys(value, keys) && validWinFields(value, ["daily", "archive", "free", "challenge"]) &&
    (value.completedAt === undefined || isIsoInstant(value.completedAt));
}

function preferredWin(first: Win, second: Win) {
  if (first.mode !== second.mode && [first.mode, second.mode].includes("daily") && [first.mode, second.mode].includes("archive")) {
    return first.mode === "daily" ? first : second;
  }
  if (first.completedAt !== second.completedAt) {
    if (first.completedAt === undefined) return first;
    if (second.completedAt === undefined) return second;
    return first.completedAt < second.completedAt ? first : second;
  }
  return JSON.stringify(first) <= JSON.stringify(second) ? first : second;
}

function stableWin(wins: Win[], candidate: Win) {
  const existing = wins.find(win => win.id === candidate.id);
  if (!existing) return [...wins, candidate];
  const selected = preferredWin(existing, candidate);
  return wins.map(win => win.id === candidate.id ? selected : win);
}

function preferredActivity(first: ProfileActivity, second: ProfileActivity) {
  if (first.type === "puzzleWon" && second.type === "puzzleWon") return preferredWin(first.win, second.win) === first.win ? first : second;
  if (first.type === "guessAccepted" && second.type === "guessAccepted" && first.puzzleRef.context !== second.puzzleRef.context &&
      [first.puzzleRef.context, second.puzzleRef.context].includes("daily") && [first.puzzleRef.context, second.puzzleRef.context].includes("archive")) {
    return first.puzzleRef.context === "daily" ? first : second;
  }
  return JSON.stringify(first) <= JSON.stringify(second) ? first : second;
}

function parsePuzzleRef(value: unknown): value is PuzzleRef {
  if (!isRecord(value) || !exactKeys(value, ["contractVersion", "id", "corpusVersion", "rulesVersion", "context", "variant", "calendar"]) ||
      value.contractVersion !== 1 || typeof value.id !== "string" || !value.id ||
      typeof value.corpusVersion !== "string" || typeof value.rulesVersion !== "string" ||
      !["daily", "archive", "free", "challenge", "collection", "expedition", "circle", "duel", "creation"].includes(String(value.context)) ||
      !["classic", "two-braises", "intruder", "chain"].includes(String(value.variant))) return false;
  if (value.calendar === null) return true;
  return isRecord(value.calendar) && exactKeys(value.calendar, ["version", "date"]) && typeof value.calendar.version === "string" && isIsoDate(value.calendar.date);
}

function parseBase(value: unknown): ProfileBaseV2 | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "provenance", "migration", "legacy", "sound"]) ||
      value.schemaVersion !== PROFILE_SCHEMA_VERSION || value.provenance !== "personal-local" || typeof value.sound !== "boolean" ||
      !isRecord(value.migration) || !exactKeys(value.migration, ["source", "sourceKey", "backupKey", "status", "excludedWins"]) ||
      !["legacy-v1", "fresh"].includes(String(value.migration.source)) ||
      ![LEGACY_PROFILE_KEY, null].includes(value.migration.sourceKey as typeof LEGACY_PROFILE_KEY | null) ||
      !(value.migration.backupKey === null || typeof value.migration.backupKey === "string" && value.migration.backupKey.startsWith(PROFILE_V1_BACKUP_PREFIX)) ||
      !["complete", "partial"].includes(String(value.migration.status)) || !Number.isSafeInteger(value.migration.excludedWins) || Number(value.migration.excludedWins) < 0 ||
      !isRecord(value.legacy) || !exactKeys(value.legacy, ["wins", "guesses"]) || !Array.isArray(value.legacy.wins) ||
      !value.legacy.wins.every(isLegacyWin) || !Number.isSafeInteger(value.legacy.guesses) || Number(value.legacy.guesses) < 0) return null;
  return value as ProfileBaseV2;
}

function parseActivity(value: unknown): ProfileActivity | null {
  if (!isRecord(value) || value.schemaVersion !== PROFILE_SCHEMA_VERSION || value.provenance !== "personal-local" ||
      typeof value.id !== "string" || !value.id || value.id.length > 300 || !isIsoInstant(value.occurredAt)) return null;
  if (value.type === "soundChanged") {
    return exactKeys(value, ["schemaVersion", "id", "type", "value", "occurredAt", "provenance"]) && typeof value.value === "boolean" ? value as SoundActivity : null;
  }
  if (value.type === "cosmeticChanged") {
    return exactKeys(value, ["schemaVersion", "id", "type", "value", "occurredAt", "provenance"]) && isCosmeticId(value.value) ? value as CosmeticActivity : null;
  }
  if (value.type === "weeklyRewardEarned") {
    const cosmetic = weeklyRewardCosmetic(value.rewardId);
    return exactKeys(value, ["schemaVersion", "id", "type", "rewardId", "value", "occurredAt", "provenance"]) &&
      cosmetic !== null && value.value === cosmetic && value.id === `weekly-reward:${value.rewardId}` ? value as WeeklyRewardActivity : null;
  }
  if (!parsePuzzleRef(value.puzzleRef)) return null;
  if (value.type === "guessAccepted") {
    return exactKeys(value, ["schemaVersion", "id", "type", "puzzleRef", "word", "order", "occurredAt", "provenance"]) &&
      typeof value.word === "string" && value.word.length > 0 && value.word.length <= 80 && Number.isSafeInteger(value.order) && Number(value.order) >= 1 ? value as GuessActivity : null;
  }
  if (value.type === "puzzleWon") {
    return exactKeys(value, ["schemaVersion", "id", "type", "puzzleRef", "win", "occurredAt", "provenance"]) && isWin(value.win) ? value as WinActivity : null;
  }
  return null;
}

function parseBatch(value: unknown): ProfileBatch | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "id", "type", "activities"]) || value.schemaVersion !== PROFILE_SCHEMA_VERSION ||
      value.type !== "gameProgress" || typeof value.id !== "string" || !value.id || !Array.isArray(value.activities)) return null;
  const activities = value.activities.map(parseActivity);
  if (activities.some(activity => !activity || activity.type !== "guessAccepted" && activity.type !== "puzzleWon")) return null;
  return { schemaVersion: PROFILE_SCHEMA_VERSION, id: value.id, type: "gameProgress", activities: activities as Array<GuessActivity | WinActivity> };
}

function read(storage: ProfileStorage, key: string) {
  try { return { ok: true as const, value: storage.getItem(key) }; }
  catch { return { ok: false as const, value: null }; }
}

function writeVerified(storage: ProfileStorage, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return storage.getItem(key) === value;
  } catch { return false; }
}

function migrateLegacy(raw: string): ProfileBaseV2 | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  let partial = false;
  const wins: Win[] = [];
  let excludedWins = 0;
  if (Array.isArray(value.wins)) {
    for (const candidate of value.wins) {
      if (!isLegacyWin(candidate)) { partial = true; excludedWins += 1; continue; }
      if (wins.some(win => win.id === candidate.id)) partial = true;
      const next = stableWin(wins, candidate);
      wins.splice(0, wins.length, ...next);
    }
  } else { partial = true; }
  const guesses = Number.isSafeInteger(value.guesses) && Number(value.guesses) >= 0 ? Number(value.guesses) : 0;
  const sound = typeof value.sound === "boolean" ? value.sound : false;
  if (guesses !== value.guesses || sound !== value.sound) partial = true;
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    provenance: "personal-local",
    migration: { source: "legacy-v1", sourceKey: LEGACY_PROFILE_KEY, backupKey: null, status: partial ? "partial" : "complete", excludedWins },
    legacy: { wins, guesses },
    sound,
  };
}

function freshBase(): ProfileBaseV2 {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    provenance: "personal-local",
    migration: { source: "fresh", sourceKey: null, backupKey: null, status: "complete", excludedWins: 0 },
    legacy: { wins: [], guesses: 0 },
    sound: false,
  };
}

function listActivities(storage: ProfileStorage) {
  const byId = new Map<string, ProfileActivity>();
  let ignored = 0;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key && (key.startsWith(PROFILE_V2_EVENT_PREFIX) || key.startsWith(PROFILE_V2_BATCH_PREFIX))));
    for (const key of keys) {
      const raw = storage.getItem(key);
      if (!raw) { ignored += 1; continue; }
      try {
        const parsed = JSON.parse(raw);
        const single = key.startsWith(PROFILE_V2_BATCH_PREFIX) ? null : parseActivity(parsed);
        const eventActivities = key.startsWith(PROFILE_V2_BATCH_PREFIX) ? parseBatch(parsed)?.activities ?? null : single ? [single] : null;
        if (!eventActivities) { ignored += 1; continue; }
        for (const activity of eventActivities) {
          const existing = byId.get(activity.id);
          if (!existing) byId.set(activity.id, activity);
          else byId.set(activity.id, preferredActivity(existing, activity));
        }
      } catch { ignored += 1; }
    }
    return { ok: true as const, activities: [...byId.values()], ignored };
  } catch { return { ok: false as const, activities: [], ignored: 0 }; }
}

function snapshotFrom(base: ProfileBaseV2, storage: ProfileStorage, status: ProfileLoadStatus, backupConfirmed: boolean): ProfileSnapshot {
  const listed = listActivities(storage);
  if (!listed.ok) return { ...EMPTY_SNAPSHOT, profile: { wins: [...base.legacy.wins], guesses: base.legacy.guesses, sound: base.sound } };
  let wins = [...base.legacy.wins];
  let guesses = base.legacy.guesses;
  let sound = base.sound;
  let soundStamp = "";
  for (const activity of listed.activities) {
    if (activity.type === "guessAccepted") guesses += 1;
    else if (activity.type === "puzzleWon") wins = stableWin(wins, activity.win);
    else if (activity.type === "soundChanged") {
      const stamp = `${activity.occurredAt}:${activity.id}`;
      if (stamp > soundStamp) { sound = activity.value; soundStamp = stamp; }
    }
  }
  const effectiveStatus = listed.ignored > 0 && ["ready", "migrated"].includes(status) ? "partial" : status;
  return {
    profile: { wins, guesses, sound },
    formatVersion: PROFILE_SCHEMA_VERSION,
    status: effectiveStatus,
    persisted: true,
    backupConfirmed,
    eventCount: listed.activities.length,
    ignoredEvents: listed.ignored,
    activityIds: listed.activities.map(activity => activity.id),
    activities: listed.activities,
    pendingActivities: [],
  };
}

function memorySnapshot(base: ProfileBaseV2, backupConfirmed: boolean): ProfileSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    profile: { wins: [...base.legacy.wins], guesses: base.legacy.guesses, sound: base.sound },
    backupConfirmed,
  };
}

function applyActivitiesInMemory(snapshot: ProfileSnapshot, activities: ProfileActivity[]): ProfileSnapshot {
  const knownIds = new Set(snapshot.activityIds);
  const canonicalActivities = new Map(snapshot.activities.map(activity => [activity.id, activity]));
  const pending = new Map<string, ProfileActivity>();
  for (const activity of snapshot.pendingActivities) {
    const existing = pending.get(activity.id);
    const selected = existing ? preferredActivity(existing, activity) : activity;
    pending.set(activity.id, selected);
    canonicalActivities.set(activity.id, selected);
  }
  let profile: Profile = { ...snapshot.profile, wins: [...snapshot.profile.wins] };
  for (const activity of activities) {
    const pendingActivity = pending.get(activity.id);
    if (pendingActivity) {
      const selected = preferredActivity(pendingActivity, activity);
      pending.set(activity.id, selected);
      canonicalActivities.set(activity.id, selected);
      if (selected.type === "puzzleWon") profile = { ...profile, wins: stableWin(profile.wins, selected.win) };
      continue;
    }
    if (knownIds.has(activity.id)) {
      if (activity.type === "puzzleWon") {
        const before = profile.wins.find(win => win.id === activity.win.id);
        const wins = stableWin(profile.wins, activity.win);
        const after = wins.find(win => win.id === activity.win.id);
        if (JSON.stringify(before) !== JSON.stringify(after)) { profile = { ...profile, wins }; pending.set(activity.id, activity); canonicalActivities.set(activity.id, activity); }
      }
      continue;
    }
    knownIds.add(activity.id);
    pending.set(activity.id, activity);
    canonicalActivities.set(activity.id, activity);
    if (activity.type === "guessAccepted") profile = { ...profile, guesses: profile.guesses + 1 };
    else if (activity.type === "puzzleWon") profile = { ...profile, wins: stableWin(profile.wins, activity.win) };
    else if (activity.type === "soundChanged") profile = { ...profile, sound: activity.value };
  }
  const status = ["conflict", "corrupt", "unsupported"].includes(snapshot.status) ? snapshot.status : "memory-only";
  return { ...snapshot, profile, status, persisted: false, eventCount: knownIds.size, activityIds: [...knownIds], activities: [...canonicalActivities.values()], pendingActivities: [...pending.values()] };
}

function listBaseCandidates(storage: ProfileStorage) {
  const candidates: Array<{ key: string; base: ProfileBaseV2 }> = [];
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key?.startsWith(PROFILE_V2_BASE_PREFIX)));
    for (const key of keys.sort()) {
      const raw = storage.getItem(key);
      if (!raw) return { ok: false as const, status: "corrupt" as const, candidates: [] };
      let value: unknown;
      try { value = JSON.parse(raw); } catch { return { ok: false as const, status: "corrupt" as const, candidates: [] }; }
      if (isRecord(value) && typeof value.schemaVersion === "number" && value.schemaVersion > PROFILE_SCHEMA_VERSION) return { ok: false as const, status: "unsupported" as const, candidates: [] };
      const base = parseBase(value);
      if (!base) return { ok: false as const, status: "corrupt" as const, candidates: [] };
      candidates.push({ key, base });
    }
    return { ok: true as const, status: null, candidates };
  } catch { return { ok: false as const, status: "memory-only" as const, candidates: [] }; }
}

function loadExistingBase(storage: ProfileStorage, legacyRaw: string | null): ProfileSnapshot | null {
  const listed = listBaseCandidates(storage);
  if (!listed.ok) return { ...EMPTY_SNAPSHOT, status: listed.status };
  if (!listed.candidates.length) return null;
  let selected = listed.candidates.find(candidate => candidate.base.migration.source === "fresh") ?? listed.candidates[0];
  let backupConfirmed = false;
  let conflict = false;
  if (legacyRaw !== null) {
    const matching = listed.candidates.find(candidate => {
      const backupKey = candidate.base.migration.backupKey;
      if (!backupKey) return false;
      const backup = read(storage, backupKey);
      return backup.ok && backup.value === legacyRaw;
    });
    if (matching) selected = matching;
    else conflict = true;
  } else if (selected.base.migration.source === "legacy-v1") conflict = true;
  if (selected.base.migration.backupKey) {
    const backup = read(storage, selected.base.migration.backupKey);
    if (!backup.ok) return memorySnapshot(selected.base, false);
    backupConfirmed = backup.value !== null;
    if (!backupConfirmed) conflict = true;
  }
  if (listed.candidates.length > 1) return { ...memorySnapshot(selected.base, backupConfirmed), status: "conflict" };
  return snapshotFrom(selected.base, storage, conflict ? "conflict" : selected.base.migration.status === "partial" ? "partial" : "ready", backupConfirmed);
}

export function loadLocalProfile(storage?: ProfileStorage): ProfileSnapshot {
  const selected = storage ?? browserStorage();
  if (!selected) return EMPTY_SNAPSHOT;
  const legacy = read(selected, LEGACY_PROFILE_KEY);
  if (!legacy.ok) return EMPTY_SNAPSHOT;
  const existing = loadExistingBase(selected, legacy.value);
  if (existing) return existing;
  if (legacy.value === null) {
    const base = freshBase();
    const raw = JSON.stringify(base);
    return writeVerified(selected, PROFILE_V2_BASE_KEY, raw) ? snapshotFrom(base, selected, "ready", false) : EMPTY_SNAPSHOT;
  }
  const fingerprint = storageFingerprint(legacy.value);
  const backupKey = `${PROFILE_V1_BACKUP_PREFIX}${fingerprint}`;
  const baseKey = `${PROFILE_V2_BASE_PREFIX}${fingerprint}`;
  const priorBackup = read(selected, backupKey);
  if (!priorBackup.ok) return EMPTY_SNAPSHOT;
  if (priorBackup.value !== null && priorBackup.value !== legacy.value) return { ...EMPTY_SNAPSHOT, status: "conflict", backupConfirmed: true };
  const base = migrateLegacy(legacy.value);
  if (priorBackup.value === null && !writeVerified(selected, backupKey, legacy.value)) return base ? memorySnapshot(base, false) : { ...EMPTY_SNAPSHOT, status: "corrupt" };
  if (!base) return { ...EMPTY_SNAPSHOT, status: "corrupt", backupConfirmed: true };
  base.migration.backupKey = backupKey;
  const raw = JSON.stringify(base);
  const priorBase = read(selected, baseKey);
  if (!priorBase.ok) return memorySnapshot(base, true);
  if (priorBase.value !== null && priorBase.value !== raw) return { ...memorySnapshot(base, true), status: "conflict" };
  if (priorBase.value === null && !writeVerified(selected, baseKey, raw)) return memorySnapshot(base, true);
  return snapshotFrom(base, selected, base.migration.status === "partial" ? "partial" : "migrated", true);
}

function eventKey(id: string, raw: string) {
  return `${PROFILE_V2_EVENT_PREFIX}${encodeURIComponent(id)}.${storageFingerprint(raw)}`;
}

function persistActivities(storage: ProfileStorage | undefined, activities: ProfileActivity[], fallback?: ProfileSnapshot): ProfileSnapshot {
  const selected = storage ?? browserStorage();
  const pending = new Map<string, ProfileActivity>();
  for (const activity of [...(fallback?.pendingActivities ?? []), ...activities]) {
    const existing = pending.get(activity.id);
    pending.set(activity.id, existing ? preferredActivity(existing, activity) : activity);
  }
  const requested = [...pending.values()];
  const initial = selected ? loadLocalProfile(selected) : fallback ?? EMPTY_SNAPSHOT;
  if (!selected || !initial.persisted) return applyActivitiesInMemory(fallback ?? initial, activities);
  const existingActivities = listActivities(selected);
  if (!existingActivities.ok) return applyActivitiesInMemory(initial, requested);
  const existingById = new Map(existingActivities.activities.map(activity => [activity.id, activity]));
  for (const activity of requested) {
    const known = existingById.get(activity.id);
    if (known && preferredActivity(known, activity) === known) continue;
    const raw = JSON.stringify(activity);
    const key = eventKey(activity.id, raw);
    const existing = read(selected, key);
    if (!existing.ok) return applyActivitiesInMemory(initial, requested);
    if (existing.value === raw) continue;
    if (existing.value !== null || !writeVerified(selected, key, raw)) return applyActivitiesInMemory(loadLocalProfile(selected), requested);
    existingById.set(activity.id, activity);
  }
  return loadLocalProfile(selected);
}

export function refreshLocalProfile(fallback?: ProfileSnapshot, storage?: ProfileStorage) {
  const snapshot = persistActivities(storage, [], fallback);
  return checkpointWeeklyRewards(snapshot, storage);
}

function checkpointWeeklyRewards(snapshot: ProfileSnapshot, storage?: ProfileStorage, occurredAt = new Date().toISOString()) {
  const projection = projectWeeklyRitual(snapshot.activities, snapshot.profile.wins, new Date(occurredAt));
  const known = new Set(snapshot.activities.flatMap(activity => activity.type === "weeklyRewardEarned" ? [activity.rewardId] : []));
  const activities = projection.earnedRewardIds.flatMap(rewardId => {
    if (known.has(rewardId)) return [];
    const value = weeklyRewardCosmetic(rewardId);
    if (!value) return [];
    return [{
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: `weekly-reward:${rewardId}`,
      type: "weeklyRewardEarned" as const,
      rewardId,
      value,
      occurredAt,
      provenance: "personal-local" as const,
    }];
  });
  return activities.length ? persistActivities(storage, activities, snapshot) : snapshot;
}

function persistGameActivities(storage: ProfileStorage | undefined, activities: Array<GuessActivity | WinActivity>, fallback?: ProfileSnapshot): ProfileSnapshot {
  const selected = storage ?? browserStorage();
  const initial = persistActivities(selected ?? undefined, [], fallback);
  if (!selected || !initial.persisted) return applyActivitiesInMemory(initial, activities);
  const listed = listActivities(selected);
  if (!listed.ok) return applyActivitiesInMemory(initial, activities);
  const existingById = new Map(listed.activities.map(activity => [activity.id, activity]));
  const missing = activities.filter(activity => {
    const known = existingById.get(activity.id);
    return !known || preferredActivity(known, activity) !== known;
  });
  if (!missing.length) return initial;
  const batch: ProfileBatch = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: `progress:${missing.map(activity => activity.id).sort().join("|")}`,
    type: "gameProgress",
    activities: missing,
  };
  const raw = JSON.stringify(batch);
  const key = `${PROFILE_V2_BATCH_PREFIX}${storageFingerprint(raw)}`;
  const existing = read(selected, key);
  if (!existing.ok || existing.value !== null && existing.value !== raw || existing.value === null && !writeVerified(selected, key, raw)) {
    return applyActivitiesInMemory(loadLocalProfile(selected), activities);
  }
  return loadLocalProfile(selected);
}

function guessActivity(puzzle: Puzzle, word: string, order: number, occurredAt: string): GuessActivity {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: `guess:${puzzle.ref.id}:${word}`,
    type: "guessAccepted",
    puzzleRef: puzzle.ref,
    word,
    order,
    occurredAt,
    provenance: "personal-local",
  };
}

function winActivity(puzzle: Puzzle, game: SavedGame, occurredAt: string): WinActivity {
  const completedMode = game.completedMode ?? (puzzle.id.startsWith("daily-") && parisDate(new Date(occurredAt)) === puzzle.date ? "daily" : puzzle.mode);
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: `win:${puzzle.ref.id}`,
    type: "puzzleWon",
    puzzleRef: puzzle.ref,
    win: { id: puzzle.id, date: puzzle.date, mode: completedMode, tries: game.guesses.length, hints: game.hints, completedAt: occurredAt },
    occurredAt,
    provenance: "personal-local",
  };
}

export function profileActivitiesForGame(puzzle: Puzzle, game: SavedGame): ProfileActivity[] {
  const start = game.profileV2StartIndex;
  if (!Number.isSafeInteger(start) || Number(start) < 0) return [];
  const postMigration = game.guesses.slice(Number(start));
  const activities: ProfileActivity[] = postMigration
    .filter(guess => !guess.hint && isIsoInstant(guess.acceptedAt))
    .map(guess => guessActivity(puzzle, guess.word, guess.order, guess.acceptedAt!));
  const found = postMigration.find(guess => guess.found);
  if (found) {
    const completedAt = isoFromTimestamp(game.solvedAt) ?? (isIsoInstant(found.acceptedAt) ? found.acceptedAt : null);
    if (completedAt) activities.push(winActivity(puzzle, game, completedAt));
  }
  return activities;
}

export function recordLocalGameProgress(puzzle: Puzzle, game: SavedGame, storage?: ProfileStorage, fallback?: ProfileSnapshot) {
  const snapshot = persistGameActivities(storage, profileActivitiesForGame(puzzle, game) as Array<GuessActivity | WinActivity>, fallback);
  return checkpointWeeklyRewards(snapshot, storage);
}

export function setLocalSound(value: boolean, occurredAt: string, operationId: string, storage?: ProfileStorage, fallback?: ProfileSnapshot) {
  const activity: SoundActivity = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: `sound:${operationId}`,
    type: "soundChanged",
    value,
    occurredAt,
    provenance: "personal-local",
  };
  return persistActivities(storage, [activity], fallback);
}

export function setLocalCosmetic(value: CosmeticId, occurredAt: string, operationId: string, storage?: ProfileStorage, fallback?: ProfileSnapshot) {
  if (!isCosmeticId(value)) return persistActivities(storage, [], fallback);
  const activity: CosmeticActivity = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: `cosmetic:${operationId}`,
    type: "cosmeticChanged",
    value,
    occurredAt,
    provenance: "personal-local",
  };
  return persistActivities(storage, [activity], fallback);
}

export function isProfileStorageKey(key: string | null) {
  return key === null || key === LEGACY_PROFILE_KEY || Boolean(key.startsWith(PROFILE_V2_BASE_PREFIX)) || Boolean(key.startsWith(PROFILE_V1_BACKUP_PREFIX)) || Boolean(key.startsWith(PROFILE_V2_EVENT_PREFIX)) || Boolean(key.startsWith(PROFILE_V2_BATCH_PREFIX));
}
