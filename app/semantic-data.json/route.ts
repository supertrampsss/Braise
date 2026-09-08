import { env } from "cloudflare:workers";
export async function GET(request: Request) {
  try {
    const assets = (env as unknown as { ASSETS?: Fetcher }).ASSETS;
    if (!assets) throw new Error("Asset binding unavailable");
    const response = await assets.fetch(new Request(new URL("/semantic/fr-fasttext-30000-v1/source.json", request.url)));
    if (!response.ok || !response.body) throw new Error(`Semantic export asset unavailable: ${response.status}`);
    return new Response(response.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=braise-semantic-fr-cc-by-sa-3.0.json", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Semantic export unavailable", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Les données ne sont pas disponibles." }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
