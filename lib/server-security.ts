export const BRAISE_ORIGIN = "https://braise-mots.yellow-drake-7186.chatgpt.site";
export function validMutationOrigin(request: Request) {
  return request.headers.get("origin") === BRAISE_ORIGIN && request.headers.get("content-type")?.split(";")[0].trim() === "application/json";
}
export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, "0")).join("");
}
export async function tokenHash(token: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map(value => value.toString(16).padStart(2, "0")).join("");
}
export function sessionCookie(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith("__Host-braise_session="))?.slice("__Host-braise_session=".length);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
