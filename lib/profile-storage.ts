import type { PuzzleRef } from "./game-contracts";
import type { IntruderAttempt } from "./intruder";
import type { TwoBraisesGuess } from "./two-braises";
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
export const PROFILE_V2_IMPORT_PREFIX = "braise.v2.profile.import.";
export const PROFILE_TRANSFER_MAX_BYTES = 8 * 1024 * 1024;
const PROFILE_TRANSFER_VERSION = 1 as const;
const LEGACY_PROFILE_KEY = `${LEGACY_STORAGE_PREFIX}profile`;
const INTRUDER_PREFIX = "braise.v2.intruder.attempt.";
const TWO_BRAISES_PREFIX = "braise.v2.two-braises.guess.";
export function readTwoBraises(pair: number, storage?: ProfileStorage): TwoBraisesGuess[] {
  const results = new Map<string, TwoBraisesGuess>();
  try {
    const target = storage ?? localStorage;
    for (let i = 0; i < target.length; i++) {
      const key = target.key(i); if (!key?.startsWith(`${TWO_BRAISES_PREFIX}${pair}.`)) continue;
      let value; try { value = JSON.parse(target.getItem(key) ?? "null"); } catch { continue; }
      if (!value || value.edition !== "deux-braises-v1" || value.pair !== pair || typeof value.word !== "string" || value.word.length > 80 || typeof value.acceptedAt !== "string" || !Number.isFinite(Date.parse(value.acceptedAt)) || !Array.isArray(value.values) || value.values.length !== 2 || !value.values.every((item: { word?: unknown; temperature?: unknown; rank?: unknown; found?: unknown }) => item && item.word === value.word && typeof item.temperature === "number" && Number.isFinite(item.temperature) && Number.isInteger(item.rank) && typeof item.found === "boolean")) continue;
      const previous = results.get(value.word);
      if (!previous || Date.parse(value.acceptedAt) < Date.parse(previous.acceptedAt)) results.set(value.word, value);
    }
  } catch { /* Session keeps unsaved responses. */ }
  return [...results.values()].sort((a, b) => Date.parse(a.acceptedAt) - Date.parse(b.acceptedAt) || a.word.localeCompare(b.word));
}
export function saveTwoBraises(guess: TwoBraisesGuess, storage?: ProfileStorage): boolean {
  try {
    const target = storage ?? localStorage;
    if (readTwoBraises(guess.pair, target).some(item => item.word === guess.word)) return true;
    const key = `${TWO_BRAISES_PREFIX}${guess.pair}.${encodeURIComponent(guess.word)}.${crypto.randomUUID()}`;
    target.setItem(key, JSON.stringify(guess));
    return target.getItem(key) === JSON.stringify(guess);
  } catch { return false; }
}

// Independent local laboratory history, excluded from the profile-only export.
// Append-only attempts converge by earliest timestamp, then stable key.
export function readIntruderAttempts(storage?: ProfileStorage): IntruderAttempt[] {
  const selected = new Map<number, { key: string; value: IntruderAttempt }>();
  try {
    storage = storage ?? localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i); if (!key?.startsWith(INTRUDER_PREFIX)) continue;
      let value; try { value = JSON.parse(storage.getItem(key) ?? "null"); } catch { continue; }
      if (!value || value.edition !== "intrus-v1" || !Number.isInteger(value.index) || value.index < 0 || value.index >= 20 || !Number.isInteger(value.choice) || value.choice < 0 || value.choice > 3 || typeof value.occurredAt !== "string" || !Number.isFinite(Date.parse(value.occurredAt)) || new Date(value.occurredAt).toISOString() !== value.occurredAt) continue;
      const previous = selected.get(value.index);
      if (!previous || value.occurredAt < previous.value.occurredAt || value.occurredAt === previous.value.occurredAt && key < previous.key) selected.set(value.index, { key, value });
    }
  } catch { /* Unavailable storage is handled by the current session. */ }
  return [...selected.values()].map(item => item.value).sort((a, b) => a.index - b.index);
}
export function saveIntruderAttempt(attempt: IntruderAttempt, storage?: ProfileStorage): { persisted: boolean; attempt: IntruderAttempt } {
  try {
    const target = storage ?? localStorage;
    const previous = readIntruderAttempts(target).find(item => item.index === attempt.index);
    if (previous) return { persisted: true, attempt: previous };
    target.setItem(`${INTRUDER_PREFIX}${attempt.index}.${crypto.randomUUID()}`, JSON.stringify(attempt));
    return { persisted: true, attempt: readIntruderAttempts(target).find(item => item.index === attempt.index) ?? attempt };
  } catch { return { persisted: false, attempt }; }
}

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

type ProfileImportBundle = {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  transferVersion: typeof PROFILE_TRANSFER_VERSION;
  type: "profileImport";
  base: ProfileBaseV2;
  legacyRaw: string | null;
  activities: ProfileActivity[];
  evidence: Array<GuessActivity | WinActivity>;
};

