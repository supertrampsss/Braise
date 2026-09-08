import { authenticate, serverHeaders, store, unavailable } from "@/lib/server-runtime";
import { evaluateWord, findWord, getPuzzle } from "@/lib/semantic";
import { creationLimited } from "@/lib/server-limits";
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: serverHeaders });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
async function view(guest: string, id: string) {
  const data = await store().publicView(guest, id);
  return data ? reply(data) : reply({ error: "Partie introuvable." }, 404);
}
export async function GET(request: Request) {
  try {
    const session = await authenticate(request); if (!session) return reply({ error: "Session requise." }, 401);
    const id = new URL(request.url).searchParams.get("id");
    return id ? await view(session.guest_id, id) : reply({ games: await store().listGames(session.guest_id) });
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  try {
    const session = await authenticate(request, true); if (!session) return reply({ error: "Session ou origine invalide." }, 403);
    const text = await request.text(); if (text.length > 512) return reply({ error: "Requête trop grande." }, 413);
    const body = JSON.parse(text); if (typeof body?.id !== "string" || (!uuid(body.id) && !/^circle-[a-f0-9-]{73}$/.test(body.id) && !/^studio-[a-f0-9-]{73}-\d{1,2}$/.test(body.id))) return reply({ error: "Identité de partie invalide." }, 400);
    if (body.action === "create") {
      if (!uuid(body.id)) return reply({ error: "Identité de partie invalide." }, 400);
      if (creationLimited(request)) return reply({ error: "Trop de créations. Réessayez plus tard." }, 429);
      const seed = String(crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647);
      const game = await store().createAuthorizedGame(session, body.id, seed);
      return game ? await view(session.guest_id, game.id) : reply({ error: "Identité indisponible ou limite de 100 parties atteinte." }, 409);
    }
    if (body.action !== "guess" || !uuid(body.requestId) || !Number.isInteger(body.revision) || typeof body.word !== "string" || body.word.length > 50) return reply({ error: "Proposition invalide." }, 400);
    const game = await store().game(session.guest_id, body.id); if (!game) return reply({ error: "Partie introuvable." }, 404);
    if (game.corpus !== "fr-fasttext-30000-v1" || game.rules !== "classic-v1") return reply({ error: "Cette version de partie n’est pas prise en charge." }, 409);
    const index = findWord(body.word); if (index === undefined) return reply({ error: "Mot absent du dictionnaire." }, 422);
    const result = await evaluateWord(getPuzzle("challenge", game.seed).targetIndex, index);
    const outcome = await store().submit(session, game.id, body.revision, body.requestId, result);
    return outcome === "conflict" ? reply({ error: "La partie a évolué. Rechargez-la avant de proposer à nouveau." }, 409) : await view(session.guest_id, game.id);
  } catch { return unavailable(); }
}
