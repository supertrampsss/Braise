import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './support/social-database';
import { MetricsStore, metricDay } from '../lib/metrics-store';
import { METRICS_DAILY_CAP, METRICS_LIFETIME_MS, type MetricEvent } from '../lib/metrics-contract';

const event = (type: MetricEvent['type'] = 'guessAccepted'): MetricEvent => ({ id: crypto.randomUUID(), type, context: 'daily' });
const start = Date.parse('2026-10-01T12:00:00Z'), day = 86_400_000;
test('collection requires active consent, is idempotent and revocation prevents delayed resurrection', async () => {
  const db = database(), store = new MetricsStore(db.d1), sample = event();
  try {
    assert.equal(await store.collect('a', sample, start), false);
    assert.equal(await store.grant('a', start), start + METRICS_LIFETIME_MS);
    assert.equal(await store.collect('a', sample, start), true);
    assert.equal(await store.collect('a', sample, start), false);
    await store.revoke('a', start + 1);
    assert.equal(await store.collect('a', event(), start + 2), false);
    assert.equal(await store.grant('a', start + 3), null);
    assert.equal((await store.report(start + 4)).events, 0);
    await store.revoke('never-granted', start);
    assert.equal(await store.grant('never-granted', start + 1), null);
  } finally { db.sqlite.close(); }
});
test('expired data is excluded and purged while newer consent survives', async () => {
  const db = database(), store = new MetricsStore(db.d1);
  try {
    await store.grant('old', start); await store.collect('old', event(), start);
    await store.grant('new', start + day); await store.collect('new', event(), start + day);
    const report = await store.report(start + METRICS_LIFETIME_MS);
    assert.equal(report.browsers, 1);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM braiz_metric_consents').get()?.n, 1);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM braiz_metric_events').get()?.n, 1);
  } finally { db.sqlite.close(); }
});
test('cohorts use exact Paris calendar return days and only completed return dates', async () => {
  const db = database(), store = new MetricsStore(db.d1);
  try {
    for (const token of ['a', 'b']) { await store.grant(token, start); await store.collect(token, event('gameOpened'), start); }
    await store.collect('a', event(), start + day); await store.collect('a', event(), start + 7 * day);
    await store.collect('b', event(), start + 2 * day);
    await store.grant('c', start + 8 * day); await store.collect('c', event(), start + 8 * day); await store.collect('c', event(), start + 9 * day);
    await store.grant('help-only', start); await store.collect('help-only', event('helpOpened'), start);
    const report = await store.report(start + 9 * day);
    assert.deepEqual(report.cohorts[0], { day: '2026-10-01', browsers: 2, d1Eligible: 2, d1Returned: 1, d7Eligible: 2, d7Returned: 1 });
    assert.equal(report.cohorts[1].d1Eligible, 0); assert.equal(report.cohorts[1].d7Eligible, 0);
    assert.equal(report.cohorts.length, 2); assert.equal(report.browsers, 4);
    assert.equal(metricDay(Date.parse('2026-10-01T22:30:00Z')), '2026-10-02');
    assert.equal(metricDay(Date.parse('2026-10-28T22:30:00Z')), '2026-10-28');
    assert.equal(JSON.stringify(report).includes('token_hash'), false);
  } finally { db.sqlite.close(); }
});
test('per-browser daily cap is enforced atomically without affecting another day', async () => {
  const db = database(), store = new MetricsStore(db.d1);
  try {
    await store.grant('a', start);
    for (let index = 0; index < METRICS_DAILY_CAP; index++) assert.equal(await store.collect('a', event(), start), true);
    assert.equal(await store.collect('a', event(), start), false);
    assert.equal(await store.collect('a', event(), start + day), true);
    assert.equal((await store.report(start + day)).events, METRICS_DAILY_CAP + 1);
  } finally { db.sqlite.close(); }
});
test('unknown-token tombstones cannot consume active-consent capacity and known withdrawal stays possible', async () => {
  const db = database(), store = new MetricsStore(db.d1);
  try {
    db.sqlite.prepare(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000) INSERT INTO braiz_metric_consents SELECT 'revoked-'||x,?,?,1 FROM n`).run(start, start + METRICS_LIFETIME_MS);
    assert.equal(await store.grant('real', start), start + METRICS_LIFETIME_MS);
    await store.collect('real', event(), start); await store.revoke('real', start);
    assert.equal((await store.report(start)).events, 0);
    await assert.rejects(store.revoke('extra-unknown', start), /revocation-capacity/);
  } finally { db.sqlite.close(); }
});