type ProfileTransferEnvelope = {
  format: "braise-personal-profile";
  exportVersion: typeof PROFILE_TRANSFER_VERSION;
  profileSchemaVersion: typeof PROFILE_SCHEMA_VERSION;
  provenance: "personal-local";
  exportedAt: string;
  sourceStatus: ProfileLoadStatus;
  scope: "profile-only";
  summary: { guesses: number; wins: number; activities: number };
  base: ProfileBaseV2;
  legacyRaw: string | null;
  activities: ProfileActivity[];
  evidence: Array<GuessActivity | WinActivity>;
};

export type ProfileImportPreview = {
  status: "ready" | "unchanged" | "invalid" | "unsupported" | "conflict" | "unavailable" | "stale";
  reason: string;
  planId: string | null;
  addedActivities: number;
  existingActivities: number;
  reconciledActivities: number;
};

export type ProfileImportResult = ProfileImportPreview & {
  snapshot: ProfileSnapshot | null;
  persisted: boolean;
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
  transferEvidence: ProfileActivity[];
  transferBase: ProfileBaseV2 | null;
  transferLegacyRaw: string | null;
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
  transferEvidence: [],
  transferBase: null,
  transferLegacyRaw: null,
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
    typeof value.mode === "string" && modes.includes(value.mode) && Number.isSafeInteger(value.tries) && Number(value.tries) >= 1 &&
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
      typeof value.context !== "string" || !["daily", "archive", "free", "challenge", "collection", "expedition", "circle", "duel", "creation"].includes(value.context) ||
      typeof value.variant !== "string" || !["classic", "two-braises", "intruder", "chain"].includes(value.variant)) return false;
  if (value.calendar === null) return true;
  return isRecord(value.calendar) && exactKeys(value.calendar, ["version", "date"]) && typeof value.calendar.version === "string" && isIsoDate(value.calendar.date);
}

function parseBase(value: unknown): ProfileBaseV2 | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "provenance", "migration", "legacy", "sound"]) ||
      value.schemaVersion !== PROFILE_SCHEMA_VERSION || value.provenance !== "personal-local" || typeof value.sound !== "boolean" ||
      !isRecord(value.migration) || !exactKeys(value.migration, ["source", "sourceKey", "backupKey", "status", "excludedWins"]) ||
      typeof value.migration.source !== "string" || !["legacy-v1", "fresh"].includes(value.migration.source) ||
      ![LEGACY_PROFILE_KEY, null].includes(value.migration.sourceKey as typeof LEGACY_PROFILE_KEY | null) ||
      !(value.migration.backupKey === null || typeof value.migration.backupKey === "string" && value.migration.backupKey.startsWith(PROFILE_V1_BACKUP_PREFIX)) ||
      typeof value.migration.status !== "string" || !["complete", "partial"].includes(value.migration.status) || !Number.isSafeInteger(value.migration.excludedWins) || Number(value.migration.excludedWins) < 0 ||
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

function validImportedActivity(activity: ProfileActivity, now: Date) {
  if (Date.parse(activity.occurredAt) > now.getTime()) return false;
  if (activity.type === "guessAccepted" || activity.type === "puzzleWon") {
    const ref = activity.puzzleRef;
    if (ref.id.length > 160 || ref.corpusVersion !== "fr-fasttext-30000-v1" || ref.rulesVersion !== "classic-v1" ||
        ref.variant !== "classic" || !["daily", "archive", "free", "challenge"].includes(ref.context)) return false;
    if (ref.context === "daily" || ref.context === "archive") {
      if (!ref.id.startsWith("daily-") || !isIsoDate(ref.id.slice(6)) || !ref.calendar ||
          ref.calendar.version !== "paris-daily-v1" || ref.calendar.date !== ref.id.slice(6)) return false;
    } else if (!/^free-\d+$/.test(ref.id) || ref.calendar !== null) return false;
    if (activity.type === "guessAccepted") return activity.id === `guess:${ref.id}:${activity.word}`;
    if (activity.id !== `win:${ref.id}` || activity.win.id !== ref.id || activity.win.completedAt !== activity.occurredAt) return false;
    if (ref.id.startsWith("daily-") && activity.win.date !== ref.id.slice(6)) return false;
    if (ref.context === "daily" && activity.win.mode !== "daily") return false;
    if (ref.context === "archive" && !["daily", "archive"].includes(activity.win.mode)) return false;
    if (["free", "challenge"].includes(ref.context) && !["free", "challenge"].includes(activity.win.mode)) return false;
  }
  if (activity.type === "soundChanged" && !activity.id.startsWith("sound:")) return false;
  if (activity.type === "cosmeticChanged" && !activity.id.startsWith("cosmetic:")) return false;
  return true;
}

function comparableBase(base: ProfileBaseV2) {
  return { ...base, migration: { ...base.migration, backupKey: null } };
}

