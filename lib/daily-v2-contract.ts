// Public identity/range only. No answer, word ID, score page or R2 authority.
import { isCalendarDate, parisDate } from './calendar';
import type { PuzzleRef } from './game-contracts';
export const DAILY_V2_START = '2027-01-05';
export const DAILY_V2_END = '2028-01-04';
export const DAILY_V2_CORPUS = 'fr-fasttext-complete-bc68b0703375-0f34b2449278';
export const DAILY_V2_CALENDAR = 'paris-daily-v2-20270105';
export const DAILY_V2_DICTIONARY_SIZE = 1013881;
export type DailyV2Ref = PuzzleRef & { corpusVersion: typeof DAILY_V2_CORPUS; rulesVersion: 'classic-v2'; context: 'daily' | 'archive' };
export function isDailyV2Date(date: unknown): date is string {
  return isCalendarDate(date) && date >= DAILY_V2_START && date <= DAILY_V2_END;
}
export function dailyV2Date(id: string) {
  const date = id.startsWith('daily-v2-') ? id.slice(9) : '';
  return isDailyV2Date(date) ? date : null;
}
export function dailyIdentity(date: string) { return `${date >= DAILY_V2_START ? 'daily-v2-' : 'daily-'}${date}`; }
export function dailyV2Ref(date: string, context: 'daily' | 'archive'): PuzzleRef {
  if (!isDailyV2Date(date)) throw new Error('daily-v2-date');
  return { contractVersion: 1, id: dailyIdentity(date), corpusVersion: DAILY_V2_CORPUS, rulesVersion: 'classic-v2', context, variant: 'classic', calendar: { version: DAILY_V2_CALENDAR, date } };
}
export function isDailyV2Ref(value: unknown, now?: Date): value is DailyV2Ref {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as PuzzleRef;
  if (Object.keys(ref).sort().join(',') !== 'calendar,context,contractVersion,corpusVersion,id,rulesVersion,variant' ||
      ref.contractVersion !== 1 || ref.corpusVersion !== DAILY_V2_CORPUS || ref.rulesVersion !== 'classic-v2' || ref.variant !== 'classic' ||
      !['daily','archive'].includes(ref.context) || !ref.calendar || Object.keys(ref.calendar).sort().join(',') !== 'date,version' ||
      ref.calendar.version !== DAILY_V2_CALENDAR || !isDailyV2Date(ref.calendar.date) || ref.id !== dailyIdentity(ref.calendar.date)) return false;
  return !now || ref.calendar.date <= parisDate(now);
}
