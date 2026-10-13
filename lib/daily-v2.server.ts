// Server-only. Authority contains solutions and must never enter a client graph.
import { nextParisMidnight, parisDate } from './calendar';
import { DAILY_V2_CALENDAR, DAILY_V2_CORPUS, DAILY_V2_DICTIONARY_SIZE, DAILY_V2_START, DAILY_V2_END, dailyV2Ref, isDailyV2Date } from './daily-v2-contract';
import type { EditorialCalendar } from './editorial-calendar';
import type { Puzzle } from './game-types';
import { boundedRangeBucket } from './semantic-v2-bounded-r2';
import { pinnedRangeR2Loader, type RangeBlob, type RangeBucket } from './semantic-v2-range-r2';
import { SemanticV2Reader, type V2Pins } from './semantic-v2-reader';
export type DailyV2Authority = { schemaVersion: 1; calendar: EditorialCalendar; rootReference: RangeBlob; pins: V2Pins; entries: Array<{ targetId: number; word: string; hints: Array<{ id: number; word: string }> }> };
export type DailyV2Runtime = { qualificationPin?: string; bucket?: RangeBucket };
export class DailyV2Unavailable extends Error { constructor() { super('daily-v2-unavailable'); } }
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');

export async function openDailyV2(authority: DailyV2Authority, pin: string, runtime: DailyV2Runtime, date: string, context: 'daily' | 'archive', now = new Date(), signal?: AbortSignal) {
  const unavailable = () => { throw new DailyV2Unavailable(); };
  if (!/^[a-f0-9]{64}$/.test(pin) || runtime.qualificationPin !== pin || !runtime.bucket || signal?.aborted ||
      !isDailyV2Date(date) || (context === 'daily' ? date !== parisDate(now) : date >= parisDate(now)) || await hash(JSON.stringify(authority)) !== pin) unavailable();
  const calendar = authority.calendar;
  if (authority.schemaVersion !== 1 || calendar.id !== DAILY_V2_CALENDAR || calendar.rulesVersion !== 'classic-v2' || calendar.corpusVersion !== DAILY_V2_CORPUS || calendar.timezone !== 'Europe/Paris' || calendar.status !== 'inactive' || calendar.assignments.length !== 365 || calendar.assignments[0].date !== DAILY_V2_START || calendar.assignments.at(-1)?.date !== DAILY_V2_END || authority.pins.corpusId !== DAILY_V2_CORPUS || authority.pins.dictionarySize !== DAILY_V2_DICTIONARY_SIZE || authority.entries.length < 400 || authority.entries.length > 768) unavailable();
  const assignment = calendar.assignments.find(item=>item.date===date);
  const entry = authority.entries.find(item=>item.targetId===assignment?.targetId);
  if (!assignment || !entry || entry.hints.length !== 3 || !authority.pins.targets[String(entry.targetId)]) unavailable();
  const target = entry!;
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),30000);
  const abort = () => controller.abort(); signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  const network = boundedRangeBucket(runtime.bucket!,{ reads:16,bytes:8*1024*1024,signal:controller.signal });
  const reader = new SemanticV2Reader(authority.pins,pinnedRangeR2Loader(network.bucket,authority.rootReference));
  const publicPuzzle: Puzzle = { id:dailyV2Ref(date,context).id,mode:context,seed:date,date,number:Math.floor((Date.parse(`${date}T00:00:00Z`)-Date.parse('2026-09-07T00:00:00Z'))/86400000)+1,vocabularySize:DAILY_V2_DICTIONARY_SIZE,resetAt:nextParisMidnight(now),ref:dailyV2Ref(date,context) };
  const close = () => { clearTimeout(timer);controller.abort();network.close();signal?.removeEventListener('abort',abort); };
  // GET must not promise a playable edition when its pinned runtime is absent.
  // The same reader/cache and request budget carry this check into POST work.
  try { await reader.evaluate(target.targetId,target.hints[0].id);if(controller.signal.aborted)unavailable(); }
  catch { close();return unavailable(); }
  return {
    publicPuzzle, targetWord:target.word,
    async evaluate(word: string) { try { const found=await reader.lookup(word); if(!found)return null; const value=await reader.evaluate(target.targetId,found.id);if(controller.signal.aborted)unavailable();return{word:found.word,...value}; } catch { return unavailable(); } },
    close,
  };
}