function validTransferBase(base: ProfileBaseV2, legacyRaw: string | null) {
  if (base.migration.source === "fresh") {
    return legacyRaw === null && base.migration.sourceKey === null && base.migration.backupKey === null &&
      base.migration.status === "complete" && base.migration.excludedWins === 0 && base.legacy.guesses === 0 && base.legacy.wins.length === 0;
  }
  if (legacyRaw === null || base.migration.sourceKey !== LEGACY_PROFILE_KEY) return false;
  const expected = migrateLegacy(legacyRaw);
  return Boolean(expected && JSON.stringify(comparableBase(expected)) === JSON.stringify(comparableBase(base)) &&
    base.migration.backupKey === `${PROFILE_V1_BACKUP_PREFIX}${storageFingerprint(legacyRaw)}`);
}

function parseImportBundle(value: unknown, now = new Date()): ProfileImportBundle | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "transferVersion", "type", "base", "legacyRaw", "activities", "evidence"]) ||
      value.schemaVersion !== PROFILE_SCHEMA_VERSION || value.transferVersion !== PROFILE_TRANSFER_VERSION || value.type !== "profileImport" ||
      !Array.isArray(value.activities) || !Array.isArray(value.evidence) || value.activities.length + value.evidence.length > 50000 ||
      !(value.legacyRaw === null || typeof value.legacyRaw === "string")) return null;
  const base = parseBase(value.base);
  if (!base || !validTransferBase(base, value.legacyRaw as string | null)) return null;
  const activities = value.activities.map(parseActivity);
  if (activities.some(activity => !activity || !validImportedActivity(activity, now))) return null;
  const byId = new Map<string, ProfileActivity>();
  for (const activity of activities as ProfileActivity[]) {
    const existing = byId.get(activity.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(activity)) return null;
    byId.set(activity.id, activity);
  }
  const evidence = value.evidence.map(parseActivity);
  if (evidence.some(activity => !activity || activity.type !== "guessAccepted" && activity.type !== "puzzleWon" || !validImportedActivity(activity, now))) return null;
  const proof = new Map<string, GuessActivity | WinActivity>();
  for (const activity of evidence as Array<GuessActivity | WinActivity>) {
    const canonical = byId.get(activity.id);
    if (!canonical || canonical.type !== activity.type || canonical.type !== "guessAccepted" && canonical.type !== "puzzleWon" ||
        canonical.puzzleRef.id !== activity.puzzleRef.id) return null;
    proof.set(JSON.stringify(activity), activity);
  }
  const wins = [
    ...base.legacy.wins,
    ...[...byId.values()].flatMap(activity => activity.type === "puzzleWon" ? [activity.win] : []),
    ...[...proof.values()].flatMap(activity => activity.type === "puzzleWon" ? [activity.win] : []),
  ];
  const facts = [...byId.values(), ...proof.values()].filter(activity => activity.type !== "weeklyRewardEarned");
  const earnedRewards = new Set(projectWeeklyRitual(facts, wins, now).earnedRewardIds);
  if ([...byId.values()].some(activity => activity.type === "weeklyRewardEarned" && !earnedRewards.has(activity.rewardId))) return null;
  return { schemaVersion: PROFILE_SCHEMA_VERSION, transferVersion: PROFILE_TRANSFER_VERSION, type: "profileImport", base, legacyRaw: value.legacyRaw as string | null, activities: [...byId.values()], evidence: [...proof.values()] };
}

function encodedByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
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

function listImportBundles(storage: ProfileStorage, now = new Date()) {
  const bundles: ProfileImportBundle[] = [];
  let ignored = 0;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key?.startsWith(PROFILE_V2_IMPORT_PREFIX)));
    for (const key of keys.sort()) {
      const raw = storage.getItem(key);
      if (!raw || encodedByteLength(raw) > PROFILE_TRANSFER_MAX_BYTES || key !== `${PROFILE_V2_IMPORT_PREFIX}${storageFingerprint(raw)}`) { ignored += 1; continue; }
      let value: unknown;
      try { value = JSON.parse(raw); } catch { ignored += 1; continue; }
      const bundle = parseImportBundle(value, now);
      if (!bundle) { ignored += 1; continue; }
      bundles.push(bundle);
    }
    return { ok: true as const, bundles, ignored };
  } catch { return { ok: false as const, bundles: [], ignored: 0 }; }
}

function listActivities(storage: ProfileStorage) {
  const byId = new Map<string, ProfileActivity>();
  const evidence = new Map<string, ProfileActivity>();
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
          evidence.set(JSON.stringify(activity), activity);
          const existing = byId.get(activity.id);
          if (!existing) byId.set(activity.id, activity);
          else byId.set(activity.id, preferredActivity(existing, activity));
        }
      } catch { ignored += 1; }
    }
    const imports = listImportBundles(storage);
    if (!imports.ok) return { ok: false as const, activities: [], evidence: [], ignored: 0 };
    ignored += imports.ignored;
    for (const bundle of imports.bundles) {
      for (const activity of bundle.activities) {
        evidence.set(JSON.stringify(activity), activity);
        const existing = byId.get(activity.id);
        if (!existing) byId.set(activity.id, activity);
        else byId.set(activity.id, preferredActivity(existing, activity));
      }
      for (const activity of bundle.evidence) evidence.set(JSON.stringify(activity), activity);
    }
    return { ok: true as const, activities: [...byId.values()], evidence: [...evidence.values()], ignored };
  } catch { return { ok: false as const, activities: [], evidence: [], ignored: 0 }; }
}

