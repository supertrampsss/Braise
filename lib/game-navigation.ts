import type { ExpeditionStatus } from './expeditions';
import type { Mode, Puzzle, SavedGame } from './game-types';
import { classicDailyIdentity, classicFreeIdentity, classicEdition, isWord2vecRef, WORD2VEC_SIZE, type ClassicEdition } from './word2vec-contract';
import { DAILY_V2_DICTIONARY_SIZE, isDailyV2Ref } from './daily-v2-contract';
import { LEGACY_VERSIONS, samePuzzleRef } from './game-contracts';
export type GameSurface = 'home' | 'game' | 'modes' | 'voyage' | 'profile';
export type PuzzleLoad = { mode: Mode; locator: string; sessionSave?: SavedGame; expedition?: ExpeditionStatus; collection?: string; destination?: GameSurface; edition?: ClassicEdition };
/** Admit identity and locator before any restore or browser write. */
export function classicPuzzleMatchesLoad(puzzle: Puzzle, load: PuzzleLoad) {
  const edition=classicEdition(puzzle.ref?.rulesVersion);
  if(!edition||load.edition&&edition!==load.edition||puzzle.mode!==load.mode||puzzle.ref.id!==puzzle.id)return false;
  const daily=load.mode==='daily'||load.mode==='archive';
  if(daily?load.mode==='archive'&&puzzle.date!==load.locator:puzzle.seed!==load.locator)return false;
  if(puzzle.id!==(daily?classicDailyIdentity(puzzle.date,edition):classicFreeIdentity(load.locator,edition)))return false;
  if(edition==='word2vec-v1')return isWord2vecRef(puzzle.ref)&&puzzle.ref.context===load.mode&&puzzle.vocabularySize===WORD2VEC_SIZE;
  if(edition==='classic-v2')return isDailyV2Ref(puzzle.ref)&&puzzle.ref.context===load.mode&&puzzle.vocabularySize===DAILY_V2_DICTIONARY_SIZE;
  return puzzle.vocabularySize===30000&&samePuzzleRef(puzzle.ref,{contractVersion:1,id:puzzle.id,corpusVersion:LEGACY_VERSIONS.corpus,rulesVersion:LEGACY_VERSIONS.rules,context:load.mode,variant:'classic',calendar:daily?{version:LEGACY_VERSIONS.calendar,date:puzzle.date}:null});
}
export function requestedGameSurface(url: URL): GameSurface {
  return url.searchParams.get('surface')==='profile' ? 'profile' : url.searchParams.get('surface')==='explore' ? 'modes' : url.searchParams.get('surface')==='voyage' ? 'voyage' : 'game';
}
export function surfaceUrl(current: URL, destination: GameSurface) {
  const url=new URL(current);
  if(destination==='game') url.searchParams.delete('surface');
  else url.searchParams.set('surface',destination==='profile'?'profile':destination==='voyage'?'voyage':'explore');
  return url;
}
export function admittedPuzzleUrl(current: URL, load: PuzzleLoad, puzzle: Pick<Puzzle,'seed'|'date'> & {ref?:Puzzle['ref']}) {
  const url=load.destination ? surfaceUrl(current,load.destination) : new URL(current);
  const values:Record<string,string|undefined>={edition:puzzle.ref?.rulesVersion??load.edition,voyage:load.expedition?.id,libre:load.mode==='free'?puzzle.seed:undefined,collection:load.collection,defi:load.mode==='challenge'?puzzle.seed:undefined,archive:load.mode==='archive'?puzzle.date:undefined};
  for(const [key,value] of Object.entries(values)) {if(value!==undefined) url.searchParams.set(key,value);else url.searchParams.delete(key);}
  return url;
}
/** A retry replays every part of the descriptor; no context is inferred from the current view. */
export function retryPuzzleLoad<T>(load: PuzzleLoad, loader: (mode:Mode,locator:string,save?:SavedGame,expedition?:ExpeditionStatus,collection?:string,destination?:GameSurface,edition?:ClassicEdition)=>Promise<T>, destination = load.destination) {
  return loader(load.mode,load.locator,load.sessionSave,load.expedition,load.collection,destination,load.edition);
}
export type PuzzleLoadGeneration = { request: number; navigation: number };
export type PuzzleLoadGuard = { started: PuzzleLoadGeneration; current: () => PuzzleLoadGeneration };
/** The same admission rule governs success and failure for every mode and destination. */
export function isPuzzleLoadCurrent(guard: PuzzleLoadGuard) {
  const current=guard.current();
  return guard.started.request===current.request && guard.started.navigation===current.navigation;
}
/** Failure routes use the requested locator, without inventing a puzzle or losing its context. */
export function failedPuzzleUrl(current: URL, load: PuzzleLoad) {
  return admittedPuzzleUrl(current,load,{seed:load.locator,date:load.locator});
}
/** null = obsolete, false = admitted failure; neither is an accepted puzzle. */
export async function admitPuzzleLoad<T>(load: PuzzleLoad, read: ()=>Promise<T>, guard: PuzzleLoadGuard, commit: (value:T,descriptor:PuzzleLoad)=>void, reject?: (cause:unknown,descriptor:PuzzleLoad)=>void):Promise<T|null|false> {
  try {
    const value=await read();
    if(!isPuzzleLoadCurrent(guard)) return null;
    commit(value,load);return value;
  } catch(cause) {
    if(!isPuzzleLoadCurrent(guard)) return null;
    if(!reject) throw cause;
    reject(cause,load);return false;
  }
}
