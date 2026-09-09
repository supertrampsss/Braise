import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const origin = "https://braise-mots.yellow-drake-7186.chatgpt.site";
const siteAuthorization = process.env.BRAISE_SITES_AUTH;

if (!siteAuthorization) {
  throw new Error("BRAISE_SITES_AUTH is required and must never be written to disk or logs");
}

const facts = [];
const cleanupCandidates = [];
const check = (condition, code) => {
  if (!condition) throw new Error(code);
};

function rawSessionCookie(response) {
  const header = response.headers.get("set-cookie") ?? "";
  return header.match(/(?:^|,\s*)(__Host-braise_session=[a-f0-9]{64})/)?.[1];
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
    body: { name: `QA-s-${label.slice(0, 4)}-${Date.now().toString(36).slice(-5)}` },
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
  return { headers: { cookie, "x-braise-csrf": created.payload.csrf } };
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

function exposesPrivateStudioMaterial(payload) {
  const text = JSON.stringify(payload);
  return text.includes("\"seed\"") || text.includes("\"entries\"") || text.includes("nature-v1:");
}

let author;
let participant;
let editionId;
let failureCode;
let businessCleanupComplete = false;

try {
  author = await createGuest("author");
  participant = await createGuest("participant");
  facts.push("two-isolated-hosted-guests-created");

  const catalogue = await call("/api/studio", { headers: author.headers, status: 200 });
  check(Array.isArray(catalogue.payload.titles) && catalogue.payload.titles.length === 5, "studio-title-catalogue-invalid");
  check(Array.isArray(catalogue.payload.catalogue) && catalogue.payload.catalogue.length >= 3, "studio-entry-catalogue-invalid");
  check(catalogue.payload.catalogue.every(item => typeof item.id === "string" && typeof item.label === "string" && item.seed === undefined), "studio-catalogue-exposes-seed");

  const draftId = randomUUID();
  const title = catalogue.payload.titles[1];
  const initialEntries = catalogue.payload.catalogue.slice(0, 2).map(item => item.id);
  const changedEntries = [catalogue.payload.catalogue[2].id];
  const saved = await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "save", id: draftId, revision: -1, title, entries: initialEntries },
    status: 200,
  });
  check(saved.payload.id === draftId, "studio-draft-id-mismatch");
  check(saved.payload.revision === 0, "studio-draft-revision-invalid");
  check(isDeepStrictEqual(saved.payload.entries, initialEntries), "studio-draft-entries-changed");
  await call(`/api/studio?id=${draftId}`, { headers: participant.headers, status: 404 });
  await call("/api/studio", {
    method: "POST",
    headers: participant.headers,
    body: { action: "save", id: draftId, revision: 0, title, entries: initialEntries },
    status: 409,
  });
  facts.push("studio-draft-ownership-qualified");

  const published = await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "publish", id: draftId, revision: 0 },
    status: 200,
  });
  editionId = published.payload.id;
  check(typeof editionId === "string" && /^[a-f0-9-]{36}$/.test(editionId), "studio-edition-id-invalid");
  check(published.payload.state === "active", "studio-edition-state-invalid");
  const republished = await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "publish", id: draftId, revision: 0 },
    status: 200,
  });
  check(isDeepStrictEqual(republished.payload, published.payload), "studio-publish-replay-changed-edition");

  const changed = await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "save", id: draftId, revision: 0, title, entries: changedEntries },
    status: 200,
  });
  check(changed.payload.revision === 1, "studio-updated-revision-invalid");
  await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "save", id: draftId, revision: 0, title, entries: initialEntries },
    status: 409,
  });

  const progress = await call(`/api/studio?edition=${editionId}`, { headers: participant.headers, status: 200 });
  check(progress.payload.id === editionId, "studio-progress-id-mismatch");
  check(progress.payload.title === title, "studio-progress-title-mismatch");
  check(progress.payload.length === 2 && progress.payload.completed === 0, "studio-immutable-edition-length-invalid");
  check(progress.payload.game === null, "studio-progress-game-should-be-empty");
  check(!exposesPrivateStudioMaterial(progress.payload), "studio-progress-exposes-future-material");

  const entered = await call("/api/studio", {
    method: "POST",
    headers: participant.headers,
    body: { action: "enter", id: editionId },
    status: 200,
  });
  const reentered = await call("/api/studio", {
    method: "POST",
    headers: participant.headers,
    body: { action: "enter", id: editionId },
    status: 200,
  });
  check(typeof entered.payload.game === "string", "studio-game-id-missing");
  check(reentered.payload.game === entered.payload.game, "studio-enter-not-idempotent");
  const game = await call(`/api/server-games?id=${entered.payload.game}`, { headers: participant.headers, status: 200 });
  check(game.payload.game?.revision === 0, "studio-game-revision-invalid");
  check(game.payload.game?.seed === undefined, "studio-game-exposes-seed");

  const guessed = await call("/api/server-games", {
    method: "POST",
    headers: participant.headers,
    body: { action: "guess", id: entered.payload.game, requestId: randomUUID(), revision: 0, word: "maison" },
    status: 200,
  });
  check(guessed.payload.game?.revision === 1, "studio-game-guess-revision-invalid");
  check(guessed.payload.guesses?.[0]?.word === "maison", "studio-game-guess-word-invalid");
  check(Number.isInteger(guessed.payload.guesses?.[0]?.rank), "studio-game-rank-invalid");
  facts.push("studio-immutable-edition-entry-and-real-game-qualified");

  const participantWithdrawal = await call("/api/studio", {
    method: "POST",
    headers: participant.headers,
    body: { action: "withdraw", id: editionId },
    status: 200,
  });
  check(participantWithdrawal.payload.withdrawn === true, "studio-participant-withdraw-response-invalid");
  await call(`/api/studio?edition=${editionId}`, { headers: participant.headers, status: 200 });

  await call("/api/studio", {
    method: "POST",
    headers: author.headers,
    body: { action: "withdraw", id: editionId },
    status: 200,
  });
  await call(`/api/studio?edition=${editionId}`, { headers: participant.headers, status: 404 });
  await call(`/api/server-games?id=${entered.payload.game}`, { headers: participant.headers, status: 404 });
  await call("/api/server-games", {
    method: "POST",
    headers: participant.headers,
    body: { action: "guess", id: entered.payload.game, requestId: randomUUID(), revision: 1, word: "arbre" },
    status: 404,
  });
  const preservedDraft = await call(`/api/studio?id=${draftId}`, { headers: author.headers, status: 200 });
  check(preservedDraft.payload.revision === 1, "studio-withdraw-changed-draft");
  check(preservedDraft.payload.editions?.some(item => item.id === editionId && item.state === "withdrawn"), "studio-withdrawal-not-visible-to-author");
  facts.push("studio-withdrawal-authority-and-generic-access-barrier-qualified");

  businessCleanupComplete = true;
  await revokeGuest(participant, "participant");
  await revokeGuest(author, "author");
  facts.push("qa-sessions-revoked");
} catch (error) {
  failureCode = error instanceof Error ? error.message : "unknown-failure";
} finally {
  if (!businessCleanupComplete && author && editionId) {
    try {
      await call("/api/studio", {
        method: "POST",
        headers: author.headers,
        body: { action: "withdraw", id: editionId },
        status: 200,
      });
      await call(`/api/studio?edition=${editionId}`, { headers: author.headers, status: 404 });
    } catch {
      failureCode ??= "studio-cleanup-failed";
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
    scope: "hosted-private-d1-studio",
    status: "failed",
    code: failureCode,
  })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    scope: "hosted-private-d1-studio",
    status: "passed",
    facts,
    browserValidation: "not_requested",
    cleanup: "edition-withdrawn-sessions-revoked",
  })}\n`);
}
