import test from "node:test";
import assert from "node:assert/strict";
import { EMBED_ORIGIN, EMBED_ALLOWED_ORIGINS, EMBED_PROTOCOL, validEmbedEvent, validEmbedMessage, distributionHeaders } from "../lib/embed-contract";
test("embed accepts only exact origin, version and bounded messages", () => {
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "hello" }, "hello"), true);
  for (const origin of ["null", "https://evil.test", `${EMBED_ORIGIN}.evil.test`]) assert.equal(validEmbedMessage(origin, { protocol: EMBED_PROTOCOL, type: "hello" }, "hello"), false);
  for (const height of [-1, 0, 10001, "800", Infinity]) assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "resize", height }, "resize"), false);
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: "old", type: "hello" }, "hello"), false);
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "hello", word: "private" }, "hello"), false);
  assert.equal(validEmbedMessage(EMBED_ORIGIN, { protocol: EMBED_PROTOCOL, type: "resize", height: 800, pseudonym: "private" }, "resize"), false);
});
test("distribution preserves response and authorizes only the two controlled hosts through CSP", async () => {
  const response = distributionHeaders(new Response("private", { status: 403, headers: { "Cache-Control": "no-store", "Content-Security-Policy": "script-src 'self'" } }));
  assert.equal(response.status, 403); assert.equal(await response.text(), "private");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Frame-Options"), null);
  assert.equal(response.headers.get("Content-Security-Policy"), `script-src 'self'; frame-ancestors 'self' ${EMBED_ALLOWED_ORIGINS.join(" ")}`);
  assert.doesNotMatch(response.headers.get("Content-Security-Policy")!, /\*/);
});
test("embed validates the exact parent or frame window on both owned origins", () => {
  const expected = {} as Window; const other = {} as Window;
  for (const origin of EMBED_ALLOWED_ORIGINS) {
    const data = { protocol: EMBED_PROTOCOL, type: "hello" };
    assert.equal(validEmbedEvent({ source: expected, origin, data }, expected, "hello"), true);
    assert.equal(validEmbedEvent({ source: other, origin, data }, expected, "hello"), false);
    assert.equal(validEmbedEvent({ source: expected, origin, data }, null, "hello"), false);
    for (const denied of ["null", "http://braiz.io", `${origin}.evil.test`, `${origin}:444`, "https://partner.test"]) assert.equal(validEmbedEvent({ source: expected, origin: denied, data }, expected, "hello"), false);
  }
  const response = distributionHeaders(new Response("ok", { headers: { "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'", "X-Frame-Options": "DENY" } }));
  assert.equal(response.headers.get("Content-Security-Policy")!.split("frame-ancestors").length, 2);
  assert.match(response.headers.get("Content-Security-Policy")!, /default-src 'self'/);
});
