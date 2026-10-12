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
