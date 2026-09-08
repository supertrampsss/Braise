import { authenticate, serverHeaders, store, unavailable } from "@/lib/server-runtime";
import { sessionCookie, tokenHash, validMutationOrigin } from "@/lib/server-security";
import { creationLimited } from "@/lib/server-limits";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: serverHeaders });
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return reply({ error: "Origine refusée." }, 403);
  try {
    const text = await request.text(); if (text.length > 512) return reply({ error: "Requête invalide." }, 400);
    const body = JSON.parse(text);
    if (creationLimited(request)) return reply({ error: "Trop de tentatives. Réessayez plus tard." }, 429);
    if (body?.action === "issue") {
      const session = await authenticate(request, true); if (!session) return reply({ error: "Session requise." }, 403);
      if (typeof body.nonce !== "string" || !/^[a-f0-9]{64}$/.test(body.nonce)) return reply({ error: "Tentative invalide." }, 400);
      const code = await tokenHash(`${sessionCookie(request)}:${body.nonce}:recovery`);
      return await store().setRecoveryCode(session, code) ? reply({ code }) : reply({ error: "La session a expiré." }, 403);
    }
    if (body?.action === "confirm" && typeof body.code === "string" && /^[a-f0-9]{64}$/.test(body.code)) {
      const session = await authenticate(request, true); if (!session) return reply({ error: "Session requise." }, 403);
      return await store().confirmRecoveryCode(session, body.code) ? reply({ confirmed: true }) : reply({ error: "Code remplacé ou session expirée. Générez un nouveau code." }, 409);
    }
    if (body?.action !== "recover" || typeof body.code !== "string" || !/^[a-f0-9]{64}$/.test(body.code) || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) return reply({ error: "Code invalide." }, 400);
    const csrf = await tokenHash(`${body.token}:csrf`);
    const session = await store().recover(body.code, body.token, csrf);
    if (!session) return reply({ error: "Code invalide ou déjà utilisé." }, 403);
    return Response.json({ guest: { id: session.guest_id, name: session.name }, csrf }, { headers: { ...serverHeaders, "Set-Cookie": `__Host-braise_session=${body.token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000` } });
  } catch { return unavailable(); }
}
