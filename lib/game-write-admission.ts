import { LEGACY_STORAGE_PREFIX, validLegacyGame, writeLocal, type LocalReader, type LocalWriter } from './legacy-storage';
import { recordLocalGameProgress, type ProfileStorage, type ProfileSnapshot } from './profile-storage';
import type { Puzzle, SavedGame } from './game-types';
/** Write admission only. The intentionally permissive historical reader stays unchanged. */
export function canWriteGameDocument(storage: LocalReader | undefined, id: string): boolean {
  try {
    const raw=(storage ?? localStorage).getItem(`${LEGACY_STORAGE_PREFIX}game.${id}`);
    if(raw===null) return true;
    const value=JSON.parse(raw);
    return validLegacyGame(value) && ['version','schemaVersion','formatVersion'].every(key=>!Object.hasOwn(value,key) || (value as unknown as Record<string,unknown>)[key]===1);
  } catch { return false; }
}
export function writeAdmittedGame(storage: (LocalReader & LocalWriter) | undefined, id: string, game: SavedGame) {
  return canWriteGameDocument(storage,id) && writeLocal(`game.${id}`,game,storage);
}

/** Also block the indirect profile/reward projection of an incompatible game document. */
export function recordAdmittedGameProgress(puzzle: Puzzle, game: SavedGame, storage?: ProfileStorage, fallback?: ProfileSnapshot) {
  return canWriteGameDocument(storage,puzzle.id) ? recordLocalGameProgress(puzzle,game,storage,fallback) : null;
}
