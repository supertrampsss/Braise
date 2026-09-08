import { expeditionStatus } from "@/lib/expedition-server";
import { SemanticStorageError } from "@/lib/semantic-storage";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 1024) return Response.json({ error: "Parcours trop volumineux." }, { status: 413, headers });
    const body = JSON.parse(text);
    return Response.json(await expeditionStatus(body?.id, body?.proofs), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof SemanticStorageError ? "Le moteur est indisponible. Votre progression est conservée." : "Impossible de valider cette étape. Reprenez votre parcours." }, { status: error instanceof SemanticStorageError ? 503 : 400, headers });
  }
}
