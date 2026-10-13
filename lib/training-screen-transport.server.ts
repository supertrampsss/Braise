// Server-only fixed training transport. No source URL or path comes from the caller.
type Assets = { fetch(request: Request): Promise<Response> };
const SCREEN = {
  path: "/training/screen-13763f7fff10d0fc36f0f9cd2597c5c95704f18c3b481c637af467f3e021a807.html",
  sha256: "13763f7fff10d0fc36f0f9cd2597c5c95704f18c3b481c637af467f3e021a807",
  bytes: 603,
};
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = () => Response.json({ error: "L’écran hors ligne est indisponible. Réessayez en ligne ; vos anciens fichiers sont conservés." }, { status: 503, headers: HEADERS });

export async function trainingScreenResponse(request: Request, assets: Assets | undefined, { timeoutMs = 6000 }: { timeoutMs?: number } = {}): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/training/screen" || url.search || request.headers.get("sec-fetch-mode") === "navigate") {
    return Response.json({ error: "Ce transport est réservé au téléchargement de l’écran hors ligne." }, { status: request.method !== "GET" ? 405 : 400, headers: { ...HEADERS, Allow: "GET" } });
  }
  if (!assets?.fetch || request.signal.aborted) return unavailable();

  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let expire: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    expire = () => {
      controller.abort();
      // Never await cancellation: even a noncooperative binding must not hold the API open.
      void reader?.cancel().catch(() => {});
      reject(new Error("training-screen-unavailable"));
    };
  });
  const timer = setTimeout(expire, timeoutMs);
  request.signal.addEventListener("abort", expire, { once: true });
  const load = async () => {
    const fetchAsset = (path: string) => assets.fetch(new Request(new URL(path, url.origin), { method: "GET", cache: "no-store", redirect: "manual", signal: controller.signal }));
    let response = await fetchAsset(SCREEN.path);
    if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw new Error("training-screen-unavailable"); }
    // ASSETS canonicalizes this one .html path. Only its exact same-origin clean
    // alias may be requested once; no automatic following or arbitrary proxying.
    if (response.status === 307 && !response.redirected) {
      const clean = SCREEN.path.slice(0, -5);
      const location = response.headers.get("location");
      void response.body?.cancel().catch(() => {});
      if (location !== clean && location !== new URL(clean, url.origin).href) throw new Error("training-screen-unavailable");
      response = await fetchAsset(clean);
    }
    if (controller.signal.aborted || response.status !== 200 || response.redirected || !response.body) {
      void response.body?.cancel().catch(() => {}); throw new Error("training-screen-unavailable");
    }
    reader = response.body.getReader();
    const bytes = new Uint8Array(SCREEN.bytes);
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (controller.signal.aborted) throw new Error("training-screen-unavailable");
      if (chunk.done) break;
      if (length + chunk.value.byteLength > SCREEN.bytes) throw new Error("training-screen-unavailable");
      bytes.set(chunk.value, length); length += chunk.value.byteLength;
    }
    reader.releaseLock(); reader = undefined;
    if (length !== SCREEN.bytes) throw new Error("training-screen-unavailable");
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    if (controller.signal.aborted || sha256 !== SCREEN.sha256) throw new Error("training-screen-unavailable");
    // Binary fetch transport prevents an edge HTML rewriter from appending JSD.
    // The service worker validates these bytes again and stores them as text/html.
    return new Response(bytes, { headers: { ...HEADERS, "Content-Type": "application/octet-stream" } });
  };
  try { return await Promise.race([load(), deadline]); }
  catch { return unavailable(); }
  finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", expire); controller.abort();
    void reader?.cancel().catch(() => {});
  }
}