function snapshotFrom(base: ProfileBaseV2, storage: ProfileStorage, status: ProfileLoadStatus, backupConfirmed: boolean, transferLegacyRaw: string | null = null): ProfileSnapshot {
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
    transferEvidence: listed.evidence,
    transferBase: base,
    transferLegacyRaw,
  };
}

function memorySnapshot(base: ProfileBaseV2, backupConfirmed: boolean, transferLegacyRaw: string | null = null): ProfileSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    profile: { wins: [...base.legacy.wins], guesses: base.legacy.guesses, sound: base.sound },
    backupConfirmed,
    transferBase: base,
    transferLegacyRaw,
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
  const transferEvidence = new Map(snapshot.transferEvidence.map(activity => [JSON.stringify(activity), activity]));
  for (const activity of activities) transferEvidence.set(JSON.stringify(activity), activity);
  return { ...snapshot, profile, status, persisted: false, eventCount: knownIds.size, activityIds: [...knownIds], activities: [...canonicalActivities.values()], pendingActivities: [...pending.values()], transferEvidence: [...transferEvidence.values()] };
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
  const imports = listImportBundles(storage);
  if (!imports.ok) return { ...EMPTY_SNAPSHOT, status: "memory-only" };
  if (!listed.candidates.length && !imports.bundles.length) return null;

  if (listed.candidates.length > 1) {
    let selected = listed.candidates[0];
    let selectedLegacyRaw: string | null = null;
    if (legacyRaw !== null) {
      for (const candidate of listed.candidates) {
        if (candidate.base.migration.source !== "legacy-v1" || !candidate.base.migration.backupKey) continue;
        const backup = read(storage, candidate.base.migration.backupKey);
        if (!backup.ok) return memorySnapshot(candidate.base, false);
        if (backup.value === legacyRaw) { selected = candidate; selectedLegacyRaw = backup.value; break; }
      }
    }
    if (selectedLegacyRaw === null && selected.base.migration.source === "legacy-v1" && selected.base.migration.backupKey) {
      const backup = read(storage, selected.base.migration.backupKey);
      if (!backup.ok) return memorySnapshot(selected.base, false);
      selectedLegacyRaw = backup.value;
    }
    return { ...memorySnapshot(selected.base, selectedLegacyRaw !== null, selectedLegacyRaw), status: "conflict" };
  }

  const importedHistorical = imports.bundles.filter(bundle => bundle.base.migration.source === "legacy-v1");
  const importedBoundaries = new Map(importedHistorical.map(bundle => [bundle.legacyRaw!, bundle]));
  const native = listed.candidates.length === 1 ? listed.candidates[0] : null;
  let nativeLegacyRaw: string | null = null;
  if (native?.base.migration.source === "legacy-v1") {
    const backupKey = native.base.migration.backupKey;
    const backup = backupKey ? read(storage, backupKey) : { ok: true as const, value: null };
    if (!backup.ok) return memorySnapshot(native.base, false);
    if (backup.value === null || !validTransferBase(native.base, backup.value)) {
      return { ...memorySnapshot(native.base, false), status: "conflict" };
    }
    nativeLegacyRaw = backup.value;
  }

  const imported = importedHistorical[0] ?? imports.bundles.find(bundle => bundle.base.migration.source === "fresh") ?? null;
  if (!native && legacyRaw !== null && importedHistorical.length === 0) return null;
  const selectedBase = nativeLegacyRaw !== null ? native!.base : importedHistorical[0]?.base ?? native?.base ?? imported?.base;
  if (!selectedBase) return null;
  const selectedLegacyRaw = nativeLegacyRaw ?? importedHistorical[0]?.legacyRaw ?? null;
  const conflict = listed.candidates.length > 1 || importedBoundaries.size > 1 ||
    Boolean(nativeLegacyRaw !== null && importedHistorical.some(bundle => bundle.legacyRaw !== nativeLegacyRaw)) ||
    Boolean(legacyRaw === null && nativeLegacyRaw !== null && !importedHistorical.some(bundle => bundle.legacyRaw === nativeLegacyRaw)) ||
    Boolean(legacyRaw !== null && selectedLegacyRaw !== null && legacyRaw !== selectedLegacyRaw) ||
    Boolean(legacyRaw !== null && selectedLegacyRaw === null);
  const backupConfirmed = selectedBase.migration.source === "legacy-v1" && selectedLegacyRaw !== null;
  if (conflict) return { ...memorySnapshot(selectedBase, backupConfirmed, selectedLegacyRaw), status: "conflict" };
  const status = imports.ignored > 0 || selectedBase.migration.status === "partial" ? "partial" : "ready";
  return snapshotFrom(selectedBase, storage, status, backupConfirmed, selectedLegacyRaw);
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
    return writeVerified(selected, PROFILE_V2_BASE_KEY, raw) ? snapshotFrom(base, selected, "ready", false, null) : EMPTY_SNAPSHOT;
  }
  const fingerprint = storageFingerprint(legacy.value);
  const backupKey = `${PROFILE_V1_BACKUP_PREFIX}${fingerprint}`;
  const baseKey = `${PROFILE_V2_BASE_PREFIX}${fingerprint}`;
  const priorBackup = read(selected, backupKey);
  if (!priorBackup.ok) return EMPTY_SNAPSHOT;
  if (priorBackup.value !== null && priorBackup.value !== legacy.value) return { ...EMPTY_SNAPSHOT, status: "conflict", backupConfirmed: true };
  const base = migrateLegacy(legacy.value);
  if (base) base.migration.backupKey = backupKey;
  if (priorBackup.value === null && !writeVerified(selected, backupKey, legacy.value)) return base ? memorySnapshot(base, false, legacy.value) : { ...EMPTY_SNAPSHOT, status: "corrupt" };
  if (!base) return { ...EMPTY_SNAPSHOT, status: "corrupt", backupConfirmed: true };
  const raw = JSON.stringify(base);
  const priorBase = read(selected, baseKey);
  if (!priorBase.ok) return memorySnapshot(base, true, legacy.value);
  if (priorBase.value !== null && priorBase.value !== raw) return { ...memorySnapshot(base, true, legacy.value), status: "conflict" };
  if (priorBase.value === null && !writeVerified(selected, baseKey, raw)) return memorySnapshot(base, true, legacy.value);
  return snapshotFrom(base, selected, base.migration.status === "partial" ? "partial" : "migrated", true, legacy.value);
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

