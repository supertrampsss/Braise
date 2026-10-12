import { authenticate, serverHeaders, store, unavailable } from "@/lib/server-runtime";
import { sanitizeProjection } from "@/lib/projection";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: serverHeaders });
export async function GET(request: Request) {
  try {
    const session = await authenticate(request); if (!session) return reply({ error: "Identité requise." }, 401);
    const id = new URL(request.url).searchParams.get("id"); if (!id || id.length > 128) return reply({ error: "Partie introuvable." }, 404);
    const view = await store().publicView(session.guest_id, id);
    return view ? reply(sanitizeProjection(view, Date.now())) : reply({ error: "Partie inaccessible ou édition retirée." }, 404);
  } catch { return unavailable(); }
}
