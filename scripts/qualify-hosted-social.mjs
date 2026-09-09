import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const origin = "https://braise-mots.yellow-drake-7186.chatgpt.site";
const siteAuthorization = process.env.BRAISE_SITES_AUTH;

if (!siteAuthorization) {
  throw new Error("BRAISE_SITES_AUTH is required and must never be written to disk or logs");
}

const facts = [];
const cleanupCandidates = [];
const hex = () => randomBytes(32).toString("hex");
const check = (condition, code) => {
  if (!condition) throw new Error(code);
};

function rawSessionCookie(response) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(/(?:^|,\s*)(__Host-braise_session=[a-f0-9]{64})/);
  return match?.[1];
}

function sessionCookie(response) {
  const header = response.headers.get("set-cookie") ?? "";
  const cookie = rawSessionCookie(response);
  const attributes = header.split(";").map(value => value.trim());
  check(cookie, "session-cookie-missing");
  check(attributes.includes("Path=/"), "session-cookie-path-invalid");
  check(attributes.includes("Secure"), "session-cookie-secure-missing");
  check(attributes.includes("HttpOnly"), "session-cookie-httponly-missing");
  check(attributes.includes("SameSite=Lax"), "session-cookie-samesite-invalid");
  return cookie;
}

async function call(path, options = {}) {
  const headers = {
    "OAI-Sites-Authorization": `Bearer ${siteAuthorization}`,
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers.origin = options.origin ?? origin;
    headers["content-type"] = "application/json";
  }
  const method = options.method ?? "GET";
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`${method}-${path.split("?")[0]}-fetch-failed`);
  }
  options.onResponse?.(response);
  check(response.headers.get("cache-control") === "no-store", "cache-control-invalid");
  check(response.headers.get("x-content-type-options") === "nosniff", "content-type-options-invalid");
  if (options.status !== undefined) {
    check(response.status === options.status, `${method}-${path.split("?")[0]}-unexpected-status-${response.status}`);
  }
  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new Error(`${method}-${path.split("?")[0]}-invalid-json`);
  }
  return { response, payload };
}

async function createGuest(label) {
  const created = await call("/api/session", {
    method: "POST",
    body: { name: `QA-${label}-${Date.now().toString(36).slice(-6)}` },
    status: 200,
    onResponse(response) {
      const cookie = rawSessionCookie(response);
      if (!cookie) return;
      const token = cookie.slice("__Host-braise_session=".length);
      cleanupCandidates.push({
        cookie,
        csrf: createHash("sha256").update(`${token}:csrf`).digest("hex"),
      });
    },
  });
  const cookie = sessionCookie(created.response);
  check(typeof created.payload.guest?.id === "string", `${label}-guest-id-invalid`);
  check(/^[a-f0-9]{64}$/.test(created.payload.csrf), `${label}-csrf-invalid`);
  const cleanup = cleanupCandidates.find(candidate => candidate.cookie === cookie);
  check(cleanup?.csrf === created.payload.csrf, `${label}-csrf-mismatch`);
  return {
    guestId: created.payload.guest.id,
    headers: { cookie, "x-braise-csrf": created.payload.csrf },
  };
}

async function revokeGuest(guest, label) {
  const deleted = await call("/api/session", {
    method: "DELETE",
    headers: guest.headers,
    body: {},
    status: 200,
  });
  check(deleted.payload.guest === null, `${label}-session-delete-invalid`);
  const revoked = await call("/api/session", {
    headers: { cookie: guest.headers.cookie },
    status: 200,
  });
  check(isDeepStrictEqual(revoked.payload, { guest: null }), `${label}-session-still-active`);
}

function containsPrivateDuelMaterial(payload, forbiddenWords) {
  const serialized = JSON.stringify(payload);
  return Object.hasOwn(payload, "targets") || forbiddenWords.some(word => serialized.includes(`\"${word}\"`));
}

let failureCode;
let owner;
let member;
let outsider;
let circleId;
let invite;
let duelId;
let duelToken;
let businessCleanupComplete = false;

