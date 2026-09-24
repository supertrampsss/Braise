// Server-only, temporary authenticated import of immutable content-addressed blobs.
export const TRANSFER_MAX_BYTES = 8 * 1024 * 1024;
type Stored = { size: number; body: ReadableStream<Uint8Array>; checksums?: { sha256?: ArrayBuffer } };
export type TransferBucket = {
  get(key: string): Promise<Stored | null>;
  head(key: string): Promise<{ size: number; checksums?: { sha256?: ArrayBuffer } } | null>;
  put(key: string, bytes: Uint8Array, options: { sha256: string }): Promise<unknown>;
};
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
export async function semanticTransfer(request: Request, runtime: { token?: string; expires?: string; bucket?: TransferBucket }) {
  const provided = request.headers.get('authorization') ?? '';
  if (!runtime.token || runtime.token.length < 64 || !runtime.expires || !Number.isFinite(Date.parse(runtime.expires)) || Date.now() >= Date.parse(runtime.expires)) return new Response(null, { status: 404, headers });
  const [a, b] = await Promise.all([provided, `Bearer ${runtime.token}`].map(s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  let difference = 0; const av = new Uint8Array(a), bv = new Uint8Array(b);
  for (let i = 0; i < av.length; i++) difference |= av[i] ^ bv[i];
  if (difference) return new Response(null, { status: 404, headers });
  if (!runtime.bucket) return new Response(null, { status: 503, headers });
  const hash = new URL(request.url).searchParams.get('sha256') ?? '';
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 400, headers });
  const key = `semantic-blobs/sha256/${hash}`;
  try {
    if (request.method === 'HEAD' || request.method === 'GET') {
      const object = request.method === 'HEAD' ? await runtime.bucket.head(key) : await runtime.bucket.get(key);
      if (!object) return new Response(null, { status: 404, headers });
      if (object.size < 1 || object.size > TRANSFER_MAX_BYTES || !object.checksums?.sha256 || hex(object.checksums.sha256) !== hash) return new Response(null, { status: 409, headers });
      return new Response('body' in object ? (object as Stored).body : null, { headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(object.size), 'X-Content-SHA256': hash } });
    }
    if (request.method !== 'PUT') return new Response(null, { status: 405, headers });
    const length = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(length) || length < 1 || length > TRANSFER_MAX_BYTES || !request.body) return new Response(null, { status: 413, headers });
    const bytes = new Uint8Array(length), reader = request.body.getReader(); let offset = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (offset + value.length > length) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
        bytes.set(value, offset); offset += value.length;
      }
    } finally { reader.releaseLock(); }
    if (offset !== length || hex(await crypto.subtle.digest('SHA-256', bytes)) !== hash) return new Response(null, { status: 422, headers });
    await runtime.bucket.put(key, bytes, { sha256: hash });
    return new Response(null, { status: 201, headers: { ...headers, 'X-Content-SHA256': hash } });
  } catch { return new Response(null, { status: 503, headers }); }
}
