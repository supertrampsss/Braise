import { evaluateTwoBraises, twoBraisesPuzzle, TWO_BRAISES_EDITION } from "@/lib/two-braises-server";
import { SemanticStorageError } from "@/lib/semantic-storage";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("pair");
    if (raw === null || !/^\d{1,2}$/.test(raw)) throw new Error();
    return Response.json(twoBraisesPuzzle(Number(raw)), { headers });
  } catch { return Response.json({ error: "Paire inconnue." }, { status: 400, headers }); }
}
export async function POST(request: Request) {
  try {
    const text = await request.text(); if (text.length > 512) throw new Error();
    const body = JSON.parse(text); if (body.edition !== TWO_BRAISES_EDITION) throw new Error();
    const result = await evaluateTwoBraises(body.pair, body.word);
    return result ? Response.json(result, { headers }) : Response.json({ error: "Ce mot n’est pas dans le dictionnaire de Braise." }, { status: 422, headers });
  } catch (error) { return Response.json({ error: error instanceof SemanticStorageError ? "Le moteur est indisponible. Réessayez, votre saisie est conservée." : "Proposition invalide." }, { status: error instanceof SemanticStorageError ? 503 : 400, headers }); }
}
