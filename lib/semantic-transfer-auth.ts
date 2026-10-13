// Shared temporary capability: bounded inputs and constant-length digest comparison.
export async function semanticTransferAuthorized(request: Request, runtime: { token?: string; expires?: string }) {
  const provided = request.headers.get('authorization') ?? '';
  if (typeof runtime.token !== 'string' || runtime.token.length < 64 || runtime.token.length > 512 || typeof runtime.expires !== 'string' || runtime.expires.length > 64 || !Number.isFinite(Date.parse(runtime.expires)) || Date.now() >= Date.parse(runtime.expires) || provided.length > 1024) return false;
  const [a, b] = await Promise.all([provided, `Bearer ${runtime.token}`].map(s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  let difference = 0; const av = new Uint8Array(a), bv = new Uint8Array(b);
  for (let i = 0; i < av.length; i++) difference |= av[i] ^ bv[i];
  return difference === 0;
}