function profileRecordKey(key: string) {
  return key === LEGACY_PROFILE_KEY || key.startsWith(PROFILE_V1_BACKUP_PREFIX) || key.startsWith(PROFILE_V2_BASE_PREFIX) ||
    key.startsWith(PROFILE_V2_EVENT_PREFIX) || key.startsWith(PROFILE_V2_BATCH_PREFIX) || key.startsWith(PROFILE_V2_IMPORT_PREFIX);
}

function transferSummary(base: ProfileBaseV2, activities: readonly ProfileActivity[]) {
  let guesses = base.legacy.guesses;
  let wins = [...base.legacy.wins];
  for (const activity of activities) {
    if (activity.type === "guessAccepted") guesses += 1;
    else if (activity.type === "puzzleWon") wins = stableWin(wins, activity.win);
  }
  return { guesses, wins: wins.length, activities: activities.length };
}

export function createLocalProfileExport(snapshot: ProfileSnapshot, exportedAt = new Date()) {
  if (!snapshot.transferBase || !Number.isFinite(exportedAt.getTime()) || snapshot.ignoredEvents > 0 ||
      ["corrupt", "unsupported", "conflict"].includes(snapshot.status)) {
    return { ok: false as const, reason: "La progression actuelle ne peut pas être exportée sans risquer d’omettre des données." };
  }
  const activities = [...new Map([...snapshot.activities, ...snapshot.pendingActivities].map(activity => [activity.id, activity])).values()]
    .sort((first, second) => first.id.localeCompare(second.id));
  const canonicalRaw = new Map(activities.map(activity => [activity.id, JSON.stringify(activity)]));
  const evidence = [...new Map(snapshot.transferEvidence.flatMap(activity => {
    if (activity.type !== "guessAccepted" && activity.type !== "puzzleWon") return [];
    const raw = JSON.stringify(activity);
    return canonicalRaw.get(activity.id) === raw ? [] : [[raw, activity] as const];
  })).values()].sort((first, second) => first.id.localeCompare(second.id) || first.occurredAt.localeCompare(second.occurredAt));
  if (activities.length + evidence.length > 50000) return { ok: false as const, reason: "La progression dépasse les 50 000 éléments acceptés par le format de transfert." };
  const envelope: ProfileTransferEnvelope = {
    format: "braise-personal-profile",
    exportVersion: PROFILE_TRANSFER_VERSION,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    provenance: "personal-local",
    exportedAt: exportedAt.toISOString(),
    sourceStatus: snapshot.status,
    scope: "profile-only",
    summary: transferSummary(snapshot.transferBase, activities),
    base: snapshot.transferBase,
    legacyRaw: snapshot.transferLegacyRaw,
    activities,
    evidence,
  };
  const text = `${JSON.stringify(envelope, null, 2)}\n`;
  if (encodedByteLength(text) > PROFILE_TRANSFER_MAX_BYTES) return { ok: false as const, reason: "La progression dépasse la taille maximale de 8 Mio pour cet export." };
  return { ok: true as const, text, filename: `braise-profil-${exportedAt.toISOString().slice(0, 10)}.json`, summary: envelope.summary };
}

