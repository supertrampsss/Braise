import { env } from 'cloudflare:workers';
import { exactMetricKeys, metricEventValid, metricTokenValid } from '@/lib/metrics-contract';
import { MetricsStore } from '@/lib/metrics-store';
import { semanticTransferAuthorized } from '@/lib/semantic-transfer-auth';
import { tokenHash, validMutationOrigin } from '@/lib/server-security';
import { creationLimited } from '@/lib/server-limits';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Authorization' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
async function smallJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('body');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024) { await reader.cancel(); throw new Error('size'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return reply({ error: 'origin' }, 403);
  let body: unknown;
  try { body = await smallJson(request); } catch { return reply({ error: 'invalid-request' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid-request' }, 400);
  const input = body as Record<string, unknown>;
  if (!metricTokenValid(input.token)) return reply({ error: 'invalid-request' }, 400);
  if (input.action === 'event' ? !exactMetricKeys(input, ['action', 'token', 'event']) || !metricEventValid(input.event) : !exactMetricKeys(input, ['action', 'token']) || !['grant', 'revoke'].includes(input.action as string)) return reply({ error: 'invalid-request' }, 400);
  if (!env.DB) return reply({ error: 'unavailable' }, 503);
  if (input.action === 'grant' && creationLimited(request)) return reply({ error: 'limited' }, 429);
  try {
    const store = new MetricsStore(env.DB), now = Date.now(), hash = await tokenHash(input.token);
    await store.prune(now);
    if (input.action === 'grant') {
      const expiresAt = await store.grant(hash, now);
      return expiresAt === null ? reply({ error: 'consent-unavailable' }, 409) : reply({ expiresAt });
    }
    if (input.action === 'revoke') {
      if (!await store.known(hash) && creationLimited(request)) return reply({ error: 'limited' }, 429);
      await store.revoke(hash, now); return reply({ revoked: true });
    }
    // No identity, stored event, previous history or token is returned to the browser.
    await store.collect(hash, input.event as Parameters<MetricsStore['collect']>[1], now);
    return new Response(null, { status: 204, headers });
  } catch { return reply({ error: 'unavailable' }, 503); }
}
export async function GET(request: Request) {
  if (!await semanticTransferAuthorized(request, { token: env.BRAIZ_METRICS_OPERATOR_TOKEN, expires: env.BRAIZ_METRICS_OPERATOR_EXPIRES })) return reply({ error: 'unauthorized' }, 401);
  if (!env.DB) return reply({ error: 'unavailable' }, 503);
  try { return reply(await new MetricsStore(env.DB).report(Date.now())); }
  catch { return reply({ error: 'unavailable' }, 503); }
}
