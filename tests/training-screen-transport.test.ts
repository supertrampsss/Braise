import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";
import { GET } from "../app/api/training/screen/route";
import { trainingScreenResponse } from "../lib/training-screen-transport.server";
import manifest from "../public/training/manifest.json";

const path = manifest.shellPath;
const clean = path.slice(0, -5);
const bytes = readFileSync(`public${path}`);
const endpoint = "https://braiz.test/api/training/screen";
const request = () => new Request(endpoint);
const binaryHash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const binding = (fetch: (request: Request) => Promise<Response>) => ({ fetch });
const raw = () => new Response(bytes, { headers: { "content-type": "text/html", "set-cookie": "must-not-forward=test", "cache-control": "public, max-age=999" } });

test("route serves exactly the frozen screen via one internal canonical redirect and binary no-store headers", async () => {
  const calls: Request[] = [];
  const assets = binding(async req => { calls.push(req); return new URL(req.url).pathname === path ? new Response(null, { status: 307, headers: { location: clean } }) : raw(); });
  const runtime = env as unknown as Record<string, unknown>;
  const previous = runtime.ASSETS; runtime.ASSETS = assets;
  try {
    const response = await GET(request()); assert.equal(response.status, 200);
    assert.deepEqual(calls.map(req => new URL(req.url).pathname), [path, clean]);
    assert.ok(calls.every(req => req.redirect === "manual" && req.method === "GET" && req.headers.get("cookie") === null));
    assert.equal(response.headers.get("content-type"), "application/octet-stream");
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("set-cookie"), null); assert.equal(response.headers.get("location"), null);
    const result = new Uint8Array(await response.arrayBuffer());
    assert.equal(result.byteLength, 603); assert.equal(binaryHash(result), manifest.assets.find(asset => asset.path === path)!.sha256);
  } finally { if (previous === undefined) delete runtime.ASSETS; else runtime.ASSETS = previous; }
});
test("exact direct ASSETS bytes are valid without redirect and missing binding is unavailable", async () => {
  let count = 0;
  assert.equal((await trainingScreenResponse(request(), binding(async () => { count++; return raw(); }))).status, 200);
  assert.equal(count, 1); assert.equal((await trainingScreenResponse(request(), undefined)).status, 503);
});
test("closed transport refuses query/path parameters, mutation and document navigation before any asset read", async () => {
  let calls = 0;
  const assets = binding(async () => { calls++; return raw(); });
  for (const req of [new Request(endpoint + "?path=/api/session"), new Request(endpoint + "/other"), new Request(endpoint, { method: "POST" }), new Request(endpoint, { headers: { "sec-fetch-mode": "navigate" } })]) {
    assert.ok((await trainingScreenResponse(req, assets)).status >= 400);
  }
  assert.equal(calls, 0);
});
test("only one 307 to the exact same-origin clean screen is allowed, never arbitrary redirects or loops", async () => {
  for (const location of ["https://other.test" + clean, "/api/session", clean + "?x=1", clean + "#x", `https://user@braiz.test${clean}`, path, "//braiz.test" + clean, clean + "/", "/training/../api/session"]) {
    let calls = 0;
    const response = await trainingScreenResponse(request(), binding(async () => { calls++; return new Response(null, { status: 307, headers: { location } }); }));
    assert.equal(response.status, 503, location); assert.equal(calls, 1, location);
  }
  for (const status of [301, 302, 303, 308]) {
    let calls = 0;
    assert.equal((await trainingScreenResponse(request(), binding(async () => { calls++; return new Response(null, { status, headers: { location: clean } }); }))).status, 503);
    assert.equal(calls, 1);
  }
  let calls = 0;
  assert.equal((await trainingScreenResponse(request(), binding(async () => { calls++; return new Response(null, { status: 307, headers: { location: clean } }); }))).status, 503);
  assert.equal(calls, 2);
  assert.equal((await trainingScreenResponse(request(), binding(async req => new URL(req.url).pathname === path ? new Response(null, { status: 307, headers: { location: "https://braiz.test" + clean } }) : raw()))).status, 200);
});
test("injected HTML, same-size wrong hash, oversized body, missing asset and failed ASSETS cannot become binary downloads", async () => {
  for (const response of [new Response(Buffer.concat([bytes, Buffer.from("<script>challenge</script>")])), new Response(Buffer.alloc(603, 65)), new Response(Buffer.alloc(604)), new Response(null), new Response("missing", { status: 404 }), new Response("failed", { status: 500 })]) {
    const result = await trainingScreenResponse(request(), binding(async () => response));
    assert.equal(result.status, 503); assert.equal(result.headers.get("cache-control"), "no-store");
    assert.notEqual(result.headers.get("content-type"), "text/html");
  }
  assert.equal((await trainingScreenResponse(request(), binding(async () => { throw new Error("private runtime detail"); }))).status, 503);
});
test("oversized streaming input stops at the byte cap without waiting for a noncooperative cancellation", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(604)); }, cancel() { cancelled = true; return new Promise(() => {}); } });
  const result = await trainingScreenResponse(request(), binding(async () => new Response(stream)), { timeoutMs: 100 });
  assert.equal(result.status, 503); assert.equal(cancelled, true);
});
test("noncooperative fetch/body readers and already aborted clients finish with no bytes published", async () => {
  let signal: AbortSignal | undefined;
  const hanging = await trainingScreenResponse(request(), binding(async req => { signal = req.signal; return new Promise(() => {}); }), { timeoutMs: 20 });
  assert.equal(hanging.status, 503); assert.equal(signal?.aborted, true);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; return new Promise(() => {}); } });
  assert.equal((await trainingScreenResponse(request(), binding(async () => new Response(stream)), { timeoutMs: 20 })).status, 503);
  assert.equal(cancelled, true);
  const controller = new AbortController(); controller.abort(); let calls = 0;
  assert.equal((await trainingScreenResponse(new Request(endpoint, { signal: controller.signal }), binding(async () => { calls++; return raw(); }))).status, 503);
  assert.equal(calls, 0);
});
