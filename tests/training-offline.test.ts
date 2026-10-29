import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto, randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import info from "../public/training/pack-info.json";
import manifest from "../public/training/manifest.json";
import { trainingScreenResponse } from "../lib/training-screen-transport.server";

type Event = { waitUntil?: (p: Promise<unknown>) => void; data?: { type: string; action: string; packSha256: string }; ports?: { postMessage: (result: Record<string, unknown>) => void }[]; source?: { url: string }; request?: { url: string; method: string; mode: string }; respondWith?: (p: Promise<Response>) => void };
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function harness() {
  const handlers: Record<string, (event: Event) => void> = {};
  const storage = new Map<string, Map<string, Response>>();
  const requests: string[] = [];
  const transport: { path: string; redirect: string | undefined }[] = [];
  const materialized = new WeakMap<Response, ArrayBuffer>();
  let activations = 0;
  let disconnected = false, corrupt = "", redirectPath = "", failedPut = "", injectedHtml = false;
  const open = async (name: string) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const values = storage.get(name)!;
    // Native CacheStorage owns bytes, not unread Undici Response tee branches.
    // Materialize once, then create independent bodies for every cache match.
    const copy = async (value: Response) => {
      let bytes = materialized.get(value);
      if (!bytes) { bytes = await value.clone().arrayBuffer(); materialized.set(value, bytes); }
      const response = new Response(bytes.slice(0), { status: value.status, headers: value.headers });
      materialized.set(response, bytes); return response;
    };
    return { put: async (path: string, value: Response) => { if (path === failedPut) throw new Error("quota-test"); values.set(path, await copy(value)); }, match: async (path: string) => { const value = values.get(path); return value ? copy(value) : undefined; } };
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response, TextEncoder, TypeError, crypto: { subtle: webcrypto.subtle, randomUUID },
    self: { location: { origin: "https://braiz.test" }, addEventListener: (name: string, handler: (event: Event) => void) => { handlers[name] = handler; }, skipWaiting: async () => { activations++; } },
    fetch: async (input: string | { url: string }, options?: RequestInit) => {
      if (disconnected) throw new Error("network disconnected");
      const path = typeof input === "string" ? input : new URL(input.url).pathname;
      requests.push(path);
      transport.push({ path, redirect: options?.redirect });
      // Model the deployed ASSETS clean-HTML redirect, not a plain file server.
      // An arbitrary redirect can even carry valid bytes: policy must reject it.
      if (path.endsWith(".html") || path === redirectPath) {
        if (options?.redirect === "error") throw new TypeError("redirect-refused");
        requests.push(path === redirectPath ? "/api/session" : path.slice(0, -5));
      }
      if (path === corrupt) return new Response("corrupt");
      if (path === "/api/training/screen") {
        const response = await trainingScreenResponse(new Request("https://braiz.test" + path), { fetch: async req => {
          const internalPath = new URL(req.url).pathname;
          if (internalPath === manifest.shellPath) return new Response(null, { status: 307, headers: { location: manifest.shellPath.slice(0, -5) } });
          assert.equal(internalPath, manifest.shellPath.slice(0, -5));
          return new Response(readFileSync(`public${manifest.shellPath}`), { headers: { "content-type": "text/html" } });
        } });
        // The edge modifies HTML, while the internal ASSETS binding is raw.
        const body = new Uint8Array(await response.arrayBuffer());
        return new Response(injectedHtml && response.headers.get("content-type")?.includes("text/html") ? Buffer.concat([body, Buffer.from('<script src="/cdn-cgi/challenge-platform/jsd"></script>')]) : body, { status: response.status, headers: response.headers });
      }
      if (path === "/entrainement" || path.startsWith("/api/")) throw new Error("simulated navigation failure");
      const logical = path === "/offline" || /^\/training\/screen-[a-f0-9]{64}$/.test(path) ? `${path}.html` : path;
      const body = readFileSync(`public${logical}`);
      return new Response(injectedHtml && logical === manifest.shellPath ? Buffer.concat([body, Buffer.from('<script src="/cdn-cgi/challenge-platform/jsd"></script>')]) : body, { headers: { "content-type": logical.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/json" } });
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
    return promise?.catch(error => { throw new Error(`${path}: ${error.message}`); });
  }
  return { storage, requests, transport, open, lifecycle, message, request, get activations() { return activations; }, offline: () => { disconnected = true; }, injectHTML: () => { injectedHtml = true; }, corrupt: (path: string) => { corrupt = path; }, redirect: (path: string) => { redirectPath = path; }, failPut: (path: string) => { failedPut = path; } };
}

test("hosted HTML injection does not alter the downloaded binary transport or cold cached HTML", async () => {
  const h = harness(); await h.lifecycle("install"); h.injectHTML();
  const status = await h.message("download");
  assert.equal(status.ready, true, String(status.error));
  assert.ok(h.requests.includes("/api/training/screen"));
  assert.ok(!h.requests.includes(manifest.shellPath.slice(0, -5)));
  h.offline();
  const navigation = await h.request("/entrainement"); assert.ok(navigation);
  assert.match(navigation.headers.get("content-type") ?? "", /text\/html/);
  const bytes = new Uint8Array(await navigation.arrayBuffer());
  assert.equal(bytes.byteLength, 603); assert.equal(digest(bytes), manifest.assets.find(asset => asset.path === manifest.shellPath)!.sha256);
});

test("installation and status never download a pack; exact total includes all shell files and metadata", async () => {
  const h = harness(); await h.lifecycle("install");
  const status = await h.message("status");
  assert.equal(status.ready, false); assert.equal(status.bytes, manifest.totalBytes);
  assert.deepEqual(h.requests, ["/offline"]);
  assert.deepEqual([...h.storage.get("braise-offline-v3")!.keys()], ["/offline.html"]);
  assert.equal(manifest.totalBytes, manifest.assets.reduce((n, a) => n + a.bytes, 0) + readFileSync("public/training/manifest.json").byteLength);
  assert.deepEqual([...h.storage.keys()], ["braise-offline-v3"]);
  assert.equal(h.activations, 0);
});

test("explicit download persists complete immutable standalone shell, CSS, JS and pack, supports cold navigation/reload in worker harness", async () => {
  const h = harness(); await h.lifecycle("install");
  const status = await h.message("download"); assert.equal(status.ready, true);
  assert.equal(h.activations, 1);
  assert.ok(h.requests.includes("/api/training/screen"));
  assert.ok(!h.requests.includes(manifest.shellPath));
  assert.ok(!h.requests.includes(manifest.shellPath.slice(0, -5)));
  assert.ok(h.transport.every(request => request.redirect === "error"));
  const saved = [...h.storage.entries()].find(([name]) => name.startsWith("braiz-training-"))![1];
  assert.ok(saved.has(manifest.shellPath));
  assert.ok(!saved.has(manifest.shellPath.slice(0, -5)));
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
  const beforeRemoval = h.activations;
  await h.message("remove");
  assert.equal(h.activations, beforeRemoval);
});

test("binary screen transport refuses arbitrary redirects like fallback and JSON without following them", async () => {
  const fallback = harness(); fallback.redirect("/offline");
  await assert.rejects(fallback.lifecycle("install"), /redirect-refused/);
  assert.deepEqual(fallback.requests, ["/offline"]);
  assert.equal(fallback.storage.size, 0);
  for (const path of ["/api/training/screen", info.path]) {
    const h = harness(); await h.lifecycle("install"); h.redirect(path);
    assert.ok((await h.message("download")).error);
    assert.ok(!h.requests.includes("/api/session"));
    assert.equal(h.storage.size, 1);
    assert.equal(h.activations, 0);
    assert.ok(h.transport.every(request => request.redirect === "error"));
  }
});

test("binary screen bytes still require the pinned hash before becoming an installed pack", async () => {
  const h = harness(); await h.lifecycle("install"); h.corrupt("/api/training/screen");
  assert.match(String((await h.message("download")).error), /altéré/);
  assert.equal(h.storage.size, 1);
  assert.equal((await h.message("status")).ready, false);
  assert.equal(h.activations, 0);
});

test("a rejected binary-screen redirect preserves earlier installation, logical keys and offline recovery across activation", async () => {
  const h = harness(); await h.lifecycle("install");
  const old = { ...manifest, totalBytes: manifest.totalBytes + 1 };
  const name = `braiz-training-${digest(JSON.stringify(old))}-previous`;
  const cache = await h.open(name);
  for (const asset of old.assets) await cache.put(asset.path, new Response(readFileSync(`public${asset.path}`)));
  await cache.put("/training/installed.json", Response.json(old));
  h.redirect("/api/training/screen");
  assert.equal((await h.message("status")).olderVersions, 1);
  assert.ok((await h.message("download")).error);
  assert.equal(h.activations, 0);
  assert.ok(!h.requests.includes("/api/session"));
  await h.lifecycle("activate");
  assert.equal((await h.message("status")).olderVersions, 1);
  assert.ok(h.storage.has(name));
  assert.deepEqual(await h.storage.get(name)!.get("/training/installed.json")!.clone().json(), old);
  assert.deepEqual([...h.storage.get(name)!.keys()], [...old.assets.map(asset => asset.path), "/training/installed.json"]);
  h.offline();
  assert.match(await (await h.request("/entrainement"))!.text(), /training-root/);
  assert.equal((await h.message("status")).olderVersions, 1);
});

test("partial cache-write failure cannot activate the waiting worker or replace an older offline installation", async () => {
  const h = harness(); await h.lifecycle("install");
  const old = { ...manifest, totalBytes: manifest.totalBytes + 1 };
  const name = `braiz-training-${digest(JSON.stringify(old))}-previous`;
  const cache = await h.open(name);
  for (const asset of old.assets) await cache.put(asset.path, new Response(readFileSync(`public${asset.path}`)));
  await cache.put("/training/installed.json", Response.json(old));
  h.failPut(manifest.assets[1].path);
  assert.match(String((await h.message("download")).error), /quota-test/);
  assert.equal(h.activations, 0);
  assert.deepEqual([...h.storage.keys()], ["braise-offline-v3", name]);
  h.offline(); assert.match(await (await h.request("/entrainement"))!.text(), /training-root/);
});

test("a previous complete manifest with a different immutable screen path remains usable offline without the new endpoint", async () => {
  const h = harness(); await h.lifecycle("install");
  const oldBytes = Buffer.concat([readFileSync(`public${manifest.shellPath}`), Buffer.from("\n<!-- previous-screen-fixture -->")]);
  const oldHash = digest(oldBytes), oldPath = `/training/screen-${oldHash}.html`;
  const old = { ...manifest, shellPath: oldPath, totalBytes: manifest.totalBytes + oldBytes.byteLength - 603, assets: manifest.assets.map(asset => asset.path === manifest.shellPath ? { path: oldPath, sha256: oldHash, bytes: oldBytes.byteLength } : asset) };
  const name = `braiz-training-${digest(JSON.stringify(old))}-previous-screen`;
  const cache = await h.open(name);
  for (const asset of old.assets) await cache.put(asset.path, new Response(asset.path === oldPath ? oldBytes : readFileSync(`public${asset.path}`), { headers: { "content-type": asset.path === oldPath ? "text/html" : "application/octet-stream" } }));
  await cache.put("/training/installed.json", Response.json(old));
  h.offline(); await h.lifecycle("activate");
  const navigation = await h.request("/entrainement"); assert.ok(navigation);
  assert.equal(navigation.headers.get("content-type"), "text/html"); assert.equal(digest(new Uint8Array(await navigation.arrayBuffer())), oldHash);
  const screen = await h.request(oldPath, "cors"); assert.ok(screen); assert.equal(digest(new Uint8Array(await screen.arrayBuffer())), oldHash);
  assert.equal((await h.message("status")).olderVersions, 1); assert.ok((await h.message("download")).error);
  assert.ok(h.storage.has(name)); assert.equal(h.activations, 0); assert.ok(!h.requests.includes("/api/training/screen"));
});

test("worker never caches or intercepts daily/auth APIs, mutations, arbitrary scripts or personal pages", async () => {
  const h = harness(); await h.lifecycle("install"); await h.message("download");
  for (const path of ["/api/game", "/api/session", "/api/sync", "/api/duels", "/api/recovery", "/api/training/screen"]) assert.equal(await h.request(path), undefined);
  assert.equal(await h.request("/private.js", "cors"), undefined);
  assert.equal(await h.request("/entrainement", "navigate", "POST"), undefined);
  h.offline();
  assert.match(await (await h.request("/?surface=profile"))!.text(), /Vous êtes hors connexion/);
  assert.deepEqual(h.requests.filter(path => path.startsWith("/api/")), ["/api/training/screen"]);
  for (const cache of h.storage.values()) assert.ok([...cache.keys()].every(path => !path.startsWith("/api/")));
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
  assert.match(await (await h.request("/entrainement"))!.text(), /Vous êtes hors connexion/);
  assert.deepEqual(await h.storage.get(oldName)!.get("/training/installed.json")!.clone().json(), future);
  // Explicit removal works without a readable manifest or network.
  assert.equal((await h.message("remove")).ready, false);
  assert.ok(!h.storage.has(oldName)); assert.ok(h.storage.has("braise-offline-v3"));
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
  await h.message("remove"); assert.ok(h.storage.has("unrelated")); assert.ok(h.storage.has("braise-offline-v3"));
});
