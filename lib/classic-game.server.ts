// New classic boards use Word2Vec; explicit historical editions keep their own reader.
import { DAILY_V2_START } from './daily-v2-contract';
import { parisDate } from './calendar';
import { openDailyV2, type DailyV2Authority, type DailyV2Runtime } from './daily-v2.server';
import authority from '@/data/editorial-v2-runtime.json';
import { DAILY_V2_QUALIFICATION_PIN } from './daily-v2-pin';
import { betterClassicHint, evaluateWord, findWord, getArchivePuzzle, getPuzzle, legacyTargetWord } from './semantic';
import { encounterIdentityForWord, legacyEncounterIdentityForWord, withTargetIdentity } from './free-discovery.server';
import type { Mode } from './game-types';
import { WORD2VEC_START, classicEdition } from './word2vec-contract';
import { openWord2vec } from './word2vec-game.server';
export class ClassicEditionConflict extends Error { constructor(){super('classic-edition-invalid');} }
export async function resolveClassicGame(mode: Mode, seed: string, date: string | undefined, now: Date, runtime: DailyV2Runtime, signal?: AbortSignal, requestedEdition?: unknown) {
  const day = mode === 'archive' ? date! : parisDate(now);
  const edition=classicEdition(typeof requestedEdition==='object'&&requestedEdition!==null ? (requestedEdition as {rulesVersion?:unknown}).rulesVersion:requestedEdition);
  if(requestedEdition!==undefined&&!edition)throw new ClassicEditionConflict();
  if(edition==='word2vec-v1'||!edition&&day>=WORD2VEC_START){
    if(day<WORD2VEC_START)throw new ClassicEditionConflict();
    const value=await openWord2vec(mode,seed,day,now);
    return {...value,targetIdentity:await encounterIdentityForWord(value.targetWord)};
  }
  if (edition==='classic-v2' && (mode === 'daily' || mode === 'archive') && day >= DAILY_V2_START) {
    const value = await openDailyV2(authority as DailyV2Authority,DAILY_V2_QUALIFICATION_PIN,runtime,day,mode,now,signal);
    return { ...value, targetIdentity:await legacyEncounterIdentityForWord(value.targetWord),requiresVersion:true,hint:async(_level:number,_guesses:string[],_bestWord?:string)=>null };
  }
  if(edition==='classic-v2')throw new ClassicEditionConflict();
  const value = mode === 'archive' ? getArchivePuzzle(day,now) : getPuzzle(mode,seed,now);
  const publicPuzzle = await withTargetIdentity(value.publicPuzzle);
  return { publicPuzzle,targetWord:legacyTargetWord(value.targetIndex),targetIdentity:publicPuzzle.targetIdentity,requiresVersion:false,
    async evaluate(word: string) { const id=findWord(word);return id===undefined?null:evaluateWord(value.targetIndex,id); },
    hint:(level:number,guesses:string[],_bestWord?:string)=>betterClassicHint(value.targetIndex,level,guesses),
    close() {},
  };
}
