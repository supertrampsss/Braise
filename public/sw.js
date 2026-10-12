/* Neutral fallback is automatic; training files are cached only by explicit download. */
const CACHE = "braise-offline-v2";
const FALLBACK = "/offline.html";
// ASSETS serves clean HTML URLs. Keep the historical logical cache key, but
// request its one known canonical transport directly; never follow redirects.
const FALLBACK_TRANSPORT = "/offline";
const TRAINING_PREFIX = "braiz-training-";
const INSTALLED = "/training/installed.json";
// BEGIN TRAINING PIN
const TRAINING_PIN = {"path":"/training/manifest-b851f8807838797ca5cb2ec5285ad52e6f6d023f9c6bd6717f1d7c80284e91be.json","sha256":"b851f8807838797ca5cb2ec5285ad52e6f6d023f9c6bd6717f1d7c80284e91be","bytes":999,"packSha256":"ace47abbbeda8bebf838d0dbe14982e8a0557b42f0ab166882f36fb53309c061","totalBytes":256074,"wordCount":208,"puzzleCount":3};
// END TRAINING PIN

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch(FALLBACK_TRANSPORT, { cache: "reload", redirect: "error" });
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
    // Preserve every installed training version. A worker update is not consent
    // to remove an offline pack or to interrupt a running game.
  })());
});

async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
async function verifiedResponse(response, asset) {
  if (!response?.ok) throw new Error("Un fichier du pack est indisponible. Réessayez en ligne.");
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== asset.bytes || await digest(bytes) !== asset.sha256) throw new Error("Un fichier du pack est altéré. Téléchargement refusé ; anciens fichiers conservés.");
  return response;
}
function validManifest(m) {
  return m?.schema === 1 && /^[a-f0-9]{64}$/.test(m.packSha256) && m.puzzleCount === 3 && Number.isInteger(m.wordCount) && m.wordCount > 0 && m.wordCount <= 500 && Number.isInteger(m.totalBytes) && m.totalBytes < 4000000 && Array.isArray(m.assets) && m.assets.length === 4 && new Set(m.assets.map(a => a.path)).size === 4 && m.assets.every(a => /^\/training\/(pack|shell|style|screen)-[a-f0-9]{64}\.(json|js|css|html)$/.test(a.path) && a.path.includes(a.sha256) && /^[a-f0-9]{64}$/.test(a.sha256) && Number.isInteger(a.bytes) && a.bytes > 0 && a.bytes < 2000000) && m.assets.some(a => a.path === m.shellPath && a.path.endsWith(".html")) && m.assets.some(a => a.path === `/training/pack-${m.packSha256}.json`);
}
async function installedPacks() {
  const packs = [];
  for (const name of (await caches.keys()).filter(key => key.startsWith(TRAINING_PREFIX)).reverse()) {
    const cache = await caches.open(name);
    const marker = await cache.match(INSTALLED);
    if (!marker) continue;
    try {
      const manifest = await marker.json();
      // Every version carries an immutable manifest digest in its cache name.
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
      if (!validManifest(manifest) || !name.startsWith(`${TRAINING_PREFIX}${await digest(manifestBytes)}-`)) continue;
      packs.push({ name, cache, manifest });
    } catch { /* Reject and preserve incompatible/corrupt stored versions. */ }
  }
  return packs;
}
async function currentManifest() {
  const installed = (await installedPacks()).find(p => p.name.startsWith(`${TRAINING_PREFIX}${TRAINING_PIN.sha256}-`));
  if (installed) return installed.manifest;
  const response = await verifiedResponse(await fetch(TRAINING_PIN.path, { cache: "no-store", redirect: "error" }), TRAINING_PIN);
  const manifest = await response.json();
  if (!validManifest(manifest) || manifest.packSha256 !== TRAINING_PIN.packSha256) throw new Error("Version du pack non prise en charge. Données conservées.");
  return manifest;
}
async function completePack(pack) {
  try {
    for (const asset of pack.manifest.assets) await verifiedResponse(await pack.cache.match(asset.path), asset);
    return true;
  } catch { return false; }
}
async function trainingStatus(manifest) {
  const packs = await installedPacks();
  let ready = false;
  for (const pack of packs.filter(p => p.name.startsWith(`${TRAINING_PREFIX}${TRAINING_PIN.sha256}-`))) if (await completePack(pack)) ready = true;
  return { ready, bytes: manifest.totalBytes, wordCount: manifest.wordCount, puzzleCount: manifest.puzzleCount, packSha256: manifest.packSha256, olderVersions: packs.filter(p => !p.name.startsWith(`${TRAINING_PREFIX}${TRAINING_PIN.sha256}-`)).length, storedVersions: (await caches.keys()).filter(name => name.startsWith(TRAINING_PREFIX)).length };
}
let trainingMutation = Promise.resolve();
self.addEventListener("message", event => {
  if (event.data?.type !== "training" || !event.ports?.[0]) return;
  const port = event.ports[0];
  // Messages must come from this origin's page, with the selected pack identity.
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  const operation = async () => {
    if (event.data.packSha256 !== TRAINING_PIN.packSha256) throw new Error("Une mise à jour est disponible. Reconnectez-vous et rechargez avant de gérer le pack ; votre ancienne partie reste conservée.");
    if (!["status", "download", "remove"].includes(event.data.action)) throw new Error("Action inconnue.");
    // Removal works offline even if every stored marker is corrupt. Status can
    // show exact build-pinned scope without installing anything or using APIs.
    const manifest = event.data.action === "download" ? await currentManifest() : TRAINING_PIN;
    if (event.data.action === "remove") {
      for (const name of await caches.keys()) if (name.startsWith(TRAINING_PREFIX)) await caches.delete(name);
    }
    if (event.data.action === "download" && !(await trainingStatus(manifest)).ready) {
      // Download and validate all bytes first. Publish the completion marker LAST.
      // A failed/partial attempt never replaces an earlier usable installation.
      const responses = [];
      for (const asset of manifest.assets) {
        // Only the manifest-approved content-addressed HTML screen gets this
        // explicit clean-URL alias. Hash/size verification and logical storage
        // identities stay unchanged, including for earlier installed versions.
        const transport = asset.path === manifest.shellPath && asset.path === `/training/screen-${asset.sha256}.html` ? asset.path.slice(0, -5) : asset.path;
        responses.push(await verifiedResponse(await fetch(transport, { cache: "no-store", redirect: "error" }), asset));
      }
      const name = `${TRAINING_PREFIX}${TRAINING_PIN.sha256}-${crypto.randomUUID()}`;
      try {
        const cache = await caches.open(name);
        for (let i = 0; i < manifest.assets.length; i++) await cache.put(manifest.assets[i].path, responses[i]);
        await cache.put(INSTALLED, new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } }));
      } catch (error) { await caches.delete(name); throw error; }
    }
    const status = await trainingStatus(manifest);
    // Consent upgrades an older neutral worker only AFTER a complete, verified
    // download. Never force activation during install/status/removal/failure,
    // and never claim or reload already-open daily-game clients.
    if (event.data.action === "download" && status.ready) await self.skipWaiting();
    return status;
  };
  const pending = trainingMutation.then(operation);
  trainingMutation = pending.catch(() => undefined);
  event.waitUntil(pending.then(result => port.postMessage(result)).catch(error => port.postMessage({ error: error instanceof TypeError ? "Connexion ou stockage indisponible. Aucun téléchargement confirmé ; réessayez en ligne." : error.message || "Stockage hors ligne indisponible. Aucun téléchargement confirmé." })));
});

