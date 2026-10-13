import { env } from 'cloudflare:workers';
import { discoverFree } from "@/lib/free-discovery.server";
import { samePuzzleRef } from "@/lib/game-contracts";
import { archiveDateStatus } from "@/lib/calendar";
import { normalizeWord } from "@/lib/semantic";
import { classicEdition, isWord2vecRef } from '@/lib/word2vec-contract';
import { Word2vecStorageError } from '@/lib/word2vec.server';
import { resolveClassicGame, ClassicEditionConflict } from '@/lib/classic-game.server';
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
  let requestedRef:unknown;
  if(url.searchParams.has('puzzleRef'))try{requestedRef=JSON.parse(url.searchParams.get('puzzleRef')!);}catch{return reply({error:'La référence de cette partie est invalide.'},409);}
  const edition=url.searchParams.get('edition')??(requestedRef as {rulesVersion?:unknown}|undefined)?.rulesVersion;
  if(edition!==undefined&&!classicEdition(edition))return reply({error:'La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre.'},409);
  if(requestedRef!==undefined&&(!requestedRef||typeof requestedRef!=='object'||Array.isArray(requestedRef)||!classicEdition((requestedRef as {rulesVersion?:unknown}).rulesVersion)||url.searchParams.has('edition')&&edition!==(requestedRef as {rulesVersion?:unknown}).rulesVersion))return reply({error:'La référence de cette partie est invalide.'},409);
  if (url.searchParams.get("tutorial") === "1") {
    resolved = await resolveClassicGame('daily','',undefined,now,v2Runtime(),request.signal);
    for(const seed of ['042','43','44']){
      const example=await resolveClassicGame('free',seed,undefined,now,v2Runtime(),request.signal);
      try{if(example.targetWord!==resolved.targetWord)return reply({...example.publicPuzzle,targetIdentity:example.targetIdentity});}finally{example.close();}
    }
    throw new Error('tutorial-unavailable');
  }
  const seed = url.searchParams.get("seed") || "";
  if ((mode === "free" || mode === "challenge") && !validSeed(seed)) return reply({ error: "Le lien de ce défi n’est pas valide. Lancez un nouveau défi." }, 400);
  if (mode === "archive") {
    const date = url.searchParams.get("date");
    const status = archiveDateStatus(date, now);
    if(status !== 'available') return reply({ error: archiveError(status) },400);
    resolved=await resolveClassicGame('archive','',date!,now,v2Runtime(),request.signal,requestedRef??edition);
  } else {
    resolved=await resolveClassicGame(mode,seed,undefined,now,v2Runtime(),request.signal,requestedRef??edition);
  }
  if(requestedRef!==undefined&&!samePuzzleRef(requestedRef,resolved.publicPuzzle.ref))return reply({error:'La référence de cette partie est invalide.'},409);
  return reply({...resolved.publicPuzzle,targetIdentity:resolved.targetIdentity});
  } catch(error) { if(error instanceof ClassicEditionConflict)return reply({error:'La référence de cette partie est invalide.'},409);console.error('Classic edition unavailable',{code:error instanceof Word2vecStorageError?error.code:'classic_unavailable',message:error instanceof Error?error.message:'unknown'});return reply({error:'Cette édition est momentanément indisponible. Réessayez dans un instant.'},503); }
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
      catch (error) { return error instanceof Word2vecStorageError?reply({error:'Cette édition est momentanément indisponible. Réessayez dans un instant.'},503):reply({ error: error instanceof Error ? error.message : "Découverte indisponible." }, 400); }
    }
    if (!body || !validMode(body.mode) || ((body.mode === "free" || body.mode === "challenge") && !validSeed(body.seed))) return reply({ error: "La partie n’est pas valide. Rechargez le jeu." }, 400);
    const now = new Date();
    if(Object.hasOwn(body,'puzzleRef')&&!classicEdition(body.puzzleRef?.rulesVersion))return reply({error:'La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre.'},409);
    if(body.puzzleRef?.rulesVersion==='word2vec-v1'&&(!isWord2vecRef(body.puzzleRef,now)||body.puzzleRef.id!==body.puzzleId||body.puzzleRef.context!==body.mode))return reply({error:'La référence de cette partie est invalide.'},409);
    const requestedEdition=body.puzzleRef??(!Object.hasOwn(body,'puzzleRef')&&typeof body.puzzleId==='string'&&/^(free-\d{1,10}|daily-\d{4}-\d{2}-\d{2})$/.test(body.puzzleId)?'classic-v1':undefined);
    if (body.mode === "archive") {
      const status = archiveDateStatus(body.date, now);
      if (status !== "available") return reply({ error: archiveError(status) }, 400);
      if (!Object.hasOwn(body, "puzzleRef")) return reply({ error: "La version de cette archive est requise. Rechargez-la pour continuer." }, 409);
      resolved = await resolveClassicGame('archive','',body.date,now,v2Runtime(),request.signal,requestedEdition);
    } else resolved = await resolveClassicGame(body.mode,body.seed,undefined,now,v2Runtime(),request.signal,requestedEdition);
    const { publicPuzzle } = resolved;
    if (body.puzzleId !== publicPuzzle.id) return reply({ error: body.mode === "archive" ? "Cette archive ne correspond plus à la date choisie. Rechargez-la pour continuer." : "Un nouveau mot quotidien est arrivé. Cliquez sur Quotidien pour commencer." }, 409);
    // Unversioned requests remain the original V1 protocol, for already-open tabs.
    if (resolved.requiresVersion && !Object.hasOwn(body,'puzzleRef') || Object.hasOwn(body, "puzzleRef") && !samePuzzleRef(body.puzzleRef, publicPuzzle.ref)) {
      return reply({ error: "La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre." }, 409);
    }
    if (body.action === "hint") {
      return reply({ error: "Les indices automatiques ont été retirés." }, 410);
    }
    if (body.action !== "guess" || typeof body.word !== "string" || body.word.length > 50 || !/^[\p{L}]+(?:['-][\p{L}]+)*$/u.test(normalizeWord(body.word))) return reply({ error: "Proposez un seul mot français, sans chiffre ni espace." }, 400);
    const evaluation = await resolved.evaluate(body.word);
    if (evaluation === null) return reply({ error: "Mot inconnu." }, 422);
    return reply({ ...evaluation, puzzleRef: publicPuzzle.ref });
  } catch (error) {
    if(error instanceof ClassicEditionConflict)return reply({error:'La référence de cette partie est invalide.'},409);
    if (error instanceof DailyV2Unavailable || error instanceof Word2vecStorageError) return reply({error:'Cette édition est momentanément indisponible. Votre saisie est conservée.'},503);
    if (error instanceof SemanticStorageError) {
      console.error("Semantic storage unavailable", { code: error.code, message: error.message });
      return reply({ error: "Le moteur chauffe encore. Votre saisie est conservée : réessayez dans un instant." }, 503);
    }
    return reply({ error: "La proposition n’a pas pu être lue. Réessayez." }, 400);
  } finally { resolved?.close(); }
}
