import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { emitMetric, grantMetrics, METRICS_PREFERENCE_KEY, readMetricsPreference, revokeMetrics } from '../lib/metrics-client';
import { recordProductEvent, PRODUCT_EVENTS_KEY } from '../lib/product-events';
import { METRICS_LIFETIME_MS } from '../lib/metrics-contract';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function memory() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } }; }
const settle = () => new Promise(resolve => setImmediate(resolve));
test('default, expired and incompatible consent generate neither requests nor identifiers', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected'); };
  const storage = memory(); recordProductEvent(storage, 'guessAccepted', 'daily');
  assert.ok(storage.getItem(PRODUCT_EVENTS_KEY)); assert.equal(storage.getItem(METRICS_PREFERENCE_KEY), null);
  storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify({ version: 1, status: 'granted', token: 'a'.repeat(64), expiresAt: Date.now() - 1 })); emitMetric(storage, 'guessAccepted', 'daily');
  storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify({ version: 2, status: 'granted', token: 'a'.repeat(64), expiresAt: Date.now() + 1000 })); emitMetric(storage, 'guessAccepted', 'daily');
  await settle(); assert.equal(calls, 0);
});
test('explicit grant sends only new allowlisted actions and no old diagnostic ledger', async () => {
  const calls: { body: Record<string, unknown>; options?: RequestInit }[] = [], storage = memory();
  globalThis.fetch = async (_url, options) => { const body = JSON.parse(String(options?.body)); calls.push({ body, options }); return body.action === 'grant' ? Response.json({ expiresAt: Date.now() + METRICS_LIFETIME_MS }) : new Response(null, { status: 204 }); };
  recordProductEvent(storage, 'guessAccepted', 'daily'); assert.equal(calls.length, 0);
  assert.equal(await grantMetrics(storage), true); assert.equal(calls.length, 1); assert.equal(readMetricsPreference(storage).status, 'granted');
  recordProductEvent(storage, 'puzzleWon', 'archive'); emitMetric(storage, 'invented', 'daily'); emitMetric(storage, 'profileImported', 'profile');
  await settle(); assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(calls[1].body).sort(), ['action', 'event', 'token']);
  assert.deepEqual(Object.keys(calls[1].body.event as object).sort(), ['context', 'id', 'type']);
  assert.equal(calls[1].options?.credentials, 'omit'); assert.equal(calls[1].options?.referrerPolicy, 'no-referrer');
});
test('offline revocation stops immediately, keeps pending deletion and retries without replay', async () => {
  const storage = memory(); let calls = 0, fail = false, aborted = false;
  globalThis.fetch = async (_url, options) => { calls++; const body = JSON.parse(String(options?.body)); if (body.action === 'grant') return Response.json({ expiresAt: Date.now() + METRICS_LIFETIME_MS }); if (body.action === 'event') return new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }); }); if (fail) throw new Error('offline'); return Response.json({ revoked: true }); };
  assert.equal(await grantMetrics(storage), true); emitMetric(storage, 'guessAccepted', 'daily');
  fail = true; assert.equal(await revokeMetrics(storage), false); assert.equal(aborted, true); assert.equal(readMetricsPreference(storage).status, 'revoking');
  const previous = calls; emitMetric(storage, 'guessAccepted', 'daily'); await settle(); assert.equal(calls, previous);
  fail = false; assert.equal(await revokeMetrics(storage), true); assert.equal(storage.getItem(METRICS_PREFERENCE_KEY), null);
});
test('delayed grant acknowledgement cannot undo a concurrent explicit withdrawal', async () => {
  const storage = memory(); let finishGrant!: (response: Response) => void;
  globalThis.fetch = async (_url, options) => JSON.parse(String(options?.body)).action === 'grant' ? new Promise(resolve => { finishGrant = resolve; }) : Response.json({ revoked: true });
  const granting = grantMetrics(storage); await settle();
  assert.equal(await revokeMetrics(storage), true);
  finishGrant(Response.json({ expiresAt: Date.now() + METRICS_LIFETIME_MS }));
  assert.equal(await granting, false); assert.equal(readMetricsPreference(storage).status, 'off');
});
test('storage quota failure cannot prevent server deletion or keep local collection running', async () => {
  const storage = memory(), calls: string[] = [];
  globalThis.fetch = async (_url, options) => { const action = JSON.parse(String(options?.body)).action; calls.push(action); return Response.json(action === 'grant' ? { expiresAt: Date.now() + METRICS_LIFETIME_MS } : { revoked: true }); };
  assert.equal(await grantMetrics(storage), true);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  storage.removeItem = () => { throw new Error('SecurityError'); };
  assert.equal(await revokeMetrics(storage), true); emitMetric(storage, 'guessAccepted', 'daily'); await settle();
  assert.deepEqual(calls, ['grant', 'revoke']); assert.equal(readMetricsPreference(storage).status, 'off');
});
test('pending deletion retries on reconnect outside the profile and storage changes enable a new voluntary consent', async () => {
  const previousWindow = globalThis.window, previousChannel = globalThis.BroadcastChannel;
  const events = new EventTarget(); Object.assign(globalThis, { window: events, BroadcastChannel: undefined });
  const storage = memory(); let offline = false; const calls: string[] = [];
  globalThis.fetch = async (_url, options) => { const action = JSON.parse(String(options?.body)).action; calls.push(action); if (offline) throw new Error('offline'); return action === 'event' ? new Response(null, { status: 204 }) : Response.json(action === 'grant' ? { expiresAt: Date.now() + METRICS_LIFETIME_MS } : { revoked: true }); };
  try {
    assert.equal(await grantMetrics(storage), true); offline = true; assert.equal(await revokeMetrics(storage), false);
    offline = false; events.dispatchEvent(new Event('online')); await settle(); await settle();
    assert.equal(readMetricsPreference(storage).status, 'off'); assert.equal(calls.filter(action => action === 'revoke').length, 2);
    storage.setItem(METRICS_PREFERENCE_KEY, JSON.stringify({ version: 1, status: 'granted', token: 'f'.repeat(64), expiresAt: Date.now() + 10_000 }));
    const storageEvent = new Event('storage'); Object.assign(storageEvent, { key: METRICS_PREFERENCE_KEY }); events.dispatchEvent(storageEvent);
    emitMetric(storage, 'guessAccepted', 'daily'); await settle(); assert.equal(calls.at(-1), 'event');
  } finally { Object.assign(globalThis, { window: previousWindow, BroadcastChannel: previousChannel }); }
});
