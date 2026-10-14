import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppNavigation, APP_NAVIGATION, navigationBackHref } from "../components/app-navigation";
import { ACTION_LABELS, formatDateFr, formatNumberFr, formatScoreFr } from "../lib/format-fr";
import { clearProductDiagnostics, exportProductDiagnostics, PRODUCT_EVENTS_CAP, PRODUCT_EVENTS_KEY, readProductEvents, recordProductEvent } from "../lib/product-events";
import { DISTRIBUTION } from "../lib/distribution";
import { EXTRA_MODES_ENABLED, PUBLIC_ORIGIN } from "../lib/release";
import { EMBED_ORIGIN, validEmbedMessage, EMBED_PROTOCOL } from "../lib/embed-contract";
import { durationMs, runProcess, runSite, siteEnvironment } from "../scripts/run-site.mjs";

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test("French formatting uses integer degrees, Paris dates and explicit unknowns without score conversion", () => {
  assert.equal(formatScoreFr(12.345), "12"); assert.equal(formatScoreFr(35.79), "36");
  assert.equal(formatScoreFr(-9.9), "-10"); assert.equal(formatScoreFr(100), "100");
  assert.equal(formatNumberFr(1234).replace(/\s/g, " "), "1 234");
  for (const unknown of [null, undefined, NaN, Infinity]) assert.equal(formatScoreFr(unknown), "Non disponible");
  assert.equal(formatDateFr("2026-10-12"), "12 octobre 2026");
  assert.equal(formatDateFr("2026-10-11T23:30:00Z"), "12 octobre 2026");
  assert.equal(formatDateFr(null), "Date inconnue"); assert.equal(ACTION_LABELS.propose, "Proposer");
  assert.equal(formatDateFr("2026-02-30"), "Date inconnue");
});
test("navigation has one collapsed menu, three destinations and only internal return paths", () => {
  const html=renderToStaticMarkup(createElement(AppNavigation,{active:'explore',modeName:'Intégration',backHref:'https://evil.test'}));
  assert.match(html,/aria-label="Ouvrir le menu"/);assert.match(html,/data-state="closed"/);
  assert.doesNotMatch(html,/<nav|evil.test/);
  assert.deepEqual(APP_NAVIGATION.map(item=>[item.label,item.href]),[['Jouer','/'],['Parties','/?surface=explore'],['Profil','/?surface=profile']]);
  for(const href of ['https://evil.test','//evil.test','/\\evil.test','/\t/evil.test'])assert.equal(navigationBackHref(href),'/');
  assert.equal(navigationBackHref('/?libre=042'),'/?libre=042');
});

test("local ledger caps real events, exports no user text and never transmits", () => {
  const store = storage(); const at = new Date("2026-10-12T10:00:00.000Z");
  for (let index = 0; index < 105; index++) assert.equal(recordProductEvent(store, "guessAccepted", "daily", new Date(at.getTime() + index)), true);
  const state = readProductEvents(store); assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.equal(state.ledger.events.length, PRODUCT_EVENTS_CAP);
  assert.equal(state.ledger.events[0].occurredAt, "2026-10-12T10:00:00.005Z");
  const output = JSON.parse(exportProductDiagnostics(store, at)!);
  assert.equal(output.format, "braiz-local-diagnostics");
  assert.deepEqual(Object.keys(output.events[0]).sort(), ["context", "occurredAt", "type"]);
  assert.equal(recordProductEvent(store, "secretword" as never, "daily"), false);
  assert.equal(recordProductEvent(store, "guessAccepted", "pseudonym" as never), false);
  assert.equal(clearProductDiagnostics(store), true); assert.equal(store.values.size, 0);
});
test("corrupt, future and sensitive ledger records are preserved without mutation", () => {
  const store = storage();
  for (const raw of ["{broken", JSON.stringify({ version: 2, events: [] }), JSON.stringify({ version: 1, events: [{ type: "guessAccepted", context: "daily", occurredAt: "2026-10-12T10:00:00.000Z", word: "private" }] }), "a".repeat(32769)]) {
    store.setItem(PRODUCT_EVENTS_KEY, raw);
    assert.equal(readProductEvents(store).status, "unavailable");
    assert.equal(recordProductEvent(store, "gameOpened", "free"), false);
    assert.equal(exportProductDiagnostics(store), null); assert.equal(store.getItem(PRODUCT_EVENTS_KEY), raw);
  }
  const unavailable = { getItem: () => { throw new Error("denied"); }, setItem() {}, removeItem() {} };
  assert.equal(recordProductEvent(unavailable, "gameOpened", "daily"), false);
});
test("distribution follows public origin with advanced entry enabled and unauthorized partner frames closed", () => {
  assert.equal(DISTRIBUTION.origin, PUBLIC_ORIGIN); assert.equal(DISTRIBUTION.embedUrl, `${PUBLIC_ORIGIN}/embed`);
  assert.equal(EMBED_ORIGIN, PUBLIC_ORIGIN); assert.equal(EXTRA_MODES_ENABLED, true);
  for (const origin of ["null", "https://partner.test", `${PUBLIC_ORIGIN}:444`, `${PUBLIC_ORIGIN}.evil.test`]) assert.equal(validEmbedMessage(origin, { protocol: EMBED_PROTOCOL, type: "hello" }, "hello"), false);
});
test("portable runner preserves child failure, missing-command errors and bounded timeouts", async () => {
  assert.equal(await runProcess(process.execPath, ["-e", "process.exit(23)"], { stdio: "ignore" }), 23);
  assert.equal(await runProcess("braiz-command-that-does-not-exist", [], { stdio: "ignore" }), 69);
  assert.equal(await runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeoutMs: 150, killAfterMs: 150, stdio: "ignore" }), 124);
  assert.equal(await runSite("unknown"), 64);
  assert.equal(durationMs("3m", 1), 180000); assert.equal(durationMs("50ms", 1), 50);
  assert.throws(() => durationMs("0s", 1));
  const env = await siteEnvironment({ NODE_ENV: "test", HOME: "keep-home", USERPROFILE: "keep-profile" });
  assert.equal(env.HOME, "keep-home"); assert.equal(env.USERPROFILE, "keep-profile"); assert.equal(env.WRANGLER_WRITE_LOGS, "false");
});
