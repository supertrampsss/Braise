import test from "node:test";
import assert from "node:assert/strict";
import { EMBED_ORIGIN, EMBED_PROTOCOL, validEmbedMessage, distributionHeaders } from "../lib/embed-contract";
test("embed accepts only exact origin, version and bounded messages", () => {
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "hello" }, "hello"), true);
  for (const origin of ["null", "https://evil.test", `${EMBED_ORIGIN}.evil.test`]) assert.equal(validEmbedMessage(origin, { protocol: EMBED_PROTOCOL, type: "hello" }, "hello"), false);
  for (const height of [-1, 0, 10001, "800", Infinity]) assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "resize", height }, "resize"), false);
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: "old", type: "hello" }, "hello"), false);
});
test("distribution preserves response and denies third-party framing", async () => {
  const response = distributionHeaders(new Response("private", { status: 403, headers: { "Cache-Control": "no-store", "Content-Security-Policy": "script-src 'self'" } }));
  assert.equal(response.status, 403); assert.equal(await response.text(), "private");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(response.headers.get("Content-Security-Policy"), "script-src 'self'; frame-ancestors 'self'");
});
