import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const origin = "https://braise-mots.yellow-drake-7186.chatgpt.site";
const siteAuthorization = process.env.BRAISE_SITES_AUTH;

if (!siteAuthorization) {
  throw new Error("BRAISE_SITES_AUTH is required and must never be written to disk or logs");
}

const facts = [];
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
  check(attributes.includes("Max-Age=2592000"), "session-cookie-max-age-invalid");
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
    throw new Error(`${method}-${path}-fetch-failed`);
  }
  options.onResponse?.(response);
  check(response.headers.get("cache-control") === "no-store", "cache-control-invalid");
  check(response.headers.get("x-content-type-options") === "nosniff", "content-type-options-invalid");
  if (options.status !== undefined) {
    check(response.status === options.status, `${method}-${path}-unexpected-status-${response.status}`);
  }
  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new Error(`${method}-${path}-invalid-json`);
  }
  return { response, payload };
}

const cleanupCandidates = [];
let failureCode;

try {
const anonymous = await call("/api/session", { status: 200 });
check(isDeepStrictEqual(anonymous.payload, { guest: null }), "anonymous-session-not-empty");
facts.push("anonymous-session-is-empty");

const created = await call("/api/session", {
  method: "POST",
  body: { name: `QA-${Date.now().toString(36).slice(-8)}` },
  status: 200,
  onResponse(response) {
    const cookie = rawSessionCookie(response);
    if (!cookie) return;
    const token = cookie.slice("__Host-braise_session=".length);
    cleanupCandidates.push({ cookie, csrf: createHash("sha256").update(`${token}:csrf`).digest("hex") });
  },
});
const oldCookie = sessionCookie(created.response);
const guestId = created.payload.guest?.id;
check(typeof guestId === "string", "created-guest-id-invalid");
check(/^[a-f0-9]{64}$/.test(created.payload.csrf), "created-csrf-format-invalid");
check(created.payload.csrf === cleanupCandidates[0].csrf, "created-csrf-mismatch");
facts.push("guest-created-on-hosted-d1");

const authenticated = await call("/api/session", { headers: { cookie: oldCookie }, status: 200 });
check(authenticated.payload.guest?.id === guestId, "created-session-identity-mismatch");

const gameId = randomUUID();
const gameHeaders = { cookie: oldCookie, "x-braise-csrf": created.payload.csrf };
const firstGame = await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "create", id: gameId },
  status: 200,
});
check(firstGame.payload.game?.id === gameId, "created-game-id-mismatch");
check(firstGame.payload.game?.revision === 0, "created-game-revision-invalid");
check(isDeepStrictEqual(firstGame.payload.guesses, []), "created-game-guesses-not-empty");
check(firstGame.payload.game?.corpus === "fr-fasttext-30000-v1", "created-game-corpus-invalid");
check(firstGame.payload.game?.rules === "classic-v1", "created-game-rules-invalid");

const replayedGame = await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "create", id: gameId },
  status: 200,
});
check(replayedGame.payload.game?.id === gameId, "replayed-game-id-mismatch");
check(replayedGame.payload.game?.seed === undefined, "private-seed-exposed");
check(isDeepStrictEqual(replayedGame.payload, firstGame.payload), "replayed-game-view-changed");
facts.push("server-game-create-is-idempotent");

const requestId = randomUUID();
const guessed = await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "guess", id: gameId, requestId, revision: 0, word: "maison" },
  status: 200,
});
check(guessed.payload.game?.revision === 1, "accepted-guess-revision-invalid");
check(guessed.payload.guesses?.length === 1, "accepted-guess-count-invalid");
check(guessed.payload.guesses?.[0]?.word === "maison", "accepted-guess-word-invalid");
check(Number.isFinite(guessed.payload.guesses?.[0]?.temperature), "accepted-temperature-invalid");
check(Number.isInteger(guessed.payload.guesses?.[0]?.rank), "accepted-rank-not-integer");
check(guessed.payload.guesses[0].rank >= 1 && guessed.payload.guesses[0].rank <= 30000, "accepted-rank-out-of-bounds");
check(typeof guessed.payload.guesses[0].found === "boolean", "accepted-found-invalid");

const replayedGuess = await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "guess", id: gameId, requestId, revision: 0, word: "maison" },
  status: 200,
});
check(replayedGuess.payload.game?.revision === 1, "replayed-guess-revision-invalid");
check(replayedGuess.payload.guesses?.length === 1, "replayed-guess-count-invalid");
check(isDeepStrictEqual(replayedGuess.payload, guessed.payload), "replayed-guess-view-changed");
facts.push("server-guess-is-real-and-idempotent");

