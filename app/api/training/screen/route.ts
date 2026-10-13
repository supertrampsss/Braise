import { env } from "cloudflare:workers";
import { trainingScreenResponse } from "@/lib/training-screen-transport.server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return trainingScreenResponse(request, (env as unknown as { ASSETS?: Fetcher }).ASSETS);
}