function parseTransferEnvelope(text: string, now = new Date()) {
  if (encodedByteLength(text) > PROFILE_TRANSFER_MAX_BYTES) return { ok: false as const, status: "invalid" as const, reason: "Le fichier dépasse la taille maximale de 8 Mio." };
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { ok: false as const, status: "invalid" as const, reason: "Le fichier JSON est illisible." }; }
  if (isRecord(value) && value.format === "braise-personal-profile" && typeof value.exportVersion === "number" && value.exportVersion > PROFILE_TRANSFER_VERSION) {
    return { ok: false as const, status: "unsupported" as const, reason: "Cette sauvegarde utilise un format plus récent." };
  }
  if (!isRecord(value) || !exactKeys(value, ["format", "exportVersion", "profileSchemaVersion", "provenance", "exportedAt", "sourceStatus", "scope", "summary", "base", "legacyRaw", "activities", "evidence"]) ||
      value.format !== "braise-personal-profile" || value.exportVersion !== PROFILE_TRANSFER_VERSION || value.profileSchemaVersion !== PROFILE_SCHEMA_VERSION ||
      value.provenance !== "personal-local" || value.scope !== "profile-only" || !isIsoInstant(value.exportedAt) || Date.parse(value.exportedAt) > now.getTime() ||
      typeof value.sourceStatus !== "string" || !["ready", "migrated", "partial", "memory-only", "corrupt", "unsupported", "conflict"].includes(value.sourceStatus) ||
      !isRecord(value.summary) || !exactKeys(value.summary, ["guesses", "wins", "activities"]) || !Array.isArray(value.activities) || !Array.isArray(value.evidence)) {
    return { ok: false as const, status: "invalid" as const, reason: "Ce fichier n’est pas une sauvegarde Braise valide." };
  }
  if (typeof value.sourceStatus === "string" && ["corrupt", "unsupported", "conflict"].includes(value.sourceStatus)) {
    return { ok: false as const, status: "conflict" as const, reason: "Ce fichier est une copie de secours d’un profil en conflit et ne peut pas être fusionné automatiquement." };
  }
  const bundle = parseImportBundle({ schemaVersion: PROFILE_SCHEMA_VERSION, transferVersion: PROFILE_TRANSFER_VERSION, type: "profileImport", base: value.base, legacyRaw: value.legacyRaw, activities: value.activities, evidence: value.evidence }, now);
  if (!bundle) return { ok: false as const, status: "invalid" as const, reason: "La sauvegarde contient des données incohérentes ou datées dans le futur." };
  const summary = transferSummary(bundle.base, bundle.activities);
  if (!Number.isSafeInteger(value.summary.guesses) || !Number.isSafeInteger(value.summary.wins) || !Number.isSafeInteger(value.summary.activities) ||
      value.summary.guesses !== summary.guesses || value.summary.wins !== summary.wins || value.summary.activities !== summary.activities) {
    return { ok: false as const, status: "invalid" as const, reason: "Le résumé du fichier ne correspond pas à son contenu." };
  }
  return { ok: true as const, bundle };
}

function mergeActivities(...groups: readonly ProfileActivity[][]) {
  const merged = new Map<string, ProfileActivity>();
  for (const activity of groups.flat()) {
    const current = merged.get(activity.id);
    merged.set(activity.id, current ? preferredActivity(current, activity) : activity);
  }
  return [...merged.values()];
}

