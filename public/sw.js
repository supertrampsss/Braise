/* Only this public, non-personal fallback is cached. Never cache games or API data. */
const CACHE = "braise-offline-v1";
const FALLBACK = "/offline.html";
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch(FALLBACK, { cache: "reload", redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("offline-fallback-unavailable");
    const cache = await caches.open(CACHE);
    await cache.put(FALLBACK, response);
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("braise-offline-") && key !== CACHE) await caches.delete(key);
    }
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || event.request.mode !== "navigate" || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(FALLBACK) || Response.error();
  }));
});