await call(`/api/server-games?id=${gameId}`, { status: 401 });
const beforeGuards = await call(`/api/server-games?id=${gameId}`, {
  headers: { cookie: oldCookie },
  status: 200,
});
await call("/api/server-games", {
  method: "POST",
  headers: { cookie: oldCookie },
  body: { action: "guess", id: gameId, requestId: randomUUID(), revision: 1, word: "arbre" },
  status: 403,
});
await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  origin: "https://example.invalid",
  body: { action: "guess", id: gameId, requestId: randomUUID(), revision: 1, word: "arbre" },
  status: 403,
});
const afterGuards = await call(`/api/server-games?id=${gameId}`, {
  headers: { cookie: oldCookie },
  status: 200,
});
check(isDeepStrictEqual(afterGuards.payload, beforeGuards.payload), "rejected-mutation-changed-state");
facts.push("session-csrf-and-origin-guards-preserve-state");

const concurrentGameId = randomUUID();
await call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "create", id: concurrentGameId },
  status: 200,
});
const concurrent = await Promise.all([
  ["maison", randomUUID()],
  ["arbre", randomUUID()],
].map(([word, concurrentRequestId]) => call("/api/server-games", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "guess", id: concurrentGameId, requestId: concurrentRequestId, revision: 0, word },
})));
check(isDeepStrictEqual(concurrent.map(item => item.response.status).sort(), [200, 409]), "concurrent-statuses-invalid");
const concurrentView = await call(`/api/server-games?id=${concurrentGameId}`, {
  headers: { cookie: oldCookie },
  status: 200,
});
check(concurrentView.payload.game?.revision === 1, "concurrent-revision-invalid");
check(concurrentView.payload.guesses?.length === 1, "concurrent-guess-count-invalid");
facts.push("hosted-d1-accepts-exactly-one-concurrent-revision");

const nonce = hex();
const issued = await call("/api/recovery", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "issue", nonce },
  status: 200,
});
check(/^[a-f0-9]{64}$/.test(issued.payload.code), "recovery-code-format-invalid");
const confirmed = await call("/api/recovery", {
  method: "POST",
  headers: gameHeaders,
  body: { action: "confirm", code: issued.payload.code },
  status: 200,
});
check(confirmed.payload.confirmed === true, "recovery-code-not-confirmed");

const recoveryToken = hex();
const recoveryCsrf = createHash("sha256").update(`${recoveryToken}:csrf`).digest("hex");
cleanupCandidates.push({ cookie: `__Host-braise_session=${recoveryToken}`, csrf: recoveryCsrf });
const recovered = await call("/api/recovery", {
  method: "POST",
  body: { action: "recover", code: issued.payload.code, token: recoveryToken },
  status: 200,
  onResponse(response) {
    const cookie = rawSessionCookie(response);
    if (!cookie || cleanupCandidates.some(candidate => candidate.cookie === cookie)) return;
    const token = cookie.slice("__Host-braise_session=".length);
    cleanupCandidates.push({ cookie, csrf: createHash("sha256").update(`${token}:csrf`).digest("hex") });
  },
});
const newCookie = sessionCookie(recovered.response);
check(newCookie === `__Host-braise_session=${recoveryToken}`, "recovered-session-cookie-mismatch");
check(recovered.payload.guest?.id === guestId, "recovered-guest-id-mismatch");
check(/^[a-f0-9]{64}$/.test(recovered.payload.csrf), "recovered-csrf-format-invalid");
check(recovered.payload.csrf === recoveryCsrf, "recovered-csrf-mismatch");

const oldRevoked = await call("/api/session", { headers: { cookie: oldCookie }, status: 200 });
check(isDeepStrictEqual(oldRevoked.payload, { guest: null }), "old-session-still-active");
const newSession = await call("/api/session", { headers: { cookie: newCookie }, status: 200 });
check(newSession.payload.guest?.id === guestId, "new-session-identity-mismatch");
const preserved = await call(`/api/server-games?id=${gameId}`, { headers: { cookie: newCookie }, status: 200 });
check(preserved.payload.game?.revision === 1, "recovered-game-revision-invalid");
check(preserved.payload.guesses?.length === 1, "recovered-game-guess-count-invalid");
check(isDeepStrictEqual(preserved.payload, guessed.payload), "recovered-game-view-changed");
facts.push("recovery-rotates-session-and-preserves-game");

await call("/api/session", {
  method: "DELETE",
  headers: { cookie: newCookie, "x-braise-csrf": recovered.payload.csrf },
  body: {},
  status: 200,
});
const revoked = await call("/api/session", { headers: { cookie: newCookie }, status: 200 });
check(isDeepStrictEqual(revoked.payload, { guest: null }), "qa-session-still-active");
facts.push("qa-session-revoked");
cleanupCandidates.length = 0;
} catch (error) {
  failureCode = error instanceof Error ? error.message : "unknown-failure";
} finally {
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
    scope: "hosted-private-d1-session-game-recovery",
    status: "failed",
    code: failureCode,
  })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    scope: "hosted-private-d1-session-game-recovery",
    status: "passed",
    facts,
    browserValidation: "not_requested",
    concurrencyQualification: "same_revision_exactly_one_accepted",
  })}\n`);
}
