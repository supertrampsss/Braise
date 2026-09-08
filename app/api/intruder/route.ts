import { answerIntruder, intruderQuestion, INTRUDER_EDITION } from "@/lib/intruder-server";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("index");
  try {
    if (raw === null || !/^\d{1,2}$/.test(raw)) throw new Error();
    return Response.json(intruderQuestion(Number(raw)), { headers });
  } catch { return Response.json({ error: "Énigme inconnue." }, { status: 400, headers }); }
}
export async function POST(request: Request) {
  try {
    const text = await request.text(); if (text.length > 256) throw new Error();
    const body = JSON.parse(text);
    if (body.edition !== INTRUDER_EDITION) throw new Error();
    return Response.json(answerIntruder(body.index, body.choice), { headers });
  } catch { return Response.json({ error: "Cette réponse n’est pas valide." }, { status: 400, headers }); }
}
