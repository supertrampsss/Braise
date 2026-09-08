import { samePuzzleRef } from "@/lib/game-contracts";
import { archiveDateStatus } from "@/lib/calendar";
import { evaluateWord, findWord, getArchivePuzzle, getPuzzle, nextHint, normalizeWord } from "@/lib/semantic";
import { SemanticStorageError } from "@/lib/semantic-storage";
import type { Mode } from "@/lib/game-types";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const validMode = (value: unknown): value is Mode => value === "daily" || value === "archive" || value === "free" || value === "challenge";
const validSeed = (value: unknown) => typeof value === "string" && /^\d{1,10}$/.test(value) && Number(value) <= 2147483647;
function archiveError(status: ReturnType<typeof archiveDateStatus>) {
  if (status === "before-start") return "Aucune archive n’est disponible pour cette date.";
  if (status === "today-or-future") return "Cette date est à venir. Choisissez une date passée.";
  return "Choisissez une date valide.";
}
const traffic = new Map<string, { start: number; count: number }>();
function limited(request: Request) {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return false;
  const now = Date.now(); const previous = traffic.get(ip);
  if (!previous || now - previous.start >= 60000) {
    if (traffic.size >= 2000) traffic.delete(traffic.keys().next().value!);
    traffic.set(ip, { start: now, count: 1 }); return false;
  }
  previous.count++; return previous.count > 180;
}
export async function GET(request: Request) {
  const now = new Date();
  const url = new URL(request.url); const mode = url.searchParams.get("mode") || "daily";
  if (!validMode(mode)) return reply({ error: "Ce mode de jeu n’existe pas." }, 400);
  const seed = url.searchParams.get("seed") || "";
  if ((mode === "free" || mode === "challenge") && !validSeed(seed)) return reply({ error: "Le lien de ce défi n’est pas valide. Lancez un nouveau défi." }, 400);
  if (mode === "archive") {
    const date = url.searchParams.get("date");
    const status = archiveDateStatus(date, now);
    return status === "available" ? reply(getArchivePuzzle(date!, now).publicPuzzle) : reply({ error: archiveError(status) }, 400);
  }
  return reply(getPuzzle(mode, seed, now).publicPuzzle);
}
export async function POST(request: Request) {
  if (limited(request)) return reply({ error: "Quelques secondes de pause, puis à vous de rejouer." }, 429);
  try {
    const text = await request.text();
    if (text.length > 64000) return reply({ error: "La proposition est trop longue." }, 413);
    const body = JSON.parse(text);
    if (!body || !validMode(body.mode) || ((body.mode === "free" || body.mode === "challenge") && !validSeed(body.seed))) return reply({ error: "La partie n’est pas valide. Rechargez le jeu." }, 400);
    const now = new Date();
    let resolved;
    if (body.mode === "archive") {
      const status = archiveDateStatus(body.date, now);
      if (status !== "available") return reply({ error: archiveError(status) }, 400);
      if (!Object.hasOwn(body, "puzzleRef")) return reply({ error: "La version de cette archive est requise. Rechargez-la pour continuer." }, 409);
      resolved = getArchivePuzzle(body.date, now);
    } else resolved = getPuzzle(body.mode, body.seed, now);
    const { publicPuzzle, targetIndex } = resolved;
    if (body.puzzleId !== publicPuzzle.id) return reply({ error: body.mode === "archive" ? "Cette archive ne correspond plus à la date choisie. Rechargez-la pour continuer." : "Un nouveau mot quotidien est arrivé. Cliquez sur Quotidien pour commencer." }, 409);
    // Unversioned requests remain the original V1 protocol, for already-open tabs.
    if (Object.hasOwn(body, "puzzleRef") && !samePuzzleRef(body.puzzleRef, publicPuzzle.ref)) {
      return reply({ error: "La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre." }, 409);
    }
    if (body.action === "hint") {
      if (!Number.isInteger(body.hintLevel) || body.hintLevel < 0 || body.hintLevel > 2 || !Array.isArray(body.guesses) || body.guesses.length < 5 || body.guesses.length > 3000 || !body.guesses.every((word: unknown) => typeof word === "string" && word.length <= 50)) return reply({ error: "Les indices sont disponibles après cinq essais, trois fois par partie." }, 400);
      const hint = await nextHint(targetIndex, body.hintLevel, body.guesses);
      return hint ? reply({ ...hint, puzzleRef: publicPuzzle.ref }) : reply({ error: "Votre meilleure piste est déjà toute proche. Essayez ses variantes ou ses synonymes." }, 400);
    }
    if (body.action !== "guess" || typeof body.word !== "string" || body.word.length > 50 || !/^[\p{L}]+(?:['-][\p{L}]+)*$/u.test(normalizeWord(body.word))) return reply({ error: "Proposez un seul mot français, sans chiffre ni espace." }, 400);
    const index = findWord(body.word);
    if (index === undefined) return reply({ error: "Ce mot n’est pas dans le dictionnaire de Braise. Essayez le singulier ou l’infinitif, avec les accents." }, 422);
    return reply({ ...await evaluateWord(targetIndex, index), puzzleRef: publicPuzzle.ref });
  } catch (error) {
    if (error instanceof SemanticStorageError) {
      console.error("Semantic storage unavailable", { code: error.code, message: error.message });
      return reply({ error: "Le moteur chauffe encore. Votre saisie est conservée : réessayez dans un instant." }, 503);
    }
    return reply({ error: "La proposition n’a pas pu être lue. Réessayez." }, 400);
  }
}
