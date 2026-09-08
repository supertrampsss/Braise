import type { Profile, SavedGame } from "./game-types";

export const LEGACY_STORAGE_PREFIX = "braise.v1.";
export const EMPTY_PROFILE: Profile = { wins: [], guesses: 0, sound: false };
export const EMPTY_GAME: SavedGame = { guesses: [], pins: [], hints: 0, startedAt: 0 };
export type LocalReader = Pick<Storage, "getItem">;
export type LocalWriter = Pick<Storage, "setItem">;

// Preserve the original V1 acceptance rules; stricter migration belongs to B4.
export function validLegacyGame(value: unknown): value is SavedGame {
  const game = value as SavedGame | null;
  return Boolean(game && Array.isArray(game.guesses) && game.guesses.every(g => g && typeof g.word === "string" && Number.isFinite(g.temperature) && Number.isFinite(g.rank) && Number.isInteger(g.order) && typeof g.found === "boolean") && Array.isArray(game.pins) && game.pins.length <= 3 && game.pins.every(p => typeof p === "string") && Number.isInteger(game.hints) && game.hints >= 0 && game.hints <= 3);
}

export function validLegacyProfile(value: unknown): value is Profile {
  const profile = value as Profile | null;
  return Boolean(profile && Array.isArray(profile.wins) && profile.wins.every(w => w && typeof w.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && ["daily", "free", "challenge"].includes(w.mode) && Number.isInteger(w.tries) && Number.isInteger(w.hints)) && Number.isFinite(profile.guesses) && profile.guesses >= 0 && typeof profile.sound === "boolean");
}

export function readLocal<T>(key: string, fallback: T, storage?: LocalReader): T {
  try { const value = (storage ?? localStorage).getItem(LEGACY_STORAGE_PREFIX + key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}

export function writeLocal(key: string, value: unknown, storage?: LocalWriter) {
  try { (storage ?? localStorage).setItem(LEGACY_STORAGE_PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function restoreLegacyGame(puzzleId: string, now = Date.now(), storage?: LocalReader): SavedGame {
  const stored = readLocal<unknown>(`game.${puzzleId}`, EMPTY_GAME, storage);
  if (!validLegacyGame(stored)) return { ...EMPTY_GAME, startedAt: now };
  const marker = Number.isSafeInteger(stored.profileV2StartIndex) && Number(stored.profileV2StartIndex) >= 0 && Number(stored.profileV2StartIndex) <= stored.guesses.length ? stored.profileV2StartIndex : undefined;
  const completedMode = typeof stored.completedMode === "string" && ["daily", "archive", "free", "challenge"].includes(stored.completedMode) ? stored.completedMode : undefined;
  const restored = { ...stored, startedAt: stored.startedAt || now };
  if (marker === undefined) delete restored.profileV2StartIndex;
  else restored.profileV2StartIndex = marker;
  if (completedMode === undefined) delete restored.completedMode;
  else restored.completedMode = completedMode;
  return restored;
}

export function restoreLegacyProfile(storage?: LocalReader): Profile {
  const stored = readLocal<unknown>("profile", EMPTY_PROFILE, storage);
  return validLegacyProfile(stored) ? stored : EMPTY_PROFILE;
}
