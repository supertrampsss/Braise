export const EMBED_PROTOCOL = "braise-embed-v1";
export const EMBED_ORIGIN = "https://braise-mots.yellow-drake-7186.chatgpt.site";
export function validEmbedMessage(origin: string, data: unknown, type: "hello" | "resize") {
  if (origin !== EMBED_ORIGIN || !data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return value.protocol === EMBED_PROTOCOL && value.type === type && (type === "hello" || (Number.isInteger(value.height) && Number(value.height) >= 240 && Number(value.height) <= 10000));
}
export function distributionHeaders(response: Response) {
  const headers = new Headers(response.headers);
  const existing = headers.get("Content-Security-Policy");
  headers.set("Content-Security-Policy", [existing, "frame-ancestors 'self'"].filter(Boolean).join("; "));
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "same-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