function readonlyDestination(storage: ProfileStorage, fallback?: ProfileSnapshot, now = new Date()) {
  const legacy = read(storage, LEGACY_PROFILE_KEY);
  const bases = listBaseCandidates(storage);
  const imports = listImportBundles(storage);
  const activities = listActivities(storage);
  if (!legacy.ok || !bases.ok || !imports.ok || !activities.ok) return { ok: false as const, reason: "Le stockage local est indisponible." };
  if (bases.candidates.length > 1 || imports.ignored > 0 || activities.ignored > 0) return { ok: false as const, reason: "La progression locale contient déjà un conflit ou une donnée illisible." };
  const native = bases.candidates[0] ?? null;
  let nativeLegacyRaw: string | null = null;
  if (native?.base.migration.source === "legacy-v1") {
    const backup = native.base.migration.backupKey ? read(storage, native.base.migration.backupKey) : { ok: true as const, value: null };
    if (!backup.ok || backup.value === null || !validTransferBase(native.base, backup.value)) return { ok: false as const, reason: "La copie de secours locale est indisponible ou incohérente." };
    nativeLegacyRaw = backup.value;
  }
  const importedHistorical = imports.bundles.filter(bundle => bundle.base.migration.source === "legacy-v1");
  const boundaries = new Set(importedHistorical.map(bundle => bundle.legacyRaw));
  if (boundaries.size > 1 || nativeLegacyRaw !== null && [...boundaries].some(raw => raw !== nativeLegacyRaw)) return { ok: false as const, reason: "Plusieurs historiques locaux incompatibles sont déjà présents." };
  let historical = nativeLegacyRaw !== null
    ? { base: native!.base, legacyRaw: nativeLegacyRaw }
    : importedHistorical[0]
      ? { base: importedHistorical[0].base, legacyRaw: importedHistorical[0].legacyRaw }
      : null;
  if (nativeLegacyRaw !== null && legacy.value !== nativeLegacyRaw) return { ok: false as const, reason: "La source V1 locale ne correspond pas à sa copie de secours." };
  if (legacy.value !== null) {
    if (native?.base.migration.source === "fresh") return { ok: false as const, reason: "Une ancienne progression V1 est apparue après l’initialisation du profil." };
    if (historical && legacy.value !== historical.legacyRaw) return { ok: false as const, reason: "La source V1 locale ne correspond pas à sa frontière de migration." };
    if (!historical) {
      const migrated = migrateLegacy(legacy.value);
      if (!migrated) return { ok: false as const, reason: "La source V1 locale est illisible." };
      migrated.migration.backupKey = `${PROFILE_V1_BACKUP_PREFIX}${storageFingerprint(legacy.value)}`;
      historical = { base: migrated, legacyRaw: legacy.value };
    }
  }
  if (!historical && fallback?.transferBase?.migration.source === "legacy-v1" && fallback.transferLegacyRaw !== null) {
    if (!validTransferBase(fallback.transferBase, fallback.transferLegacyRaw)) return { ok: false as const, reason: "La frontière V1 gardée en mémoire est incohérente." };
    historical = { base: fallback.transferBase, legacyRaw: fallback.transferLegacyRaw };
  }
  if (fallback?.transferLegacyRaw !== null && fallback?.transferLegacyRaw !== undefined && historical && fallback.transferLegacyRaw !== historical.legacyRaw) {
    return { ok: false as const, reason: "La progression gardée en mémoire repose sur un autre historique V1." };
  }
  const pending = fallback?.pendingActivities ?? [];
  if (pending.some(activity => !validImportedActivity(activity, now))) return { ok: false as const, reason: "La progression gardée en mémoire contient une donnée invalide." };
  const destinationActivities = mergeActivities(activities.activities, pending);
  let revision = "";
  try {
    const records: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !profileRecordKey(key)) continue;
      const raw = storage.getItem(key);
      if (raw === null) return { ok: false as const, reason: "La progression locale a changé pendant sa lecture." };
      records.push(`${key}\u0000${raw}`);
    }
    const pendingRevision = pending.slice().sort((first, second) => first.id.localeCompare(second.id));
    revision = storageFingerprint(`${records.sort().join("\u0001")}\u0002${JSON.stringify(pendingRevision)}`);
  } catch { return { ok: false as const, reason: "Le stockage local est indisponible." }; }
  return { ok: true as const, historical, native, activities: destinationActivities, revision };
}

function inspectTransfer(text: string, storage: ProfileStorage, now = new Date(), fallback?: ProfileSnapshot) {
  const parsed = parseTransferEnvelope(text, now);
  if (!parsed.ok) return { ...parsed, planId: null, addedActivities: 0, existingActivities: 0, reconciledActivities: 0, bundle: null, target: null };
  const local = readonlyDestination(storage, fallback, now);
  if (!local.ok) return { ok: false as const, status: "conflict" as const, reason: local.reason, planId: null, addedActivities: 0, existingActivities: 0, reconciledActivities: 0, bundle: null, target: null };
  const sourceHistorical = parsed.bundle.base.migration.source === "legacy-v1" ? parsed.bundle.legacyRaw : null;
  if (sourceHistorical !== null && local.historical && sourceHistorical !== local.historical.legacyRaw) {
    return { ok: false as const, status: "conflict" as const, reason: "Cette sauvegarde et votre progression locale reposent sur deux historiques V1 différents.", planId: null, addedActivities: 0, existingActivities: 0, reconciledActivities: 0, bundle: null, target: null };
  }
  const target = local.historical ?? (sourceHistorical !== null ? { base: parsed.bundle.base, legacyRaw: sourceHistorical } : { base: local.native?.base ?? parsed.bundle.base, legacyRaw: null });
  const currentById = new Map(local.activities.map(activity => [activity.id, activity]));
  let addedActivities = 0; let existingActivities = 0; let reconciledActivities = 0;
  for (const activity of parsed.bundle.activities) {
    const current = currentById.get(activity.id);
    if (!current) addedActivities += 1;
    else if (JSON.stringify(current) === JSON.stringify(activity)) existingActivities += 1;
    else reconciledActivities += 1;
  }
  const planId = storageFingerprint(`${text}\u0000${local.revision}`);
  const status: "ready" | "unchanged" = addedActivities || reconciledActivities || sourceHistorical !== null && !local.historical ? "ready" : "unchanged";
  const reason = status === "ready" ? "Le fichier est valide. Rien n’a encore été modifié." : "Cette progression est déjà présente. Aucun changement n’est nécessaire.";
  return { ok: true as const, status, reason, planId, addedActivities, existingActivities, reconciledActivities, bundle: parsed.bundle, target };
}

