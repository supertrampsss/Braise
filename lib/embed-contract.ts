import { PUBLIC_ORIGIN } from "./release";
export const EMBED_PROTOCOL = "braise-embed-v1";
export const EMBED_ORIGIN = PUBLIC_ORIGIN;
export const EMBED_ALLOWED_ORIGINS = [PUBLIC_ORIGIN, "https://braise-mots.yellow-drake-7186.chatgpt.site"] as const;
export function validEmbedOrigin(origin: string): boolean {
  return EMBED_ALLOWED_ORIGINS.some(allowed => allowed === origin);
}
export function validEmbedMessage(origin: string, data: unknown, type: "hello" | "resize") {
  if (!validEmbedOrigin(origin) || !data || typeof data !== "object" || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  const expectedKeys = type === "hello" ? ["protocol", "type"] : ["height", "protocol", "type"];
  if (Object.keys(value).sort().join(",") !== expectedKeys.join(",")) return false;
  return value.protocol === EMBED_PROTOCOL && value.type === type && (type === "hello" || (Number.isInteger(value.height) && Number(value.height) >= 240 && Number(value.height) <= 10000));
}
export function validEmbedEvent(event: Pick<MessageEvent, "origin" | "source" | "data">, expectedSource: MessageEventSource | null, type: "hello" | "resize"): boolean {
  return expectedSource !== null && event.source === expectedSource && validEmbedMessage(event.origin, event.data, type);
}
export function distributionHeaders(response: Response) {
  const headers = new Headers(response.headers);
  const existing = headers.get("Content-Security-Policy");
  const directives = (existing ?? "").split(";").map(value => value.trim()).filter(value => value && !/^frame-ancestors(?:\s|$)/i.test(value));
  headers.set("Content-Security-Policy", [...directives, `frame-ancestors 'self' ${EMBED_ALLOWED_ORIGINS.join(" ")}`].join("; "));
  // SAMEORIGIN would deny the explicitly authorized second host. CSP is exact, never wildcard.
  headers.delete("X-Frame-Options");
  headers.set("Referrer-Policy", "same-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
