import { summarizeIntruder } from "@/lib/intruder-server";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  try { const raw = await request.text(); if (raw.length > 4096) throw new Error(); return Response.json(summarizeIntruder(JSON.parse(raw).attempts), { headers }); }
  catch { return Response.json({ error: "Le bilan demande les 20 réponses distinctes de cette édition." }, { status: 400, headers }); }
}
