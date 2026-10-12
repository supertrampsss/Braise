import { LEGACY_STORAGE_PREFIX, validLegacyGame } from './legacy-storage';
import { archiveDateStatus, parisDate } from './calendar';
import { COLLECTIONS } from './collections';
import { EXPEDITIONS } from './expeditions';
import type { SavedGame, Mode } from './game-types';
export const PLAY_CONTEXT_KEY = 'braiz.play-context.v1';
export type PlayContext = { mode: Mode; collection?: string; expedition?: string; expeditionStep?: number };
export type LocalPlay = { id: string; mode: Mode; locator: string; game: SavedGame; context?: PlayContext; href: string; label: string; updatedAt?: number };
export type PlayStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>;
export function readContexts(storage: PlayStorage): Record<string, PlayContext> | null {
  try {
    const raw = storage.getItem(PLAY_CONTEXT_KEY); if (!raw) return {};
    if (raw.length > 1000000) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !value.items || typeof value.items !== 'object' || Array.isArray(value.items)) return null;
    for (const [id, item] of Object.entries(value.items) as [string, PlayContext][]) {
      if (!/^(free-\d{1,10}|daily-\d{4}-\d{2}-\d{2})$/.test(id) || !item || !['daily','archive','free','challenge'].includes(item.mode) || (item.collection && !COLLECTIONS.some(c => c.id === item.collection && c.seeds.includes(id.slice(5)))) || (item.expedition && !EXPEDITIONS.some(e => e.id === item.expedition)) || (item.expeditionStep !== undefined && (!item.expedition || !Number.isInteger(item.expeditionStep) || item.expeditionStep < 1 || item.expeditionStep > 3))) return null;
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
      if (!validLegacyGame(game) || !game.guesses.length) continue;
      const context = contexts[id]; let mode: Mode; let locator: string; let href: string; let label: string;
      if (/^daily-/.test(id) && (archiveDateStatus(id.slice(6), now) === 'available' || id.slice(6) === parisDate(now))) {
        locator = id.slice(6); mode = locator === parisDate(now) ? 'daily' : 'archive'; href = mode === 'daily' ? '/' : `/?archive=${locator}`; label = mode === 'daily' ? 'Mot du jour' : `Archive du ${locator}`;
      } else if (/^free-\d{1,10}$/.test(id) && Number(id.slice(5)) <= 2147483647) {
        locator = id.slice(5); mode = context?.mode === 'challenge' ? 'challenge' : 'free'; href = `/?${mode === 'free' ? 'libre' : 'defi'}=${locator}`; label = mode === 'free' ? 'Partie libre' : 'Défi';
      } else continue;
      if (context?.collection) { const c = COLLECTIONS.find(c => c.id === context.collection)!; label = `${c.title} · énigme ${c.seeds.indexOf(locator) + 1}`; href += `&collection=${c.id}`; }
      if (context?.expedition) { label = `Voyage · ${EXPEDITIONS.find(e => e.id === context.expedition)!.title} · ${context.expeditionStep ? `étape ${context.expeditionStep}/3` : 'étape à vérifier'}`; href = `/?voyage=${context.expedition}`; }
      const last = game.guesses.at(-1)?.acceptedAt; const updatedAt = last && Number.isFinite(Date.parse(last)) ? Date.parse(last) : Number.isFinite(game.startedAt) && game.startedAt > 0 ? game.startedAt : undefined;
      result.push({ id, mode, locator, game, context, href, label, updatedAt });
    }
  } catch { /* unavailable storage does not block the board */ }
  return result.sort((a,b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
export function resumeSuggestion(plays: LocalPlay[], currentId?: string) { return plays.find(p => p.id !== currentId && !p.game.guesses.some(g => g.found)); }
export function gameSummary(game: SavedGame) {
  return { trials: game.guesses.filter(g => !g.hint).length, hints: game.guesses.filter(g => g.hint).length, milestones: [18,35,55].map(temperature => ({ temperature, guess: game.guesses.find(g => g.temperature >= temperature) })).filter(item => item.guess), bestPistes: [...game.guesses].filter(g => !g.found).sort((a,b) => b.temperature-a.temperature).slice(0,3) };
}
