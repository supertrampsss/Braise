import { authenticate, serverHeaders, store, unavailable } from "@/lib/server-runtime";
import { randomToken, sessionCookie, tokenHash, validMutationOrigin } from "@/lib/server-security";
import { creationLimited } from "@/lib/server-limits";
export async function GET(request: Request) {
  try {
    const session = await authenticate(request);
    if (!session) return Response.json({ guest: null }, { headers: serverHeaders });
    return Response.json({ guest: { id: session.guest_id, name: session.name }, csrf: await tokenHash(`${sessionCookie(request)}:csrf`) }, { headers: serverHeaders });
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ error: "Origine refusée." }, { status: 403, headers: serverHeaders });
  try {
    const text = await request.text(); if (text.length > 256) return Response.json({ error: "Pseudonyme invalide." }, { status: 400, headers: serverHeaders });
    const body = JSON.parse(text); const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!/^[\p{L}\p{N} _.-]{1,24}$/u.test(name)) return Response.json({ error: "Choisissez un pseudonyme de 1 à 24 caractères." }, { status: 400, headers: serverHeaders });
    const existing = await authenticate(request);
    if (existing) return await GET(request);
    if (creationLimited(request)) return Response.json({ error: "Trop de créations. Réessayez plus tard." }, { status: 429, headers: serverHeaders });
    const token = randomToken(); const csrf = await tokenHash(`${token}:csrf`);
    const guest = await store().createGuest(name, token, csrf);
    return Response.json({ guest, csrf }, { headers: { ...serverHeaders, "Set-Cookie": `__Host-braise_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000` } });
  } catch { return unavailable(); }
}
export async function DELETE(request: Request) {
  try {
    const session = await authenticate(request, true);
    if (!session) return Response.json({ error: "Session ou origine invalide." }, { status: 403, headers: serverHeaders });
    await store().revokeSession(session);
    return Response.json({ guest: null }, { headers: { ...serverHeaders, "Set-Cookie": "__Host-braise_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0" } });
  } catch { return unavailable(); }
}
