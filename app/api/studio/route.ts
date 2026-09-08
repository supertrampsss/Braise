import { env } from "cloudflare:workers";
import { authenticate, serverHeaders, unavailable } from "@/lib/server-runtime";
import { StudioStore } from "@/lib/studio-store";
import { STUDIO_ENTRIES, STUDIO_TITLES } from "@/lib/studio-catalogue";
import { creationLimited } from "@/lib/server-limits";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: serverHeaders });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
export async function GET(request: Request) {
  try {
    if (!env.DB) return unavailable(); const session = await authenticate(request); if (!session) return reply({ error: "Identité invitée requise." }, 401);
    const store = new StudioStore(env.DB); const query = new URL(request.url).searchParams; const edition = query.get("edition");
    if (edition) { const data = await store.progress(session.guest_id, edition); return data ? reply(data) : reply({ error: "Édition retirée ou introuvable." }, 404); }
    const id = query.get("id");
    if (id) { const draft = await store.draft(session.guest_id, id); return draft ? reply({ ...draft, entries: JSON.parse(draft.entries), editions: await store.editions(session.guest_id, id) }) : reply({ error: "Brouillon inaccessible." }, 404); }
    return reply({ drafts: await store.list(session.guest_id), titles: STUDIO_TITLES, catalogue: STUDIO_ENTRIES.map(({ seed: _seed, ...item }) => item) });
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  try {
    if (!env.DB) return unavailable(); const session = await authenticate(request, true); if (!session) return reply({ error: "Session ou origine invalide." }, 403);
    const raw = await request.text(); if (raw.length > 2048) return reply({ error: "Requête trop grande." }, 413);
    const body = JSON.parse(raw); if (!uuid(body.id)) return reply({ error: "Identifiant invalide." }, 400);
    const store = new StudioStore(env.DB);
    if (body.action === "withdraw") { await store.withdraw(session, body.id); return reply({ withdrawn: true }); }
    if ((body.action === "publish" || (body.action === "save" && body.revision === -1)) && creationLimited(request)) return reply({ error: "Trop de créations. Réessayez plus tard." }, 429);
    if (body.action === "save" && Number.isInteger(body.revision) && body.revision >= -1 && typeof body.title === "string" && Array.isArray(body.entries)) {
      const draft = await store.save(session, body.id, body.revision, body.title, body.entries);
      return draft ? reply({ ...draft, entries: JSON.parse(draft.entries) }) : reply({ error: "Brouillon modifié ailleurs ou contenu invalide. Vos choix restent à l’écran ; rechargez explicitement avant de les remplacer." }, 409);
    }
    if (body.action === "publish" && Number.isInteger(body.revision)) { const edition = await store.publish(session, body.id, body.revision); return edition ? reply(edition) : reply({ error: "Enregistrez une version valide avant de publier." }, 409); }
    if (body.action === "enter") { const game = await store.enter(session, body.id); return game ? reply({ game }) : reply({ error: "Édition terminée, retirée ou limite de parties atteinte." }, 409); }
    return reply({ error: "Action invalide." }, 400);
  } catch { return unavailable(); }
}
