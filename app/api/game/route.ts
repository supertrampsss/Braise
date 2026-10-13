import { env } from 'cloudflare:workers';
import { discoverFree } from "@/lib/free-discovery.server";
import { samePuzzleRef } from "@/lib/game-contracts";
import { archiveDateStatus } from "@/lib/calendar";
import { getPuzzle, legacyTargetWord, normalizeWord } from "@/lib/semantic";
import { resolveClassicGame } from '@/lib/classic-game.server';
import { DailyV2Unavailable } from '@/lib/daily-v2.server';
import type { RangeBucket } from '@/lib/semantic-v2-range-r2';
import { SemanticStorageError } from "@/lib/semantic-storage";
import type { Mode } from "@/lib/game-types";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const v2Runtime = () => { const values=env as unknown as Record<string,unknown>;return {qualificationPin:values.BRAIZ_DAILY_V2_QUALIFICATION_PIN as string|undefined,bucket:values.SEMANTIC_DATA as RangeBucket|undefined}; };
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
  let resolved: Awaited<ReturnType<typeof resolveClassicGame>> | undefined;
  try {
  const now = new Date();
  const url = new URL(request.url); const mode = url.searchParams.get("mode") || "daily";
  if (!validMode(mode)) return reply({ error: "Ce mode de jeu n’existe pas." }, 400);
  if (url.searchParams.get("tutorial") === "1") {
    // A real, identified V1 example, always distinct from today's daily target.
    resolved = await resolveClassicGame('daily','',undefined,now,v2Runtime(),request.signal);
    const example = ["042", "43", "44"].map(seed => getPuzzle("free", seed, now)).find(item => legacyTargetWord(item.targetIndex) !== resolved!.targetWord)!;
    return reply(example.publicPuzzle);
  }
  const seed = url.searchParams.get("seed") || "";
  if ((mode === "free" || mode === "challenge") && !validSeed(seed)) return reply({ error: "Le lien de ce défi n’est pas valide. Lancez un nouveau défi." }, 400);
  if (mode === "archive") {
    const date = url.searchParams.get("date");
    const status = archiveDateStatus(date, now);
    if(status !== 'available') return reply({ error: archiveError(status) },400);
    resolved=await resolveClassicGame('archive','',date!,now,v2Runtime(),request.signal);
  } else {
    resolved=await resolveClassicGame(mode,seed,undefined,now,v2Runtime(),request.signal);
  }
  return reply({...resolved.publicPuzzle,targetIdentity:resolved.targetIdentity});
  } catch { return reply({error:'Cette édition est momentanément indisponible. Réessayez dans un instant.'},503); }
  finally { resolved?.close(); }
}
export async function POST(request: Request) {
  if (limited(request)) return reply({ error: "Quelques secondes de pause, puis à vous de rejouer." }, 429);
  let resolved: Awaited<ReturnType<typeof resolveClassicGame>> | undefined;
  try {
    const text = await request.text();
    if (text.length > 64000) return reply({ error: "La proposition est trop longue." }, 413);
    const body = JSON.parse(text);
    if (body?.action === "discover") {
      try { return reply(await discoverFree(body)); }
      catch (error) { return reply({ error: error instanceof Error ? error.message : "Découverte indisponible." }, 400); }
    }
    if (!body || !validMode(body.mode) || ((body.mode === "free" || body.mode === "challenge") && !validSeed(body.seed))) return reply({ error: "La partie n’est pas valide. Rechargez le jeu." }, 400);
    const now = new Date();
    if (body.mode === "archive") {
      const status = archiveDateStatus(body.date, now);
      if (status !== "available") return reply({ error: archiveError(status) }, 400);
      if (!Object.hasOwn(body, "puzzleRef")) return reply({ error: "La version de cette archive est requise. Rechargez-la pour continuer." }, 409);
      resolved = await resolveClassicGame('archive','',body.date,now,v2Runtime(),request.signal);
    } else resolved = await resolveClassicGame(body.mode,body.seed,undefined,now,v2Runtime(),request.signal);
    const { publicPuzzle } = resolved;
    if (body.puzzleId !== publicPuzzle.id) return reply({ error: body.mode === "archive" ? "Cette archive ne correspond plus à la date choisie. Rechargez-la pour continuer." : "Un nouveau mot quotidien est arrivé. Cliquez sur Quotidien pour commencer." }, 409);
    // Unversioned requests remain the original V1 protocol, for already-open tabs.
    if (resolved.requiresVersion && !Object.hasOwn(body,'puzzleRef') || Object.hasOwn(body, "puzzleRef") && !samePuzzleRef(body.puzzleRef, publicPuzzle.ref)) {
      return reply({ error: "La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre." }, 409);
    }
    if (body.action === "hint") {
      if (!Number.isInteger(body.hintLevel) || body.hintLevel < 0 || body.hintLevel > 2 || !Array.isArray(body.guesses) || body.guesses.length < 5 || body.guesses.length > 3000 || !body.guesses.every((word: unknown) => typeof word === "string" && word.length <= 50)) return reply({ error: "Les indices sont disponibles après cinq essais, trois fois par partie." }, 400);
      const hint = await resolved.hint(body.hintLevel,body.guesses);
      return hint ? reply({ ...hint, puzzleRef: publicPuzzle.ref }) : reply({ error: "Votre meilleure piste est déjà toute proche. Essayez ses variantes ou ses synonymes." }, 400);
    }
    if (body.action !== "guess" || typeof body.word !== "string" || body.word.length > 50 || !/^[\p{L}]+(?:['-][\p{L}]+)*$/u.test(normalizeWord(body.word))) return reply({ error: "Proposez un seul mot français, sans chiffre ni espace." }, 400);
    const evaluation = await resolved.evaluate(body.word);
    if (evaluation === null) return reply({ error: "Ce mot n’est pas dans le dictionnaire de BRAIZ. Essayez le singulier ou l’infinitif, avec les accents." }, 422);
    return reply({ ...evaluation, puzzleRef: publicPuzzle.ref });
  } catch (error) {
    if (error instanceof DailyV2Unavailable) return reply({error:'Cette édition est momentanément indisponible. Votre saisie est conservée.'},503);
    if (error instanceof SemanticStorageError) {
      console.error("Semantic storage unavailable", { code: error.code, message: error.message });
      return reply({ error: "Le moteur chauffe encore. Votre saisie est conservée : réessayez dans un instant." }, 503);
    }
    return reply({ error: "La proposition n’a pas pu être lue. Réessayez." }, 400);
  } finally { resolved?.close(); }
}
