import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto, randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import info from "../public/training/pack-info.json";
import manifest from "../public/training/manifest.json";

type Event = { waitUntil?: (p: Promise<unknown>) => void; data?: { type: string; action: string; packSha256: string }; ports?: { postMessage: (result: Record<string, unknown>) => void }[]; source?: { url: string }; request?: { url: string; method: string; mode: string }; respondWith?: (p: Promise<Response>) => void };
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function harness() {
  const handlers: Record<string, (event: Event) => void> = {};
  const storage = new Map<string, Map<string, Response>>();
  const requests: string[] = [];
  let disconnected = false, corrupt = "";
  const open = async (name: string) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const values = storage.get(name)!;
    return { put: async (path: string, value: Response) => { values.set(path, value.clone()); }, match: async (path: string) => values.get(path)?.clone() };
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response, TextEncoder, crypto: { subtle: webcrypto.subtle, randomUUID },
    self: { location: { origin: "https://braiz.test" }, addEventListener: (name: string, handler: (event: Event) => void) => { handlers[name] = handler; } },
    fetch: async (input: string | { url: string }) => {
      if (disconnected) throw new Error("network disconnected");
      const path = typeof input === "string" ? input : new URL(input.url).pathname;
      requests.push(path);
      if (path === corrupt) return new Response("corrupt");
      if (path === "/entrainement" || path.startsWith("/api/")) throw new Error("simulated navigation failure");
      return new Response(readFileSync(`public${path}`), { headers: { "content-type": path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/json" } });
    },
    caches: { open, keys: async () => [...storage.keys()], delete: async (key: string) => storage.delete(key) },
  });
  async function lifecycle(name: string) { let promise: Promise<unknown> = Promise.resolve(); handlers[name]({ waitUntil: p => { promise = p; } }); await promise; }
  async function message(action: string, packSha256 = info.sha256) {
    let promise: Promise<unknown> = Promise.resolve(), result: Record<string, unknown> = {};
    handlers.message({ data: { type: "training", action, packSha256 }, source: { url: "https://braiz.test/entrainement" }, ports: [{ postMessage: value => { result = value; } }], waitUntil: p => { promise = p; } });
    await promise; return result;
  }
  async function request(path: string, mode = "navigate", method = "GET") {
    let promise: Promise<Response> | undefined;
    handlers.fetch({ request: { url: `https://braiz.test${path}`, mode, method }, respondWith: p => { promise = p; } });
    return promise;
  }
  return { storage, requests, open, lifecycle, message, request, offline: () => { disconnected = true; }, corrupt: (path: string) => { corrupt = path; } };
}

test("installation and status never download a pack; exact total includes all shell files and metadata", async () => {
  const h = harness(); await h.lifecycle("install");
  const status = await h.message("status");
  assert.equal(status.ready, false); assert.equal(status.bytes, manifest.totalBytes);
  assert.deepEqual(h.requests, ["/offline.html"]);
  assert.equal(manifest.totalBytes, manifest.assets.reduce((n, a) => n + a.bytes, 0) + readFileSync("public/training/manifest.json").byteLength);
  assert.deepEqual([...h.storage.keys()], ["braise-offline-v2"]);
});

test("explicit download persists complete immutable standalone shell, CSS, JS and pack, supports cold navigation/reload in worker harness", async () => {
  const h = harness(); await h.lifecycle("install");
  const status = await h.message("download"); assert.equal(status.ready, true);
  const count = h.requests.length;
  assert.equal((await h.message("download")).ready, true); assert.equal(h.requests.length, count);
  h.offline();
  for (let reload = 0; reload < 2; reload++) {
    const response = await h.request("/entrainement"); assert.ok(response);
    const html = await response.text(); assert.match(html, /training-root/);
    for (const asset of manifest.assets) {
      const file = await h.request(asset.path, "cors"); assert.ok(file); assert.equal(digest(new Uint8Array(await file.arrayBuffer())), asset.sha256);
      if (asset.path.endsWith(".js") || asset.path.endsWith(".css")) assert.ok(html.includes(asset.path));
    }
  }
  assert.equal((await h.message("status")).ready, true);
});

test("worker never caches or intercepts daily/auth APIs, mutations, arbitrary scripts or personal pages", async () => {
  const h = harness(); await h.lifecycle("install"); await h.message("download");
  for (const path of ["/api/game", "/api/session", "/api/sync", "/api/duels", "/api/recovery"]) assert.equal(await h.request(path), undefined);
  assert.equal(await h.request("/private.js", "cors"), undefined);
  assert.equal(await h.request("/entrainement", "navigate", "POST"), undefined);
  h.offline();
  assert.match(await (await h.request("/?surface=profile"))!.text(), /connexion fait une pause/);
  assert.ok(h.requests.every(path => !path.startsWith("/api/")));
  for (const [name, entries] of h.storage) if (name.startsWith("braiz-training-")) assert.ok([...entries.keys()].every(path => path.startsWith("/training/")));
});

test("failed download preserves an older complete version usable offline and rejects corrupt/future installed packs", async () => {
  const h = harness(); await h.lifecycle("install");
  const old = { ...manifest, totalBytes: manifest.totalBytes + 1 };
  const oldName = `braiz-training-${digest(JSON.stringify(old))}-previous`;
  const cache = await h.open(oldName);
  for (const asset of old.assets) await cache.put(asset.path, new Response(readFileSync(`public${asset.path}`)));
  await cache.put("/training/installed.json", Response.json(old));
  h.corrupt(info.path); assert.match(String((await h.message("download")).error), /altéré/);
  assert.ok(h.storage.has(oldName)); assert.equal(h.storage.size, 2);
  h.offline(); assert.match(await (await h.request("/entrainement"))!.text(), /training-root/);
  const future = { ...old, schema: 9 };
  await cache.put("/training/installed.json", Response.json(future));
  assert.match(await (await h.request("/entrainement"))!.text(), /connexion fait une pause/);
  assert.deepEqual(await h.storage.get(oldName)!.get("/training/installed.json")!.clone().json(), future);
  // Explicit removal works without a readable manifest or network.
  assert.equal((await h.message("remove")).ready, false);
  assert.ok(!h.storage.has(oldName)); assert.ok(h.storage.has("braise-offline-v2"));
});

test("cached score corruption is rejected, not silently used, and deletion preserves unrelated stores", async () => {
  const h = harness(); await h.lifecycle("install"); await h.message("download");
  const name = [...h.storage.keys()].find(key => key.startsWith("braiz-training-"))!;
  h.storage.get(name)!.set(info.path, new Response("corrupt"));
  h.storage.set("unrelated", new Map()); h.offline();
  assert.equal((await h.message("status")).ready, false);
  await assert.rejects(h.request(info.path, "cors"), /network/);
  assert.equal(await h.storage.get(name)!.get(info.path)!.clone().text(), "corrupt");
  assert.match(String((await h.message("download", "old-pack")).error), /mise à jour/);
  await h.message("remove"); assert.ok(h.storage.has("unrelated")); assert.ok(h.storage.has("braise-offline-v2"));
});
