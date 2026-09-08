import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { ServerStore } from "../lib/server-store";
import { randomToken, tokenHash, validMutationOrigin, sessionCookie, BRAISE_ORIGIN } from "../lib/server-security";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const statement of readFileSync("drizzle/0000_young_eternity.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='braise_guess_applies_revision'").get());
  function prepare(sql: string) {
    let values: Array<string | number | null> = [];
    return {
      bind(...args: typeof values) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
    };
  }
  const d1 = { prepare, async batch(statements: Array<ReturnType<typeof prepare>>) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } } as unknown as D1Database;
  return { sqlite, store: new ServerStore(d1) };
}
test("server sessions hash tokens, expire and isolate game ownership", async () => {
  const { sqlite, store } = database();
  const token = randomToken(); assert.equal(token.length, 64);
  const guest = await store.createGuest("Test", token, "csrf", 100);
  const session = await store.session(token, 101); assert.equal(session?.guest_id, guest.id);
  assert.equal(await store.session(token, 100 + 31 * 86400000), null);
  assert.equal((sqlite.prepare("SELECT token_hash FROM braise_sessions").get() as { token_hash: string }).token_hash, await tokenHash(token));
  await store.createGame(guest.id, "game", "1234", 100);
  assert.equal(await store.game("another-guest", "game"), null);
  sqlite.close();
});
test("atomic server guesses preserve revision, request idempotency and final state", async () => {
  const { sqlite, store } = database(); const token = randomToken();
  const guest = await store.createGuest("Test", token, "csrf", 100);
  const session = (await store.session(token, 101))!;
  await store.createGame(guest.id, "game", "1234", 100);
  const cold = { word: "arbre", temperature: 12.3456, rank: 100, found: false };
  assert.equal(await store.submit(session, "game", 0, "req1", cold, 101), "accepted");
  assert.equal(await store.submit(session, "game", 0, "req1", cold, 102), "replayed");
  assert.equal(await store.submit(session, "game", 0, "req1", { ...cold, word: "fleur" }, 102), "conflict");
  assert.equal(await store.submit(session, "game", 0, "req2", { ...cold, word: "fleur" }, 102), "conflict");
  assert.equal((await store.game(guest.id, "game"))?.revision, 1);
  assert.equal(await store.submit(session, "game", 1, "req3", { word: "fleur", temperature: 100, rank: 1, found: true }, 103), "accepted");
  assert.equal((await store.game(guest.id, "game"))?.state, "won");
  assert.equal(await store.submit(session, "game", 2, "req4", { ...cold, word: "mer" }, 104), "conflict");
  assert.equal((await store.guesses("game")).length, 2);
  const view = await store.publicView(guest.id, "game");
  assert.equal(view?.game.revision, view?.guesses.length);
  assert.equal(view?.game.state, "won"); assert.equal(view?.guesses[1].found, true);
  assert.equal(Object.hasOwn(view!.game, "seed"), false);
  sqlite.close();
});
test("session revocation and competing revisions reject stale mutations", async () => {
  const { sqlite, store } = database(); const token = randomToken();
  const guest = await store.createGuest("Test", token, "csrf", 100); const session = (await store.session(token, 101))!;
  await store.createGame(guest.id, "game", "1234", 100);
  const outcomes = await Promise.all(["arbre", "mer"].map((word, index) => store.submit(session, "game", 0, `req${index}`, { word, temperature: 10, rank: 1000, found: false }, 101)));
  assert.equal(outcomes.filter(value => value === "accepted").length, 1);
  sqlite.exec("UPDATE braise_sessions SET revoked=1");
  assert.equal(await store.submit(session, "game", 1, "revoked", { word: "fleur", temperature: 20, rank: 500, found: false }, 102), "conflict"); sqlite.close();
});
test("CSRF boundary rejects absent and foreign origins", () => {
  assert.equal(validMutationOrigin(new Request(BRAISE_ORIGIN, { headers: { Origin: BRAISE_ORIGIN, "Content-Type": "application/json" } })), true);
  assert.equal(validMutationOrigin(new Request(BRAISE_ORIGIN)), false);
  assert.equal(validMutationOrigin(new Request(BRAISE_ORIGIN, { headers: { Origin: "https://evil.test", "Content-Type": "application/json" } })), false);
  assert.equal(sessionCookie(new Request(BRAISE_ORIGIN, { headers: { Cookie: "__Host-braise_session=bad" } })), null);
});
test("game creation rechecks expiry and revocation atomically and preserves replay identity", async () => {
  const { sqlite, store } = database(); const token = randomToken();
  await store.createGuest("Test", token, "csrf", 100); const session = (await store.session(token, 101))!;
  const first = await store.createAuthorizedGame(session, "authorized", "1234", 102);
  assert.equal(first?.seed, "1234");
  assert.equal((await store.createAuthorizedGame(session, "authorized", "5678", 103))?.seed, "1234");
  assert.equal(await store.createAuthorizedGame(session, "expired", "1", 100 + 31 * 86400000), null);
  assert.equal(await store.game(session.guest_id, "expired"), null);
  await store.revokeSession(session); await store.revokeSession(session);
  assert.equal(await store.session(token, 104), null);
  assert.equal(await store.createAuthorizedGame(session, "after-revoke", "1", 104), null);
  assert.equal(await store.game(session.guest_id, "after-revoke"), null);
  assert.ok(await store.game(session.guest_id, "authorized"));
  sqlite.close();
});
