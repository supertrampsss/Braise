import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { ServerStore } from "../lib/server-store";
import { CircleStore } from "../lib/circle-store";
import { DuelStore } from "../lib/duel-store";
import { StudioStore } from "../lib/studio-store";
import { compareRound } from "../lib/duel-rules";
import { randomToken, tokenHash, validMutationOrigin, sessionCookie, BRAISE_ORIGIN } from "../lib/server-security";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const statement of readFileSync("drizzle/0000_young_eternity.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0001_wakeful_zuras.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0002_colossal_spirit.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0003_same_morlun.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0004_minor_ravenous.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
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
  return { sqlite, store: new ServerStore(d1), circles: new CircleStore(d1), duels: new DuelStore(d1), studio: new StudioStore(d1) };
}
test("completed duels free the active quota and concurrent retries remain neutral", async () => {
  const { sqlite, store, duels } = database(); const ta = randomToken(), tb = randomToken();
  await store.createGuest("A", ta, "csrf", 100); await store.createGuest("B", tb, "csrf", 100);
  const a = (await store.session(ta, 101))!, b = (await store.session(tb, 101))!;
  for (let i = 0; i < 10; i++) {
    const token = randomToken(); await duels.create(a, `completed${i}`, token, [0, 1, 2], 102); await duels.accept(b, token, 103);
    for (const player of [a, b]) for (let round = 0; round < 3; round++) {
      await duels.submit(player, `completed${i}`, round, 0, `r${round}`, { word: "fixture", rank: 1, temperature: 100, found: true }, 104);
    }
    assert.equal((await duels.view(a.guest_id, `completed${i}`, 105))?.state, "finished");
  }
  const token = randomToken(); assert.ok(await duels.create(a, "next", token, [0, 1, 2], 106)); assert.ok(await duels.accept(b, token, 107));
  const results = await Promise.all([1, 2].map(() => duels.submit(a, "next", 0, 0, "same", { word: "fixture", rank: 100, temperature: 10, found: false }, 108)));
  assert.deepEqual(results.sort(), ["accepted", "replayed"]);
  sqlite.close();
});
test("circle participation cannot bypass the common game quota", async () => {
  const { sqlite, store, circles } = database(); const token = randomToken(); await store.createGuest("A", token, "csrf", 100);
  const session = (await store.session(token, 101))!; await circles.create(session, "circle", "Test", 102);
  const challenge = (await circles.challenge(session, "circle", "2026-09-07", "123", 103))!;
  const game = await circles.enter(session, challenge.id, 104); assert.ok(game);
  for (let i = 0; i < 99; i++) await store.createAuthorizedGame(session, `game${i}`, "123", 105);
  assert.equal(await circles.enter(session, challenge.id, 106), game);
  const next = (await circles.challenge(session, "circle", "2026-09-14", "456", 107))!;
  assert.equal(await circles.enter(session, next.id, 108), null);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM braise_server_games").get() as { count: number }).count, 100);
  sqlite.close();
});
test("studio preserves draft concurrency, immutable editions and withdrawal across all game routes", async () => {
  const { sqlite, store, studio } = database(); const ta = randomToken(), tb = randomToken();
  await store.createGuest("Author", ta, "csrf", 100); await store.createGuest("Reader", tb, "csrf", 100);
  const a = (await store.session(ta, 101))!, b = (await store.session(tb, 101))!;
  const title = "Trois étincelles", entries = ["nature-v1:0", "nature-v1:1"];
  assert.equal(await studio.save(a, "bad", -1, "Unreviewed title", entries, 102), null);
  assert.equal((await studio.save(a, "draft", -1, title, entries, 102))?.revision, 0);
  assert.equal(await studio.draft(b.guest_id, "draft"), null);
  assert.equal(await studio.save(b, "draft", 0, title, entries, 103), null);
  const edition = (await studio.publish(a, "draft", 0, 104))!;
  assert.equal((await studio.publish(a, "draft", 0, 105))?.id, edition.id);
  assert.equal((await studio.save(a, "draft", 0, title, ["nature-v1:2"], 106))?.revision, 1);
  assert.equal(await studio.save(a, "draft", 0, title, entries, 107), null);
  assert.equal((await studio.edition(edition.id))?.entries, JSON.stringify([{ id: "nature-v1:0", seed: "1000000046" }, { id: "nature-v1:1", seed: "1000000038" }]));
  const first = (await studio.enter(b, edition.id, 108))!;
  assert.equal(await studio.enter(b, edition.id, 109), first);
  assert.equal((await studio.progress(b.guest_id, edition.id))?.completed, 0);
  assert.equal(JSON.stringify(await studio.progress(b.guest_id, edition.id)).includes("nature-v1"), false);
  await store.submit(b, first, 0, "win", { word: "fixture", temperature: 100, rank: 1, found: true }, 110);
  const second = (await studio.enter(b, edition.id, 111))!;
  assert.notEqual(second, first);
  await studio.withdraw(b, edition.id, 112); assert.ok(await studio.edition(edition.id));
  await studio.withdraw(a, edition.id, 113);
  assert.equal(await studio.progress(b.guest_id, edition.id), null);
  assert.equal(await store.game(b.guest_id, second), null);
  assert.equal(await store.publicView(b.guest_id, second), null);
  assert.equal(await store.submit(b, second, 0, "after", { word: "fixture", temperature: 100, rank: 1, found: true }, 114), "conflict");
  sqlite.close();
});
test("duels accept one opponent, freeze targets, hide facts and enforce exact deadline", async () => {
  const { sqlite, store, duels } = database(); const tokens = [randomToken(), randomToken(), randomToken()];
  for (let i = 0; i < 3; i++) await store.createGuest(`Player${i}`, tokens[i], "csrf", 100);
  const [a, b, c] = await Promise.all(tokens.map(async token => (await store.session(token, 101))!));
  const invite = randomToken();
  await duels.create(a, "duel", invite, [0, 1, 2], 102);
  await duels.create(a, "duel", invite, [3, 4, 5], 103);
  assert.equal((await duels.get(a.guest_id, "duel"))?.targets, "[0,1,2]");
  assert.equal(await duels.accept(a, invite, 104), null);
  assert.ok(await duels.accept(b, invite, 105));
  assert.ok(await duels.accept(b, invite, 106));
  assert.equal(await duels.accept(c, invite, 107), null);
  const deadline = (await duels.get(a.guest_id, "duel"))!.deadline!;
  assert.equal(deadline, 105 + 48 * 3600000);
  const result = { word: "arbre", temperature: 10, rank: 10, found: false };
  assert.equal(await duels.submit(a, "duel", 0, 0, "a1", result, 108), "accepted");
  assert.equal(await duels.submit(a, "duel", 0, 0, "a1", result, 109), "replayed");
  assert.equal(await duels.submit(a, "duel", 1, 0, "a1", result, 109), "conflict");
  assert.equal(await duels.submit(c, "duel", 0, 0, "c1", result, 110), "conflict");
  const opposingView = (await duels.view(b.guest_id, "duel", 111))!;
  assert.equal(opposingView.guesses.length, 0); assert.equal(JSON.stringify(opposingView).includes("arbre"), false);
  assert.equal(Object.hasOwn(opposingView, "targets"), false);
  assert.equal(await store.publicView(a.guest_id, "duel"), null);
  assert.equal(await duels.submit(b, "duel", 0, 0, "b1", result, deadline), "conflict");
  assert.equal((await duels.view(a.guest_id, "duel", deadline))?.state, "finished");
  assert.deepEqual((await duels.view(a.guest_id, "duel", deadline))?.decisions, [-1, 0, 0]);
  sqlite.close();
});
test("duel cap, winning closure, revocation and unaccepted expiry are factual", async () => {
  const { sqlite, store, duels } = database(); const ta = randomToken(), tb = randomToken();
  await store.createGuest("A", ta, "csrf", 100); await store.createGuest("B", tb, "csrf", 100);
  const a = (await store.session(ta, 101))!, b = (await store.session(tb, 101))!; const invite = randomToken();
  await duels.create(a, "duel", invite, [0, 1, 2], 102); await duels.accept(b, invite, 103);
  for (let i = 0; i < 30; i++) assert.equal(await duels.submit(a, "duel", 0, i, `a${i}`, { word: `fixture${i}`, temperature: 1, rank: 100, found: false }, 104 + i), "accepted");
  assert.equal(await duels.submit(a, "duel", 0, 30, "overflow", { word: "extra", temperature: 1, rank: 90, found: false }, 200), "conflict");
  assert.equal(await duels.submit(b, "duel", 0, 0, "won", { word: "cible", temperature: 100, rank: 1, found: true }, 201), "accepted");
  assert.equal(await duels.submit(b, "duel", 0, 1, "late", { word: "apres", temperature: 1, rank: 90, found: false }, 202), "conflict");
  await store.revokeSession(a);
  assert.equal(await duels.submit(a, "duel", 1, 0, "revoked", { word: "mot", temperature: 1, rank: 90, found: false }, 203), "conflict");
  await duels.end(b, "duel", true, 204);
  assert.equal((await duels.view(b.guest_id, "duel", 205))?.forfeiter, "opponent");
  const second = randomToken(); await duels.create(b, "unaccepted", second, [0, 1, 2], 300);
  const expired = await duels.view(b.guest_id, "unaccepted", 300 + 7 * 86400000);
  assert.equal(expired?.state, "expired"); assert.equal(expired?.decisions, null);
  const facts = { found: true, attempts: 4, bestRank: 1, closed: true };
  assert.equal(compareRound(facts, { ...facts }), 0);
  assert.equal(compareRound(facts, { ...facts, attempts: 5 }), -1);
  sqlite.close();
});
test("circles preserve invitation replay, common targets and exclusion across generic game APIs", async () => {
  const { sqlite, store, circles } = database();
  const a = randomToken(), b = randomToken(), c = randomToken();
  await store.createGuest("Owner", a, "csrf", 100); await store.createGuest("Member", b, "csrf", 100); await store.createGuest("Outsider", c, "csrf", 100);
  const owner = (await store.session(a, 101))!, member = (await store.session(b, 101))!, outsider = (await store.session(c, 101))!;
  await circles.create(owner, "circle", "Test", 101);
  assert.equal(await circles.details(outsider.guest_id, "circle"), null);
  const invite = randomToken();
  assert.equal(await circles.invite(member, "circle", invite, 102), false);
  assert.equal(await circles.invite(owner, "circle", invite, 102), true);
  assert.equal(await circles.invite(owner, "circle", invite, 103), true);
  await circles.join(member, invite, 104); await circles.join(member, invite, 105);
  assert.equal((sqlite.prepare("SELECT uses FROM braise_circle_invites").get() as { uses: number }).uses, 1);
  const challenge = (await circles.challenge(owner, "circle", "2026-09-07", "123", 106))!;
  assert.equal((await circles.challenge(member, "circle", "2026-09-07", "456", 107))?.id, challenge.id);
  const game = (await circles.enter(member, challenge.id, 108))!;
  assert.equal(await circles.enter(member, challenge.id, 109), game);
  assert.equal((await store.game(member.guest_id, game))?.seed, "123");
  assert.equal(await store.submit(member, game, 0, "request", { word: "arbre", temperature: 1, rank: 40, found: false }, 110), "accepted");
  assert.equal((await circles.results(owner.guest_id, challenge.id)).length, 1);
  assert.equal((await circles.results(outsider.guest_id, challenge.id)).length, 0);
  await circles.exclude(member, "circle", owner.guest_id, 111);
  assert.ok(await circles.member(owner.guest_id, "circle"));
  await circles.exclude(owner, "circle", member.guest_id, 112);
  assert.equal(await circles.join(member, invite, 113), null);
  assert.equal(await store.game(member.guest_id, game), null);
  assert.equal(await store.publicView(member.guest_id, game), null);
  assert.equal((await store.listGames(member.guest_id)).length, 0);
  assert.equal(await store.submit(member, game, 1, "next", { word: "mer", temperature: 2, rank: 30, found: false }, 114), "conflict");
  await circles.revokeInvites(owner, "circle", 115);
  assert.equal(await circles.join(outsider, invite, 116), null);
  sqlite.close();
});
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
test("recovery rotates sessions, consumes code once and retries lost response safely", async () => {
  const { sqlite, store } = database(); const token = randomToken();
  const guest = await store.createGuest("Test", token, "csrf", 100); const session = (await store.session(token, 101))!;
  const code = randomToken(), replacement = randomToken();
  assert.equal(await store.setRecoveryCode(session, code, 102), true);
  assert.equal(await store.recover(code, replacement, "new-csrf", 102), null);
  assert.equal(await store.confirmRecoveryCode(session, code, 102), true);
  const undelivered = randomToken();
  assert.equal(await store.setRecoveryCode(session, undelivered, 102), true);
  assert.equal(await store.recover(undelivered, randomToken(), "pending", 102), null);
  const result = await store.recover(code, replacement, "new-csrf", 103);
  assert.equal(result?.guest_id, guest.id); assert.equal(await store.session(token, 104), null);
  assert.equal((await store.recover(code, replacement, "new-csrf", 104))?.guest_id, guest.id);
  assert.equal(await store.recover(code, randomToken(), "other", 104), null);
  assert.equal(await store.setRecoveryCode(session, randomToken(), 104), false);
  assert.equal(await store.recover(randomToken(), randomToken(), "bad", 104), null);
  sqlite.close();
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
