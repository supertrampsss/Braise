// Server-only: map existing V1 identities, never alter their selection rules.
import { getLegacyPuzzle, getLegacyArchivePuzzle } from './legacy-puzzles';
import { archiveDateStatus, parisDate } from './calendar';
import type { Puzzle } from './game-types';
import legacy from '@/data/legacy-v1.json';
import future from '@/data/editorial-v2-runtime.json';
import { dailyV2Date, DAILY_V2_START } from './daily-v2-contract';
import { word2vecDate, word2vecSeed, WORD2VEC_START } from './word2vec-contract';
import { dailyWord2vecTarget, openWord2vec } from './word2vec-game.server';
const ids = new Map<number, Promise<string>>();
export function opaqueTargetId(index: number) {
  if (!ids.has(index)) ids.set(index, crypto.subtle.digest('SHA-256', new TextEncoder().encode(`braiz-encounter-v1:${index}`)).then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')));
  return ids.get(index)!;
}
export function legacyEncounterIdentityForWord(word: string) {
  const index=legacy.targets.indexOf(word==='oeuf'?'œuf':word);
  return index<0 ? undefined : opaqueTargetId(index);
}
export async function encounterIdentityForWord(word:string){
  const historical=legacyEncounterIdentityForWord(word);if(historical)return historical;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`braiz-encounter-word2vec-v1:${word}`));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function withTargetIdentity(puzzle: Puzzle) {
  const resolved = puzzle.mode === 'archive' ? getLegacyArchivePuzzle(puzzle.date) : getLegacyPuzzle(puzzle.mode, puzzle.seed, new Date(`${puzzle.date}T12:00:00Z`));
  return { ...puzzle, targetIdentity: await opaqueTargetId(resolved.legacyIndex) };
}
let representatives: Map<number, string> | undefined;
function targetSeeds() {
  if (!representatives) {
    representatives = new Map();
    for (let seed = 0; seed < 100000 && representatives.size < 120; seed++) {
      const resolved = getLegacyPuzzle('free', String(seed));
      if (!representatives.has(resolved.legacyIndex)) representatives.set(resolved.legacyIndex, String(seed));
    }
    if (representatives.size !== 120) throw new Error('V1 discovery coverage unavailable');
  }
  return representatives;
}
export async function discoverFree(body: unknown, now = new Date()) {
  const value = body as { excluded?: unknown; encountered?: unknown; replay?: unknown };
  if (!value || !Array.isArray(value.excluded) || value.excluded.length > (parisDate(now)>=WORD2VEC_START?475:120) || !value.excluded.every(id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)) || !Array.isArray(value.encountered) || value.encountered.length > 3000 || !value.encountered.every(id => typeof id === 'string' && id.length <= 32) || typeof value.replay !== 'boolean') throw new Error('Historique de découverte invalide ou trop volumineux.');
  const excluded = new Set<string>(value.excluded);
  for (const id of value.encountered as string[]) {
    let index: number;
    const date=dailyV2Date(id);
    const w2vDate=word2vecDate(id),w2vSeed=word2vecSeed(id);
    if(w2vDate&&w2vDate<=parisDate(now)) { index=legacy.targets.indexOf(dailyWord2vecTarget(w2vDate));if(index<0)continue; }
    else if(w2vSeed!==null&&parisDate(now)>=WORD2VEC_START)index=getLegacyPuzzle('free',w2vSeed,now).legacyIndex;
    else if(date && date<=parisDate(now)) {
      const targetId=future.calendar.assignments.find(item=>item.date===date)?.targetId;
      const word=future.entries.find(item=>item.targetId===targetId)?.word;
      if(!word)throw new Error('Référence historique invalide.');
      index=legacy.targets.indexOf(word);if(index<0)continue;
    }
    else if (/^free-\d{1,10}$/.test(id) && Number(id.slice(5)) <= 2147483647) index = getLegacyPuzzle('free', id.slice(5), now).legacyIndex;
    else if (id.startsWith('daily-') && id.slice(6)<DAILY_V2_START && (archiveDateStatus(id.slice(6), now) === 'available' || id.slice(6) === parisDate(now))) index = getLegacyArchivePuzzle(id.slice(6), now).legacyIndex;
    else throw new Error('Référence historique invalide.');
    excluded.add(await opaqueTargetId(index));
  }
  const catalogue = await Promise.all([...targetSeeds()].map(async ([index, seed]) => ({ seed, identity: await opaqueTargetId(index) })));
  const seen = catalogue.filter(entry => excluded.has(entry.identity)).map(entry => entry.identity);
  const candidates = catalogue.filter(entry => !excluded.has(entry.identity));
  const exhausted = candidates.length === 0;
  if (exhausted && !value.replay) return { exhausted, remaining: 0, encountered: seen, puzzle: null };
  const pool = value.replay ? catalogue : candidates;
  const entry = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
  // Reuse a historical seed that resolves to this exact target, without replacing any mapping.
  let seed=entry.seed;
  if(value.replay) {
    const encountered=new Set(value.encountered as string[]);
    const target=getLegacyPuzzle('free',entry.seed,now).legacyIndex;
    const start=crypto.getRandomValues(new Uint32Array(1))[0] % 2147400000;
    let found=false;
    for(let offset=0;offset<20000;offset++) {
      const candidate=String(start+offset);
      if(!encountered.has(`free-${candidate}`)&&!encountered.has(`free-w2v-${candidate}`) && getLegacyPuzzle('free',candidate,now).legacyIndex===target) {seed=candidate;found=true;break;}
    }
    if(!found) throw new Error('Impossible de préparer ce rejeu. Réessayez.');
  }
  const puzzle = parisDate(now)>=WORD2VEC_START?(await openWord2vec('free',seed,parisDate(now),now)).publicPuzzle:getLegacyPuzzle('free', seed, now).publicPuzzle;
  return { exhausted, remaining: candidates.length, encountered: seen, puzzle: { ...puzzle, targetIdentity: entry.identity } };
}
