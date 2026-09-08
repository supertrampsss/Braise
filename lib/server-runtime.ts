import { env } from "cloudflare:workers";
import { ServerStore } from "./server-store";
import { sessionCookie, tokenHash, validMutationOrigin } from "./server-security";
export const serverHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function store() { if (!env.DB) throw new Error("database-unavailable"); return new ServerStore(env.DB); }
export async function authenticate(request: Request, mutation = false) {
  if (mutation && !validMutationOrigin(request)) return null;
  const token = sessionCookie(request); if (!token) return null;
  const session = await store().session(token); if (!session) return null;
  if (mutation && await tokenHash(request.headers.get("x-braise-csrf") ?? "") !== session.csrf_hash) return null;
  return session;
}
export function unavailable() { return Response.json({ error: "Le service partagé est indisponible. Le jeu classique reste accessible." }, { status: 503, headers: serverHeaders }); }
