import { env } from "cloudflare:workers";
import { authenticate, serverHeaders, unavailable } from "@/lib/server-runtime";
import { CircleStore } from "@/lib/circle-store";
import { weekStartParis } from "@/lib/weekly-ritual";
import { creationLimited } from "@/lib/server-limits";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: serverHeaders });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
export async function GET(request: Request) {
  try {
    if (!env.DB) return unavailable();
    const session = await authenticate(request); if (!session) return reply({ error: "Créez ou retrouvez votre identité dans Votre espace." }, 401);
    const store = new CircleStore(env.DB); const query = new URL(request.url).searchParams;
    const id = query.get("id");
    if (!id) return reply({ circles: await store.list(session.guest_id) });
    const details = await store.details(session.guest_id, id);
    if (!details) return reply({ error: "Cercle inaccessible." }, 404);
    const challenge = query.get("challenge");
    return reply({ ...details, results: challenge ? await store.results(session.guest_id, challenge) : [] });
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  try {
    if (!env.DB) return unavailable();
    const session = await authenticate(request, true); if (!session) return reply({ error: "Session ou origine invalide." }, 403);
    const raw = await request.text(); if (raw.length > 512) return reply({ error: "Requête trop grande." }, 413);
    const body = JSON.parse(raw); const store = new CircleStore(env.DB);
    if (["create", "join", "invite"].includes(body.action) && creationLimited(request)) return reply({ error: "Trop de demandes. Réessayez plus tard." }, 429);
    if (body.action === "join" && typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token)) {
      const joined = await store.join(session, body.token);
      return joined ? reply(joined) : reply({ error: "Invitation expirée, révoquée, complète ou accès exclu." }, 409);
    }
    if (!uuid(body.id)) return reply({ error: "Identifiant invalide." }, 400);
    if (body.action === "create" && typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 40) {
      const circle = await store.create(session, body.id, body.name.trim());
      return circle ? reply(circle) : reply({ error: "Création impossible. Limite : cinq cercles." }, 409);
    }
    const member = await store.member(session.guest_id, body.id);
    if (!member) return reply({ error: "Cercle inaccessible." }, 404);
    if (body.action === "invite" && typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token)) {
      return await store.invite(session, body.id, body.token) ? reply({ created: true }) : reply({ error: "Invitation non créée. Seul le propriétaire peut inviter, dans la limite prévue." }, 409);
    }
    if (body.action === "exclude" && uuid(body.guest)) { await store.exclude(session, body.id, body.guest); return reply({ updated: true }); }
    if (body.action === "revoke") { await store.revokeInvites(session, body.id); return reply({ updated: true }); }
    if (body.action === "weekly") {
      const week = weekStartParis(); const seed = String(crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647);
      const challenge = await store.challenge(session, body.id, week, seed);
      return challenge ? reply(challenge) : reply({ error: "Défi indisponible." }, 409);
    }
    if (body.action === "enter" && uuid(body.challenge)) {
      // Verify the requested challenge belongs to the selected circle before entering.
      const details = await store.details(session.guest_id, body.id);
      if (!details?.challenges.some(item => item.id === body.challenge)) return reply({ error: "Défi inaccessible." }, 404);
      const game = await store.enter(session, body.challenge);
      return game ? reply({ game }) : reply({ error: "Défi inaccessible." }, 409);
    }
    return reply({ error: "Action invalide." }, 400);
  } catch { return unavailable(); }
}