try {
  owner = await createGuest("owner");
  member = await createGuest("member");
  outsider = await createGuest("outsider");
  facts.push("three-isolated-hosted-guests-created");

  circleId = randomUUID();
  const circle = await call("/api/circles", {
    method: "POST",
    headers: owner.headers,
    body: { action: "create", id: circleId, name: "Cercle QA hébergé" },
    status: 200,
  });
  check(circle.payload.id === circleId, "circle-id-mismatch");
  check(circle.payload.owner_id === owner.guestId, "circle-owner-mismatch");

  await call(`/api/circles?id=${circleId}`, { headers: outsider.headers, status: 404 });
  invite = hex();
  const invited = await call("/api/circles", {
    method: "POST",
    headers: owner.headers,
    body: { action: "invite", id: circleId, token: invite },
    status: 200,
  });
  check(invited.payload.created === true, "circle-invite-not-created");

  const joined = await call("/api/circles", {
    method: "POST",
    headers: member.headers,
    body: { action: "join", token: invite },
    status: 200,
  });
  const rejoined = await call("/api/circles", {
    method: "POST",
    headers: member.headers,
    body: { action: "join", token: invite },
    status: 200,
  });
  check(joined.payload.circle_id === circleId, "circle-join-mismatch");
  check(isDeepStrictEqual(rejoined.payload, joined.payload), "circle-rejoin-changed-result");

  const ownerWeekly = await call("/api/circles", {
    method: "POST",
    headers: owner.headers,
    body: { action: "weekly", id: circleId },
    status: 200,
  });
  const memberWeekly = await call("/api/circles", {
    method: "POST",
    headers: member.headers,
    body: { action: "weekly", id: circleId },
    status: 200,
  });
  check(ownerWeekly.payload.id === memberWeekly.payload.id, "weekly-challenge-not-shared");
  check(ownerWeekly.payload.week === memberWeekly.payload.week, "weekly-date-not-shared");

  const entered = await call("/api/circles", {
    method: "POST",
    headers: member.headers,
    body: { action: "enter", id: circleId, challenge: ownerWeekly.payload.id },
    status: 200,
  });
  const reentered = await call("/api/circles", {
    method: "POST",
    headers: member.headers,
    body: { action: "enter", id: circleId, challenge: ownerWeekly.payload.id },
    status: 200,
  });
  check(typeof entered.payload.game === "string", "circle-game-id-missing");
  check(reentered.payload.game === entered.payload.game, "circle-enter-not-idempotent");

  const circleGuess = await call("/api/server-games", {
    method: "POST",
    headers: member.headers,
    body: { action: "guess", id: entered.payload.game, requestId: randomUUID(), revision: 0, word: "maison" },
    status: 200,
  });
  check(circleGuess.payload.game?.revision === 1, "circle-game-revision-invalid");
  check(circleGuess.payload.guesses?.[0]?.word === "maison", "circle-game-word-invalid");
  check(Number.isInteger(circleGuess.payload.guesses?.[0]?.rank), "circle-game-rank-invalid");

  const ownerResults = await call(`/api/circles?id=${circleId}&challenge=${ownerWeekly.payload.id}`, {
    headers: owner.headers,
    status: 200,
  });
  check(ownerResults.payload.results?.length === 1, "circle-results-count-invalid");
  check(ownerResults.payload.results[0]?.revision === 1, "circle-result-revision-invalid");
  facts.push("circle-membership-weekly-game-and-results-qualified");

  await call("/api/circles", {
    method: "POST",
    headers: owner.headers,
    body: { action: "exclude", id: circleId, guest: member.guestId },
    status: 200,
  });
  await call(`/api/circles?id=${circleId}`, { headers: member.headers, status: 404 });
  await call(`/api/server-games?id=${entered.payload.game}`, { headers: member.headers, status: 404 });
  await call("/api/server-games", {
    method: "POST",
    headers: member.headers,
    body: { action: "guess", id: entered.payload.game, requestId: randomUUID(), revision: 1, word: "arbre" },
    status: 404,
  });
  await call("/api/circles", {
    method: "POST",
    headers: owner.headers,
    body: { action: "revoke", id: circleId },
    status: 200,
  });
  await call("/api/circles", {
    method: "POST",
    headers: outsider.headers,
    body: { action: "join", token: invite },
    status: 409,
  });
  facts.push("circle-exclusion-and-invite-revocation-qualified");

  duelId = randomUUID();
  duelToken = hex();
  const pendingDuel = await call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "create", id: duelId, token: duelToken },
    status: 200,
  });
  check(pendingDuel.payload.id === duelId, "duel-id-mismatch");
  check(pendingDuel.payload.state === "pending", "duel-pending-state-invalid");
  check(!containsPrivateDuelMaterial(pendingDuel.payload, []), "duel-targets-exposed-while-pending");

  const accepted = await call("/api/duels", {
    method: "POST",
    headers: member.headers,
    body: { action: "accept", token: duelToken },
    status: 200,
  });
  const reaccepted = await call("/api/duels", {
    method: "POST",
    headers: member.headers,
    body: { action: "accept", token: duelToken },
    status: 200,
  });
  check(accepted.payload.state === "active", "duel-active-state-invalid");
  check(accepted.payload.role === "opponent", "duel-opponent-role-invalid");
  check(isDeepStrictEqual(reaccepted.payload, accepted.payload), "duel-reaccept-changed-view");
  await call("/api/duels", {
    method: "POST",
    headers: outsider.headers,
    body: { action: "accept", token: duelToken },
    status: 409,
  });
  await call(`/api/duels?id=${duelId}`, { headers: outsider.headers, status: 404 });
  await revokeGuest(outsider, "outsider");
  facts.push("outsider-session-revoked-after-rights-checks");

  const requestId = randomUUID();
  const guessed = await call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "guess", id: duelId, round: 0, revision: 0, requestId, word: "maison" },
    status: 200,
  });
  check(guessed.payload.guesses?.length === 1, "duel-guess-count-invalid");
  check(guessed.payload.guesses[0]?.word === "maison", "duel-guess-word-invalid");
  check(Number.isInteger(guessed.payload.guesses[0]?.rank), "duel-guess-rank-invalid");
  const replayed = await call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "guess", id: duelId, round: 0, revision: 0, requestId, word: "maison" },
    status: 200,
  });
  check(isDeepStrictEqual(replayed.payload, guessed.payload), "duel-guess-replay-changed-view");
  await call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "guess", id: duelId, round: 1, revision: 0, requestId, word: "maison" },
    status: 409,
  });

  const concurrent = await Promise.all([
    ["arbre", randomUUID()],
    ["rivière", randomUUID()],
  ].map(([word, concurrentRequestId]) => call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "guess", id: duelId, round: 1, revision: 0, requestId: concurrentRequestId, word },
  })));
  check(isDeepStrictEqual(concurrent.map(item => item.response.status).sort(), [200, 409]), "duel-concurrent-statuses-invalid");
  const concurrentWinner = concurrent.find(item => item.response.status === 200);
  check(concurrentWinner?.payload.guesses?.filter(guess => guess.round === 1).length === 1, "duel-concurrent-fact-count-invalid");

  const opponentView = await call(`/api/duels?id=${duelId}`, { headers: member.headers, status: 200 });
  check(!containsPrivateDuelMaterial(opponentView.payload, ["maison", "arbre", "rivière"]), "opponent-view-exposes-private-material");
  check(isDeepStrictEqual(opponentView.payload.guesses, []), "opponent-view-includes-host-guesses");
  facts.push("duel-acceptance-secrecy-replay-and-concurrency-qualified");

  const forfeited = await call("/api/duels", {
    method: "POST",
    headers: member.headers,
    body: { action: "forfeit", id: duelId },
    status: 200,
  });
  check(forfeited.payload.state === "finished", "duel-forfeit-state-invalid");
  check(forfeited.payload.forfeiter === "opponent", "duel-forfeiter-invalid");
  check(Array.isArray(forfeited.payload.decisions) && forfeited.payload.decisions.length === 3, "duel-decisions-missing");
  check(forfeited.payload.decisions.every(decision => [-1, 0, 1].includes(decision)), "duel-decisions-invalid");
  await call("/api/duels", {
    method: "POST",
    headers: owner.headers,
    body: { action: "guess", id: duelId, round: 2, revision: 0, requestId: randomUUID(), word: "mer" },
    status: 409,
  });
  facts.push("duel-forfeit-and-final-mutation-guard-qualified");
  businessCleanupComplete = true;
  await revokeGuest(member, "member");
  await revokeGuest(owner, "owner");
  facts.push("qa-sessions-revoked");
} catch (error) {
  failureCode = error instanceof Error ? error.message : "unknown-failure";
} finally {
  if (!businessCleanupComplete && owner && circleId) {
    try {
      if (invite) await call("/api/circles", { method: "POST", headers: owner.headers, body: { action: "revoke", id: circleId } });
      if (member) await call("/api/circles", { method: "POST", headers: owner.headers, body: { action: "exclude", id: circleId, guest: member.guestId } });
    } catch {
      failureCode ??= "circle-cleanup-failed";
    }
  }
  if (!businessCleanupComplete && owner && duelId) {
    try {
      const view = await call(`/api/duels?id=${duelId}`, { headers: owner.headers });
      if (view.response.status === 200 && view.payload.state === "pending") {
        await call("/api/duels", { method: "POST", headers: owner.headers, body: { action: "cancel", id: duelId } });
      } else if (view.response.status === 200 && view.payload.state === "active") {
        await call("/api/duels", { method: "POST", headers: owner.headers, body: { action: "forfeit", id: duelId } });
      }
    } catch {
      failureCode ??= "duel-cleanup-failed";
    }
  }
  const cleanup = [];
  for (const candidate of cleanupCandidates) {
    try {
      const before = await call("/api/session", { headers: { cookie: candidate.cookie } });
      if (before.response.status === 200 && before.payload.guest === null) {
        cleanup.push("already-inactive");
        continue;
      }
      const deleted = await call("/api/session", {
        method: "DELETE",
        headers: { cookie: candidate.cookie, "x-braise-csrf": candidate.csrf },
        body: {},
      });
      const after = await call("/api/session", { headers: { cookie: candidate.cookie } });
      cleanup.push(deleted.response.status === 200 && after.payload.guest === null ? "revoked" : "failed");
    } catch {
      cleanup.push("failed");
    }
  }
  if (cleanup.length > 0) {
    process.stderr.write(`${JSON.stringify({ scope: "qa-session-cleanup", results: cleanup })}\n`);
    if (cleanup.includes("failed")) failureCode = "qa-session-cleanup-failed";
  }
}

if (failureCode) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 1,
    scope: "hosted-private-d1-circles-duels",
    status: "failed",
    code: failureCode,
  })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    scope: "hosted-private-d1-circles-duels",
    status: "passed",
    facts,
    browserValidation: "not_requested",
    cleanup: "circle-access-revoked-duel-terminal-sessions-revoked",
  })}\n`);
}
