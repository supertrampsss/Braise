import { exactMetricKeys, METRICS_CONTEXTS, METRICS_LIFETIME_MS, METRICS_TYPES, metricTokenValid, type MetricContext, type MetricType } from './metrics-contract';
import type { DiagnosticStorage } from './product-events';

export const METRICS_PREFERENCE_KEY = 'braiz.metrics-consent.v1';
export const METRICS_CHANGED = 'braiz-metrics-changed';
type Preference = { version: 1; status: 'pending' | 'granted' | 'revoking'; token: string; expiresAt: number };
export type MetricsPreference = Preference | { status: 'off' } | { status: 'unavailable' };
const active = new Set<AbortController>();
let listening = false;
let stoppedLocally = false;
let channel: BroadcastChannel | null = null;
const pendingDeletion = new Set<string>(), deleted = new Set<string>();
export function readMetricsPreference(storage: DiagnosticStorage, now = Date.now()): MetricsPreference {
  try {
    const raw = storage.getItem(METRICS_PREFERENCE_KEY);
    if (raw === null) return { status: 'off' };
    if (raw.length > 512) return { status: 'unavailable' };
    const item = JSON.parse(raw);
    if (!exactMetricKeys(item, ['version', 'status', 'token', 'expiresAt']) || item.version !== 1 || !['pending', 'granted', 'revoking'].includes(item.status as string) || !metricTokenValid(item.token) || typeof item.expiresAt !== 'number' || !Number.isSafeInteger(item.expiresAt) || item.expiresAt > now + METRICS_LIFETIME_MS + 60_000) return { status: 'unavailable' };
    if (item.expiresAt <= now && item.status !== 'revoking') return { status: 'off' };
    if (deleted.has(item.token as string)) return { status: 'off' };
    if (pendingDeletion.has(item.token as string)) return { ...item, status: 'revoking' } as Preference;
    return item as Preference;
  } catch { return { status: 'unavailable' }; }
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(METRICS_CHANGED)); }
function stop() { for (const request of active) request.abort(); active.clear(); }
export function initializeMetrics(storage: DiagnosticStorage) {
  if (typeof window === 'undefined') return;
  const retry = () => {
    const state = readMetricsPreference(storage);
    if (state.status === 'revoking') void revokeMetrics(storage);
    else for (const token of pendingDeletion) void deleteRemote(storage, token);
  };
  if (!listening) {
    listening = true;
    window.addEventListener('storage', event => {
      if (event.key === null || event.key === METRICS_PREFERENCE_KEY) {
        stop(); stoppedLocally = readMetricsPreference(storage).status !== 'granted'; notify(); retry();
      }
    });
    window.addEventListener('online', retry); retry();
  }
  if (!channel && typeof BroadcastChannel !== 'undefined' && !['off', 'unavailable'].includes(readMetricsPreference(storage).status)) {
    channel = new BroadcastChannel('braiz-metrics-consent');
    channel.onmessage = event => {
      if (!event.data || !metricTokenValid(event.data.token)) return;
      if (event.data.action === 'stop') { pendingDeletion.add(event.data.token); stoppedLocally = true; stop(); }
      if (event.data.action === 'deleted') { pendingDeletion.delete(event.data.token); deleted.add(event.data.token); stoppedLocally = true; stop(); }
      notify();
    };
  }
}
async function request(body: object, tracked = false) {
  const controller = new AbortController(); if (tracked) active.add(controller);
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('/api/metrics', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal, referrerPolicy: 'no-referrer' });
    return { ok: response.ok, data: response.status === 204 ? null : await response.json() as unknown };
  }
  finally { clearTimeout(timer); active.delete(controller); }
}
/** No previous events are read or uploaded. Opt-in applies only after the server acknowledges it. */
export async function grantMetrics(storage: DiagnosticStorage): Promise<boolean> {
  initializeMetrics(storage);
  const current = readMetricsPreference(storage);
  if (current.status === 'unavailable' || current.status === 'revoking') return false;
  if (current.status === 'granted') { stoppedLocally = false; return true; }
  const token = current.status === 'pending' ? current.token : [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
  const pending: Preference = { version: 1, status: 'pending', token, expiresAt: Date.now() + METRICS_LIFETIME_MS };
  try {
    storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify(pending)); initializeMetrics(storage); notify();
    const response = await request({ action: 'grant', token });
    if (!response.ok) return false;
    const data = response.data;
    if (!exactMetricKeys(data, ['expiresAt']) || typeof data.expiresAt !== 'number' || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + METRICS_LIFETIME_MS + 60_000) return false;
    const latest = readMetricsPreference(storage);
    if (latest.status !== 'pending' || latest.token !== token) return false;
    storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify({ ...pending, status: 'granted', expiresAt: data.expiresAt })); notify();
    stoppedLocally = false;
    return true;
  } catch { return false; }
}
/** Local collection stops immediately. Keep a pending deletion if offline; never claim it succeeded. */
export async function revokeMetrics(storage: DiagnosticStorage): Promise<boolean> {
  stoppedLocally = true; stop();
  const state = readMetricsPreference(storage);
  if (state.status === 'off') return true;
  if (state.status === 'unavailable') return false;
  pendingDeletion.add(state.token); channel?.postMessage({ action: 'stop', token: state.token });
  // A quota/security error must not prevent the server-side deletion request.
  try { storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify({ ...state, status: 'revoking' })); }
  catch { try { storage.removeItem(METRICS_PREFERENCE_KEY); } catch { /* Keep the in-memory stop and pending deletion. */ } }
  notify();
  return deleteRemote(storage, state.token);
}
async function deleteRemote(storage: DiagnosticStorage, token: string): Promise<boolean> {
  try {
    const response = await request({ action: 'revoke', token });
    if (!response.ok) return false;
    const latest = readMetricsPreference(storage);
    pendingDeletion.delete(token); deleted.add(token);
    if (latest.status === 'revoking' && latest.token === token) { try { storage.removeItem(METRICS_PREFERENCE_KEY); } catch { /* The server already confirmed deletion; retain the local stop. */ } }
    channel?.postMessage({ action: 'deleted', token });
    notify(); return true;
  } catch { return false; }
}
/** Loss-tolerant by design: no offline queue, retry, backfill, cookies, text, URL or account identity. */
export function emitMetric(storage: DiagnosticStorage, type: string, context: string): void {
  initializeMetrics(storage);
  if (stoppedLocally) return;
  if (!METRICS_TYPES.includes(type as MetricType) || !METRICS_CONTEXTS.includes(context as MetricContext)) return;
  const consent = readMetricsPreference(storage);
  if (consent.status !== 'granted') return;
  void request({ action: 'event', token: consent.token, event: { id: crypto.randomUUID(), type, context } }, true).catch(() => {});
}
