import { LEGACY_ARCHIVE_START_DATE, isCalendarDate, parisDate } from './calendar';
import { DAILY_V2_START, dailyV2Date, isDailyV2Ref } from './daily-v2-contract';
import { LEGACY_VERSIONS, type PuzzleRef } from './game-contracts';
import type { ProfileSnapshot } from './profile-storage';

export const DISCOVERY_KEY = 'braiz.encountered.v1';
export function readEncountered(storage: Pick<Storage,'getItem'>): string[] | null {
  try { const raw = storage.getItem(DISCOVERY_KEY); if (!raw) return []; if (raw.length > 10000) return null; const v = JSON.parse(raw); return v.version === 1 && Array.isArray(v.ids) && v.ids.length <= 120 && v.ids.every((id: unknown) => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)) ? v.ids : null; } catch { return null; }
}
export function rememberEncountered(storage: Pick<Storage,'getItem'|'setItem'>, ids: string[]) {
  const previous = readEncountered(storage); if (!previous) return false;
  const next = [...new Set([...previous, ...ids])];
  if (next.length > 120 || !next.every(id => /^[a-f0-9]{64}$/.test(id))) return false;
  try { storage.setItem(DISCOVERY_KEY, JSON.stringify({ version: 1, ids: next })); return true; } catch { return false; }
}


function classicalDiscoveryId(value: unknown, now: Date): value is string {
  if (typeof value !== 'string') return false;
  if (/^free-\d{1,10}$/.test(value)) return Number(value.slice(5)) <= 2147483647;
  const v2 = dailyV2Date(value);
  if (v2) return v2 <= parisDate(now);
  const date = value.startsWith('daily-') ? value.slice(6) : '';
  return isCalendarDate(date) && date >= LEGACY_ARCHIVE_START_DATE && date < DAILY_V2_START && date <= parisDate(now);
}
function classicalDiscoveryRef(ref: PuzzleRef, now: Date) {
  if (isDailyV2Ref(ref, now)) return true;
  if (!ref || ref.contractVersion !== 1 || ref.corpusVersion !== LEGACY_VERSIONS.corpus || ref.rulesVersion !== LEGACY_VERSIONS.rules || ref.variant !== 'classic' || !classicalDiscoveryId(ref.id, now)) return false;
  if (ref.id.startsWith('free-')) return ref.calendar === null && ['free','challenge','collection','expedition'].includes(ref.context);
  return ref.id.startsWith('daily-') && !dailyV2Date(ref.id) && ['daily','archive'].includes(ref.context) && ref.calendar?.version === LEGACY_VERSIONS.calendar && ref.calendar.date === ref.id.slice(6);
}
/** Read-only encounter union. A profile transfer carries facts, not full game saves. */
export function collectDiscoveryHistory(storage: Pick<Storage,'length'|'key'>, snapshot: ProfileSnapshot | null | undefined, now = new Date()) {
  const ids = new Set<string>();
  const add = (id: unknown) => {
    if (!classicalDiscoveryId(id, now)) return;
    ids.add(id); // Preserve seed strings, including leading zeroes. Never remap a V2 index.
    if (ids.size > 3000) throw new Error('L’historique dépasse la limite de découverte. Reprenez une partie existante.');
  };
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith('braise.v1.game.')) add(key.slice('braise.v1.game.'.length));
  }
  if (!snapshot) return [...ids];
  const facts = [...snapshot.activities, ...snapshot.pendingActivities, ...snapshot.transferEvidence];
  const witnessedWins = new Set(facts.flatMap(fact => fact.type === 'puzzleWon' ? [fact.win.id] : []));
  for (const win of snapshot.profile.wins) {
    // Bare historical wins are V1. Later wins have a versioned witness; variants
    // cannot enter via an unrelated classic-looking win.id in an imported fact.
    if (!witnessedWins.has(win.id) && !dailyV2Date(win.id) && (win.id.startsWith('free-') ? ['free','challenge'].includes(win.mode) : ['daily','archive'].includes(win.mode))) add(win.id);
  }
  for (const fact of facts) {
    if (fact.schemaVersion !== 2 || fact.provenance !== 'personal-local' || fact.type !== 'guessAccepted' && fact.type !== 'puzzleWon') continue;
    if (fact.type === 'puzzleWon' && fact.win.id !== fact.puzzleRef.id) continue;
    if (classicalDiscoveryRef(fact.puzzleRef, now)) add(fact.puzzleRef.id);
  }
  return [...ids];
}
