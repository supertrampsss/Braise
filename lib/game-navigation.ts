import type { ExpeditionStatus } from './expeditions';
import type { Mode, Puzzle, SavedGame } from './game-types';
export type GameSurface = 'home' | 'game' | 'modes' | 'voyage' | 'profile';
export type PuzzleLoad = { mode: Mode; locator: string; sessionSave?: SavedGame; expedition?: ExpeditionStatus; collection?: string; destination?: GameSurface };
export function requestedGameSurface(url: URL): GameSurface {
  return url.searchParams.get('surface')==='profile' ? 'profile' : url.searchParams.get('surface')==='explore' ? 'modes' : url.searchParams.get('surface')==='voyage' ? 'voyage' : 'game';
}
export function surfaceUrl(current: URL, destination: GameSurface) {
  const url=new URL(current);
  if(destination==='game') url.searchParams.delete('surface');
  else url.searchParams.set('surface',destination==='profile'?'profile':destination==='voyage'?'voyage':'explore');
  return url;
}
export function admittedPuzzleUrl(current: URL, load: PuzzleLoad, puzzle: Puzzle) {
  const url=load.destination ? surfaceUrl(current,load.destination) : new URL(current);
  const values:Record<string,string|undefined>={voyage:load.expedition?.id,libre:load.mode==='free'?puzzle.seed:undefined,collection:load.collection,defi:load.mode==='challenge'?puzzle.seed:undefined,archive:load.mode==='archive'?puzzle.date:undefined};
  for(const [key,value] of Object.entries(values)) {if(value!==undefined) url.searchParams.set(key,value);else url.searchParams.delete(key);}
  return url;
}
/** A retry replays every part of the descriptor; no context is inferred from the current view. */
export function retryPuzzleLoad<T>(load: PuzzleLoad, loader: (mode:Mode,locator:string,save?:SavedGame,expedition?:ExpeditionStatus,collection?:string,destination?:GameSurface)=>Promise<T>, destination = load.destination) {
  return loader(load.mode,load.locator,load.sessionSave,load.expedition,load.collection,destination);
}
/** Check after every async boundary, before both game state and route are committed. */
export async function admitPuzzleLoad<T>(load: PuzzleLoad, read: ()=>Promise<T>, isCurrent: ()=>boolean, commit: (value:T,descriptor:PuzzleLoad)=>void):Promise<T|null> {
  const value=await read();
  if(!isCurrent()) return null;
  commit(value,load);return value;
}