async function cachedTrainingAsset(path) {
  for (const pack of await installedPacks()) {
    const asset = pack.manifest.assets.find(a => a.path === path);
    if (!asset) continue;
    try { return await verifiedResponse(await pack.cache.match(path), asset); }
    catch { /* Reject bad bytes; retain the stored data for explicit removal. */ }
  }
  return null;
}
async function offlineNavigation(path) {
  if (path === "/entrainement" || path === "/entrainement/") {
    const packs = await installedPacks();
    // Prefer current immutable shell; a complete earlier version remains usable.
    packs.sort((a, b) => Number(b.name.startsWith(`${TRAINING_PREFIX}${TRAINING_PIN.sha256}-`)) - Number(a.name.startsWith(`${TRAINING_PREFIX}${TRAINING_PIN.sha256}-`)));
    for (const pack of packs) if (await completePack(pack)) return pack.cache.match(pack.manifest.shellPath);
  }
  const cache = await caches.open(CACHE);
  return await cache.match(FALLBACK) || Response.error();
}
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (/^\/training\/(pack|shell|style|screen)-[a-f0-9]{64}\.(json|js|css|html)$/.test(url.pathname)) {
    event.respondWith((async () => await cachedTrainingAsset(url.pathname) || fetch(event.request))());
    return;
  }
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => offlineNavigation(url.pathname)));
});
