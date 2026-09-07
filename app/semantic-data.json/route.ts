import { exportDataset } from "@/lib/semantic";
export async function GET() {
  return Response.json(exportDataset(), { headers: { "Content-Disposition": "attachment; filename=braise-semantic-fr-cc-by-sa-3.0.json", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