export function inspectLocalProfileImport(text: string, storage?: ProfileStorage, now = new Date(), fallback?: ProfileSnapshot): ProfileImportPreview {
  const selected = storage ?? browserStorage();
  if (!selected) return { status: "unavailable", reason: "Le stockage local est indisponible.", planId: null, addedActivities: 0, existingActivities: 0, reconciledActivities: 0 };
  const preview = inspectTransfer(text, selected, now, fallback);
  return { status: preview.status, reason: preview.reason, planId: preview.planId, addedActivities: preview.addedActivities, existingActivities: preview.existingActivities, reconciledActivities: preview.reconciledActivities };
}

export function importLocalProfile(text: string, expectedPlanId: string, storage?: ProfileStorage, fallback?: ProfileSnapshot, now = new Date()): ProfileImportResult {
  const selected = storage ?? browserStorage();
  if (!selected) return { status: "unavailable", reason: "Le stockage local est indisponible.", planId: null, addedActivities: 0, existingActivities: 0, reconciledActivities: 0, snapshot: fallback ?? null, persisted: false };
  const preview = inspectTransfer(text, selected, now, fallback);
  const publicPreview: ProfileImportPreview = { status: preview.status, reason: preview.reason, planId: preview.planId, addedActivities: preview.addedActivities, existingActivities: preview.existingActivities, reconciledActivities: preview.reconciledActivities };
  if (!preview.ok || !preview.bundle || !preview.target) return { ...publicPreview, snapshot: fallback ?? null, persisted: false };
  if (preview.planId !== expectedPlanId) return { ...publicPreview, status: "stale", reason: "Votre progression a changé depuis la vérification. Vérifiez le nouveau résumé avant de confirmer.", snapshot: fallback ?? null, persisted: false };
  if (preview.status === "unchanged" && !fallback?.pendingActivities.length) return { ...publicPreview, snapshot: loadLocalProfile(selected), persisted: true };
  const activities = fallback?.pendingActivities.length
    ? mergeActivities(preview.bundle.activities, fallback.activities, fallback.pendingActivities)
    : preview.bundle.activities;
  const canonicalRaw = new Map(activities.map(activity => [activity.id, JSON.stringify(activity)]));
  const evidenceCandidates = fallback?.pendingActivities.length
    ? [...preview.bundle.activities, ...preview.bundle.evidence, ...fallback.transferEvidence]
    : preview.bundle.evidence;
  const evidence = [...new Map(evidenceCandidates.flatMap(activity => {
    if (activity.type !== "guessAccepted" && activity.type !== "puzzleWon") return [];
    const raw = JSON.stringify(activity);
    return canonicalRaw.get(activity.id) === raw ? [] : [[raw, activity] as const];
  })).values()];
  const bundle: ProfileImportBundle = { schemaVersion: PROFILE_SCHEMA_VERSION, transferVersion: PROFILE_TRANSFER_VERSION, type: "profileImport", base: preview.target.base, legacyRaw: preview.target.legacyRaw, activities, evidence };
  if (!parseImportBundle(bundle, now)) return { ...publicPreview, status: "conflict", reason: "La progression gardée en mémoire ne peut pas être fusionnée sans risque.", snapshot: fallback ?? null, persisted: false };
  const raw = JSON.stringify(bundle);
  if (encodedByteLength(raw) > PROFILE_TRANSFER_MAX_BYTES) {
    return { ...publicPreview, status: "unavailable", reason: "La progression fusionnée dépasse la taille maximale de 8 Mio. Votre progression précédente est conservée.", snapshot: fallback ?? null, persisted: false };
  }
  const key = `${PROFILE_V2_IMPORT_PREFIX}${storageFingerprint(raw)}`;
  const existing = read(selected, key);
  if (!existing.ok || existing.value !== null && existing.value !== raw || existing.value === null && !writeVerified(selected, key, raw)) {
    return { ...publicPreview, status: "unavailable", reason: "L’import n’a pas pu être enregistré. Votre progression précédente est conservée.", snapshot: fallback ?? null, persisted: false };
  }
  const snapshot = loadLocalProfile(selected);
  if (!snapshot.persisted || snapshot.ignoredEvents > 0 || ["corrupt", "unsupported", "conflict"].includes(snapshot.status)) {
    return { ...publicPreview, status: "conflict", reason: "Le fichier a été conservé, mais la progression fusionnée reste en conflit.", snapshot, persisted: false };
  }
  return { ...publicPreview, status: "ready", reason: "Import terminé. Votre progression locale a été fusionnée sans supprimer les éléments déjà présents.", snapshot, persisted: true };
}

export function isProfileStorageKey(key: string | null) {
  return key === null || key === LEGACY_PROFILE_KEY || Boolean(key.startsWith(PROFILE_V2_BASE_PREFIX)) || Boolean(key.startsWith(PROFILE_V1_BACKUP_PREFIX)) || Boolean(key.startsWith(PROFILE_V2_EVENT_PREFIX)) || Boolean(key.startsWith(PROFILE_V2_BATCH_PREFIX)) || Boolean(key.startsWith(PROFILE_V2_IMPORT_PREFIX));
}
