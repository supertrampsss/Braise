// Unified public-day dispatch. All non-calendar allocations keep their V1 resolver.
import { DAILY_V2_START } from './daily-v2-contract';
import { parisDate } from './calendar';
import { openDailyV2, type DailyV2Authority, type DailyV2Runtime } from './daily-v2.server';
import authority from '@/data/editorial-v2-runtime.json';
import { DAILY_V2_QUALIFICATION_PIN } from './daily-v2-pin';
import { evaluateWord, findWord, getArchivePuzzle, getPuzzle, legacyTargetWord, nextHint } from './semantic';
import { legacyEncounterIdentityForWord, withTargetIdentity } from './free-discovery.server';
import type { Mode } from './game-types';
export async function resolveClassicGame(mode: Mode, seed: string, date: string | undefined, now: Date, runtime: DailyV2Runtime, signal?: AbortSignal) {
  const day = mode === 'archive' ? date! : parisDate(now);
  if ((mode === 'daily' || mode === 'archive') && day >= DAILY_V2_START) {
    const value = await openDailyV2(authority as DailyV2Authority,DAILY_V2_QUALIFICATION_PIN,runtime,day,mode,now,signal);
    return { ...value, targetIdentity:await legacyEncounterIdentityForWord(value.targetWord),requiresVersion:true };
  }
  const value = mode === 'archive' ? getArchivePuzzle(day,now) : getPuzzle(mode,seed,now);
  const publicPuzzle = await withTargetIdentity(value.publicPuzzle);
  return { publicPuzzle,targetWord:legacyTargetWord(value.targetIndex),targetIdentity:publicPuzzle.targetIdentity,requiresVersion:false,
    async evaluate(word: string) { const id=findWord(word);return id===undefined?null:evaluateWord(value.targetIndex,id); },
    hint: (level:number,guesses:string[])=>nextHint(value.targetIndex,level,guesses,mode==='daily'?value.publicPuzzle.date:undefined),
    close() {},
  };
}
