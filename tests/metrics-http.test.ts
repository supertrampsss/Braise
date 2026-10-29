import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { env } from 'cloudflare:workers';
import { POST, GET } from '../app/api/metrics/route';
import { database } from './support/social-database';
import { tokenHash } from '../lib/server-security';
import type { MetricsReport } from '../lib/metrics-contract';

const token = 'a'.repeat(64), operator = 'b'.repeat(64);
const post = (body: unknown, origin = 'https://braiz.io') => POST(new Request('https://braiz.io/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }));
afterEach(() => { delete env.DB; delete env.BRAIZ_METRICS_OPERATOR_TOKEN; delete env.BRAIZ_METRICS_OPERATOR_EXPIRES; });
test('HTTP refuses untrusted origin, unknown fields, large input and unconfigured service', async () => {
  assert.equal((await post({ action: 'grant', token }, 'https://other.example')).status, 403);
  assert.equal((await post({ action: 'grant', token, word: 'secret' })).status, 400);
  assert.equal((await post({ action: 'event', token, event: { id: crypto.randomUUID(), type: 'guessAccepted', context: 'duel', url: '/duels/private' } })).status, 400);
  assert.equal((await post({ action: 'event', token, event: { id: crypto.randomUUID(), type: 'invented', context: 'daily' } })).status, 400);
  assert.equal((await post({ action: 'grant', token: 'a'.repeat(2000) })).status, 400);
  assert.equal((await post({ action: 'grant', token })).status, 503);
});
test('operator protection fails closed and only returns aggregates; revocation deletes events', async () => {
  const db = database(); env.DB = db.d1;
  try {
    assert.equal((await GET(new Request('https://braiz.io/api/metrics'))).status, 401);
    env.BRAIZ_METRICS_OPERATOR_TOKEN = operator; env.BRAIZ_METRICS_OPERATOR_EXPIRES = new Date(Date.now() + 60_000).toISOString();
    const authorized = () => GET(new Request('https://braiz.io/api/metrics', { headers: { Authorization: `Bearer ${operator}` } }));
    assert.equal((await GET(new Request(`https://braiz.io/api/metrics?token=${operator}`))).status, 401);
    assert.equal((await post({ action: 'grant', token })).status, 200);
    const event = { id: crypto.randomUUID(), type: 'guessAccepted', context: 'daily' };
    assert.equal((await post({ action: 'event', token, event })).status, 204);
    assert.equal((await post({ action: 'event', token, event })).status, 204);
    const response = await authorized(), report = await response.json() as MetricsReport;
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(report.events, 1); assert.equal(report.browsers, 1);
    const text = JSON.stringify(report);
    for (const forbidden of [token, await tokenHash(token), event.id, 'token_hash', 'event_id']) assert.equal(text.includes(forbidden), false);
    assert.equal((await post({ action: 'revoke', token })).status, 200);
    assert.equal((await post({ action: 'grant', token })).status, 409);
    assert.equal((await post({ action: 'event', token, event: { ...event, id: crypto.randomUUID() } })).status, 204);
    assert.equal((await (await authorized()).json() as MetricsReport).events, 0);
    env.BRAIZ_METRICS_OPERATOR_EXPIRES = new Date(Date.now() - 1).toISOString();
    assert.equal((await authorized()).status, 401);
  } finally { db.sqlite.close(); }
});
