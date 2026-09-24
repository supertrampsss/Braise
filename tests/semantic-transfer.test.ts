import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semanticTransfer, TRANSFER_MAX_BYTES, type TransferBucket } from '../lib/semantic-transfer';
const token = 'x'.repeat(64);
const expires = '2099-01-01T00:00:00Z';
const bytes = new TextEncoder().encode('real transport fixture');
const digest = await crypto.subtle.digest('SHA-256', bytes);
const hash = Buffer.from(digest).toString('hex');
function request(method: string, options: { auth?: string; hash?: string; data?: Uint8Array; length?: number } = {}) {
  const data = options.data ?? bytes;
  return new Request(`https://braiz.io/api/semantic-transfer?sha256=${options.hash ?? hash}`, { method, headers: { authorization: options.auth ?? `Bearer ${token}`, ...(method === 'PUT' ? { 'content-length': String(options.length ?? data.length) } : {}) }, ...(method === 'PUT' ? { body: new Uint8Array(data).buffer } : {}) });
}
test('transfer fails closed without credentials, after expiration and for wrong tokens', async () => {
  for (const config of [{}, { token, expires: 'invalid' }, { token, expires: '2000-01-01' }]) assert.equal((await semanticTransfer(request('PUT'), config)).status, 404);
  assert.equal((await semanticTransfer(request('PUT', { auth: 'Bearer wrong' }), { token, expires })).status, 404);
});
test('transfer validates payload, digest and namespace before storage', async () => {
  let writes = 0;
  const bucket = { put: async () => { writes++; } } as unknown as TransferBucket;
  const config = { token, expires, bucket };
  assert.equal((await semanticTransfer(request('PUT', { hash: '../active.json' }), config)).status, 400);
  assert.equal((await semanticTransfer(request('PUT', { hash: '0'.repeat(64) }), config)).status, 422);
  assert.equal((await semanticTransfer(request('PUT', { length: TRANSFER_MAX_BYTES + 1 }), config)).status, 413);
  assert.equal((await semanticTransfer(request('PUT', { length: bytes.length - 1 }), config)).status, 413);
  assert.equal((await semanticTransfer(request('PUT', { length: bytes.length + 1 }), config)).status, 422);
  assert.equal(writes, 0);
});
test('immutable transfer roundtrip and availability errors', async () => {
  let stored: Uint8Array | null = null;
  const bucket: TransferBucket = {
    async put(key, value, options) { assert.equal(key, `semantic-blobs/sha256/${hash}`); assert.equal(options.sha256, hash); stored = value; },
    async head() { return stored ? { size: stored.length, checksums: { sha256: digest } } : null; },
    async get() { return stored ? { size: stored.length, checksums: { sha256: digest }, body: new Response(new Uint8Array(stored).buffer).body! } : null; },
  };
  const config = { token, expires, bucket };
  assert.equal((await semanticTransfer(request('HEAD'), config)).status, 404);
  assert.equal((await semanticTransfer(request('PUT'), config)).status, 201);
  assert.equal((await semanticTransfer(request('HEAD'), config)).headers.get('x-content-sha256'), hash);
  assert.deepEqual(new Uint8Array(await (await semanticTransfer(request('GET'), config)).arrayBuffer()), bytes);
  assert.equal((await semanticTransfer(request('PUT'), { token, expires })).status, 503);
  assert.equal((await semanticTransfer(request('PUT'), { ...config, bucket: { ...bucket, put: async () => { throw Error('offline'); } } })).status, 503);
});
