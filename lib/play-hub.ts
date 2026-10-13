import { LEGACY_STORAGE_PREFIX, validLegacyGame } from './legacy-storage';
import { archiveDateStatus, parisDate } from './calendar';
import { COLLECTIONS } from './collections';
import { EXPEDITIONS } from './expeditions';
import type { SavedGame, Mode } from './game-types';
import { dailyV2Date, DAILY_V2_START } from './daily-v2-contract';
import { parseDailyV2Document } from './daily-v2-storage';
import { parseWord2vecDocument } from './word2vec-storage';
import { word2vecDate, word2vecSeed, isWord2vecId, type ClassicEdition } from './word2vec-contract';
export const PLAY_CONTEXT_KEY = 'braiz.play-context.v1';
export type PlayContext = { mode: Mode; collection?: string; expedition?: string; expeditionStep?: number };
export type LocalPlay = { id: string; mode: Mode; locator: string; game: SavedGame; context?: PlayContext; href: string; label: string; updatedAt?: number; edition:ClassicEdition };
export type PlayStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>;
export function readContexts(storage: PlayStorage): Record<string, PlayContext> | null {
  try {
    const raw = storage.getItem(PLAY_CONTEXT_KEY); if (!raw) return {};
    if (raw.length > 1000000) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !value.items || typeof value.items !== 'object' || Array.isArray(value.items)) return null;
    for (const [id, item] of Object.entries(value.items) as [string, PlayContext][]) {
      const seed=word2vecSeed(id)??id.slice(5);
      if ((!/^(free-\d{1,10}|daily-\d{4}-\d{2}-\d{2})$/.test(id) && !dailyV2Date(id)&&!isWord2vecId(id)) || !item || !['daily','archive','free','challenge'].includes(item.mode) || ((id.startsWith('daily-v2-')||word2vecDate(id)) && (!['daily','archive'].includes(item.mode) || item.collection || item.expedition || item.expeditionStep !== undefined)) || (item.collection && !COLLECTIONS.some(c => c.id === item.collection && c.seeds.includes(seed))) || (item.expedition && !EXPEDITIONS.some(e => e.id === item.expedition)) || (item.expeditionStep !== undefined && (!item.expedition || !Number.isInteger(item.expeditionStep) || item.expeditionStep < 1 || item.expeditionStep > 3))) return null;
    }
    return value.items;
  } catch { return null; }
}
export function rememberPlayContext(storage: PlayStorage, id: string, context: PlayContext) {
  const items = readContexts(storage); if (!items) return false;
  try { storage.setItem(PLAY_CONTEXT_KEY, JSON.stringify({ version: 1, items: { ...items, [id]: context } })); return true; } catch { return false; }
}
export function readLocalPlays(storage: PlayStorage, now = new Date()): LocalPlay[] {
  const result: LocalPlay[] = []; const contexts = readContexts(storage) ?? {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i); if (!key?.startsWith(`${LEGACY_STORAGE_PREFIX}game.`)) continue;
      const id = key.slice(`${LEGACY_STORAGE_PREFIX}game.`.length);
      const raw = storage.getItem(key); if (!raw || raw.length > 2000000) continue;
      let game: unknown; try { game = JSON.parse(raw); } catch { continue; }
      const v2Date = dailyV2Date(id);
      if(id.startsWith('daily-w2v-')||id.startsWith('free-w2v-'))game=parseWord2vecDocument(game,id);
      if (id.startsWith('daily-v2-')) game = v2Date ? parseDailyV2Document(game,id) : null;
      if (!validLegacyGame(game) || !game.guesses.length) continue;
      const context = contexts[id]; let mode: Mode; let locator: string; let href: string; let label: string;
      const edition:ClassicEdition=isWord2vecId(id)?'word2vec-v1':v2Date?'classic-v2':'classic-v1';
      const dailyDate = word2vecDate(id)??v2Date ?? (/^daily-\d{4}-\d{2}-\d{2}$/.test(id) && id.slice(6) < DAILY_V2_START ? id.slice(6) : null);
      if (dailyDate && (archiveDateStatus(dailyDate, now) === 'available' || dailyDate === parisDate(now))) {
        locator = dailyDate; mode = locator === parisDate(now) ? 'daily' : 'archive'; href = mode === 'daily' ? '/' : `/?archive=${locator}`; label = mode === 'daily' ? 'Mot du jour' : `Archive du ${locator}`;
      } else if (word2vecSeed(id)!==null||/^free-\d{1,10}$/.test(id) && Number(id.slice(5)) <= 2147483647) {
        locator = word2vecSeed(id)??id.slice(5); mode = context?.mode === 'challenge' ? 'challenge' : 'free'; href = `/?${mode === 'free' ? 'libre' : 'defi'}=${locator}`; label = mode === 'free' ? 'Partie libre' : 'Défi';
      } else continue;
      if (context?.collection) { const c = COLLECTIONS.find(c => c.id === context.collection)!; label = `${c.title} · énigme ${c.seeds.indexOf(locator) + 1}`; href += `&collection=${c.id}`; }
      if (context?.expedition) { label = `Voyage · ${EXPEDITIONS.find(e => e.id === context.expedition)!.title} · ${context.expeditionStep ? `étape ${context.expeditionStep}/3` : 'étape à vérifier'}`; href = `/?voyage=${context.expedition}`; }
      href+=href.includes('?')?'&edition='+edition:'?edition='+edition;
      const last = game.guesses.at(-1)?.acceptedAt; const updatedAt = last && Number.isFinite(Date.parse(last)) ? Date.parse(last) : Number.isFinite(game.startedAt) && game.startedAt > 0 ? game.startedAt : undefined;
      result.push({ id, mode, locator, game, context, href, label, updatedAt,edition });
    }
  } catch { /* unavailable storage does not block the board */ }
  return result.sort((a,b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
export function resumeSuggestion(plays: LocalPlay[], currentId?: string) { return plays.find(p => p.id !== currentId && !p.game.guesses.some(g => g.found)); }
export function gameSummary(game: SavedGame) {
  return { trials: game.guesses.filter(g => !g.hint).length, hints: game.guesses.filter(g => g.hint).length, milestones: [18,35,55].map(temperature => ({ temperature, guess: game.guesses.find(g => g.temperature >= temperature) })).filter(item => item.guess), bestPistes: [...game.guesses].filter(g => !g.found).sort((a,b) => b.temperature-a.temperature).slice(0,3) };
}
