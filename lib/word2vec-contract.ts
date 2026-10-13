// Public identities only. No vocabulary, answers or score columns in client imports.
import { isCalendarDate, parisDate } from './calendar';
import type { PuzzleRef } from './game-contracts';
import type { Mode } from './game-types';
export const WORD2VEC_START = '2026-10-13';
export const WORD2VEC_CORPUS = 'frwac-word2vec-155562-d617b3a27db2-v1';
export const WORD2VEC_RULES = 'word2vec-v1';
export const WORD2VEC_CALENDAR = 'paris-daily-word2vec-v1';
export const WORD2VEC_SIZE = 155562;
export type Word2vecRef = PuzzleRef & {corpusVersion:typeof WORD2VEC_CORPUS;rulesVersion:typeof WORD2VEC_RULES;context:Mode};
export type ClassicEdition = 'classic-v1'|'classic-v2'|typeof WORD2VEC_RULES;
export function classicEdition(value: unknown): ClassicEdition | undefined { return value==='classic-v1'||value==='classic-v2'||value===WORD2VEC_RULES?value:undefined; }
export function word2vecDate(id: string) { const date=id.startsWith('daily-w2v-')?id.slice(10):'';return isCalendarDate(date)&&date>=WORD2VEC_START?date:null; }
export function word2vecSeed(id: string) { const seed=id.startsWith('free-w2v-')?id.slice(9):'';return /^\d{1,10}$/.test(seed)&&Number(seed)<=2147483647?seed:null; }
export function isWord2vecId(id: string) { return word2vecDate(id)!==null||word2vecSeed(id)!==null; }
export function word2vecRef(id: string, context: Mode): PuzzleRef {
  const date=word2vecDate(id),seed=word2vecSeed(id);
  if(date?!['daily','archive'].includes(context):seed===null||!['free','challenge'].includes(context)) throw new Error('word2vec-identity');
  return {contractVersion:1,id,corpusVersion:WORD2VEC_CORPUS,rulesVersion:WORD2VEC_RULES,context,variant:'classic',calendar:date?{version:WORD2VEC_CALENDAR,date}:null};
}
export function isWord2vecRef(value: unknown, now?: Date): value is Word2vecRef {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const ref=value as PuzzleRef;
  if(Object.keys(ref).sort().join(',')!=='calendar,context,contractVersion,corpusVersion,id,rulesVersion,variant'||typeof ref.id!=='string'||ref.contractVersion!==1||ref.corpusVersion!==WORD2VEC_CORPUS||ref.rulesVersion!==WORD2VEC_RULES||ref.variant!=='classic')return false;
  const date=word2vecDate(ref.id);
  if(date)return ['daily','archive'].includes(ref.context)&&!!ref.calendar&&Object.keys(ref.calendar).sort().join(',')==='date,version'&&ref.calendar.version===WORD2VEC_CALENDAR&&ref.calendar.date===date&&(!now||date<=parisDate(now));
  return word2vecSeed(ref.id)!==null&&['free','challenge'].includes(ref.context)&&ref.calendar===null&&(!now||parisDate(now)>=WORD2VEC_START);
}
export function classicDailyIdentity(date:string,edition?:ClassicEdition){return `${edition==='classic-v2'?'daily-v2-':edition==='classic-v1'||date<WORD2VEC_START?'daily-':'daily-w2v-'}${date}`;}
export function classicFreeIdentity(seed:string,edition?:ClassicEdition){return `${edition==='classic-v1'?'free-':'free-w2v-'}${seed}`;}
