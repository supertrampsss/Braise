import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function harness() {
  const handlers: Record<string, (event: any) => void> = {};
  const stored = new Map<string, Response>();
  const removed: string[] = [];
  let offline = false;
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response,
    self: { location: { origin: "https://braise.test" }, addEventListener: (name: string, handler: any) => handlers[name] = handler },
    fetch: async () => { if (offline) throw new Error("network"); return new Response("public fallback", { headers: { "content-type": "text/html" } }); },
    caches: { open: async () => ({ put: async (key: string, value: Response) => stored.set(key, value), match: async (key: string) => stored.get(key) }), keys: async () => ["braise-offline-v0", "braise-offline-v1", "unrelated"], delete: async (key: string) => removed.push(key) },
  });
  return { handlers, stored, removed, disconnect: () => offline = true };
}

test("offline cache contains only the neutral fallback and preserves unrelated storage", async () => {
  const h = harness(); let pending: Promise<unknown> = Promise.resolve();
  h.handlers.install({ waitUntil: (p: Promise<unknown>) => pending = p }); await pending;
  assert.deepEqual([...h.stored.keys()], ["/offline.html"]);
  h.handlers.activate({ waitUntil: (p: Promise<unknown>) => pending = p }); await pending;
  assert.deepEqual(h.removed, ["braise-offline-v0"]);
});

test("offline worker ignores API, foreign origins and mutations", () => {
  const h = harness();
  for (const [url, method, mode] of [["https://braise.test/api/session", "GET", "navigate"], ["https://other.test/", "GET", "navigate"], ["https://braise.test/", "POST", "navigate"], ["https://braise.test/private", "GET", "cors"]]) {
    h.handlers.fetch({ request: { url, method, mode }, respondWith: () => assert.fail("request intercepted") });
  }
});

test("navigation network failure returns an honest fallback, not cached personal content", async () => {
  const h = harness(); let pending: Promise<unknown> = Promise.resolve();
  h.handlers.install({ waitUntil: (p: Promise<unknown>) => pending = p }); await pending;
  h.disconnect();
  let response: Promise<Response> = Promise.resolve(Response.error());
  h.handlers.fetch({ request: { url: "https://braise.test/espace", method: "GET", mode: "navigate" }, respondWith: (p: Promise<Response>) => response = p });
  assert.equal(await (await response).text(), "public fallback");
  assert.deepEqual([...h.stored.keys()], ["/offline.html"]);
});
