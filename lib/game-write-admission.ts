import { LEGACY_STORAGE_PREFIX, validLegacyGame, writeLocal, type LocalReader, type LocalWriter } from './legacy-storage';
import { recordLocalGameProgress, type ProfileStorage, type ProfileSnapshot } from './profile-storage';
import type { Puzzle, SavedGame } from './game-types';
import { dailyV2Date, isDailyV2Ref } from './daily-v2-contract';
import { dailyV2Document, parseDailyV2Document } from './daily-v2-storage';
import { isWord2vecId, isWord2vecRef } from './word2vec-contract';
import { word2vecDocument, parseWord2vecDocument } from './word2vec-storage';
/** Write admission only. The intentionally permissive historical reader stays unchanged. */
export function canWriteGameDocument(storage: LocalReader | undefined, id: string): boolean {
  try {
    if((id.startsWith('daily-w2v-')||id.startsWith('free-w2v-'))&&!isWord2vecId(id))return false;
    if (id.startsWith('daily-v2-') && !dailyV2Date(id)) return false;
    const raw=(storage ?? localStorage).getItem(`${LEGACY_STORAGE_PREFIX}game.${id}`);
    if(raw===null) return true;
    const value=JSON.parse(raw);
    if(isWord2vecId(id))return parseWord2vecDocument(value,id)!==null;
    if (id.startsWith('daily-v2-')) return parseDailyV2Document(value,id) !== null;
    return validLegacyGame(value) && ['version','schemaVersion','formatVersion'].every(key=>!Object.hasOwn(value,key) || (value as unknown as Record<string,unknown>)[key]===1);
  } catch { return false; }
}
export function writeAdmittedGame(storage: (LocalReader & LocalWriter) | undefined, id: string, game: SavedGame) {
  try { return canWriteGameDocument(storage,id) && writeLocal(`game.${id}`,isWord2vecId(id)?word2vecDocument(id,game):id.startsWith('daily-v2-') ? dailyV2Document(id,game) : game,storage); }
  catch { return false; }
}

/** Also block the indirect profile/reward projection of an incompatible game document. */
export function recordAdmittedGameProgress(puzzle: Puzzle, game: SavedGame, storage?: ProfileStorage, fallback?: ProfileSnapshot) {
  if(puzzle.ref.id!==puzzle.id||puzzle.ref.rulesVersion==='word2vec-v1'&&!isWord2vecId(puzzle.id))return null;
  if(isWord2vecId(puzzle.id)&&(!isWord2vecRef(puzzle.ref)||puzzle.ref.id!==puzzle.id||!parseWord2vecDocument({schemaVersion:3,puzzleRef:puzzle.ref,game},puzzle.id)))return null;
  if (puzzle.id.startsWith('daily-v2-') && (!isDailyV2Ref(puzzle.ref) || puzzle.ref.id !== puzzle.id)) return null;
  return canWriteGameDocument(storage,puzzle.id) ? recordLocalGameProgress(puzzle,game,storage,fallback) : null;
}
