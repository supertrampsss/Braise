import { env } from "cloudflare:workers";
import { authenticate, serverHeaders, unavailable } from "@/lib/server-runtime";
import { DuelStore } from "@/lib/duel-store";
import {duelTargetWord,evaluateDuelWord,newDuelTargets} from '@/lib/duel-engine.server';
import {DUEL_WORD2VEC_RULES,type DuelListGroup} from '@/lib/duel-presentation';
import { creationLimited } from "@/lib/server-limits";
import {lexicalAlternative} from '@/lib/lexical-suggestion';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: serverHeaders });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const token = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export async function GET(request: Request) {
  try {
    if (!env.DB) return unavailable();
    const session = await authenticate(request); if (!session) return reply({ error: "Identité invitée requise." }, 401);
    const store = new DuelStore(env.DB); const params = new URL(request.url).searchParams,id=params.get("id");
    if (!id) {
      const group=params.get('group')??'all';if(!['all','play','waiting','finished'].includes(group))return reply({error:'Liste de duels invalide.'},400);
      try{return reply(await store.listPage(session.guest_id,{group:group as DuelListGroup|'all',cursor:params.get('cursor')}));}
      catch(error){if(error instanceof RangeError)return reply({error:'Page de duels invalide.'},400);throw error;}
    }
    const view = await store.view(session.guest_id, id); return view ? reply(view) : reply({ error: "Duel inaccessible." }, 404);
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  try {
    if (!env.DB) return unavailable();
    const session = await authenticate(request, true); if (!session) return reply({ error: "Session ou origine invalide." }, 403);
    const raw = await request.text(); if (raw.length > 512) return reply({ error: "Requête trop grande." }, 413);
    const body = JSON.parse(raw); const store = new DuelStore(env.DB);
    if (body.action === "accept" && token(body.token)) {
      if (creationLimited(request)) return reply({ error: "Trop de demandes." }, 429);
      const duel = await store.accept(session, body.token);
      return duel ? reply(await store.view(session.guest_id, duel.id)) : reply({ error: "Invitation indisponible, déjà acceptée ou expirée." }, 409);
    }
    if (!uuid(body.id)) return reply({ error: "Identifiant invalide." }, 400);
    if(body.action==='renew-invitation'){
      if(!token(body.token)||!token(body.previousVersion))return reply({error:'Renouvellement invalide.'},400);
      if(creationLimited(request))return reply({error:'Trop de demandes.'},429);
      const renewed=await store.renewInvitation(session,body.id,body.previousVersion,body.token);
      return renewed?reply(await store.view(session.guest_id,body.id)):reply({error:'Cette invitation a changé ou n’est plus disponible. Actualisez avant de réessayer.'},409);
    }
    if(body.action==='accept-rematch'){
      const duel=await store.acceptRematch(session,body.id);
      return duel?reply(await store.view(session.guest_id,duel.id)):reply({error:'Cette revanche n’est plus disponible.'},409);
    }
    if(body.action==='rematch'&&uuid(body.parentId)&&token(body.token)){
      if(creationLimited(request))return reply({error:'Trop de demandes.'},429);
      const parent=await store.get(session.guest_id,body.parentId);
      if(!parent)return reply({error:'Duel inaccessible.'},404);
      if((await store.view(session.guest_id,parent.id))?.state!=='finished')return reply({error:'Le duel n’est pas terminé.'},409);
      const targets=await newDuelTargets([0,1,2].map(round=>duelTargetWord(parent,round)));
      const duel=await store.rematch(session,parent.id,body.id,body.token,targets);
      return duel?reply(await store.view(session.guest_id,duel.id)):reply({error:'Revanche indisponible. Dix invitations ou duels actifs maximum.'},409);
    }
    if (body.action === "create" && token(body.token)) {
      if (creationLimited(request)) return reply({ error: "Trop de demandes." }, 429);
      const targets=await newDuelTargets();
      const duel = await store.create(session, body.id, body.token, targets,Date.now(),{rules:DUEL_WORD2VEC_RULES});
      return duel ? reply(await store.view(session.guest_id, duel.id)) : reply({ error: "Création impossible. Dix invitations ou duels actifs maximum." }, 409);
    }
    const duel = await store.get(session.guest_id, body.id); if (!duel) return reply({ error: "Duel inaccessible." }, 404);
    if (body.action === "cancel" || body.action === "forfeit") { await store.end(session, body.id, body.action === "forfeit"); return reply(await store.view(session.guest_id, body.id)); }
    if (body.action !== "guess" || !uuid(body.requestId) || !Number.isInteger(body.round) || body.round < 0 || body.round > 2 || !Number.isInteger(body.revision) || body.revision < 0 || body.revision > 30 || typeof body.word !== "string" || body.word.length > 50) return reply({ error: "Proposition invalide." }, 400);
    if (!['duel-v1',DUEL_WORD2VEC_RULES].includes(duel.rules)) return reply({ error: "Version non prise en charge." }, 409);
    const result = await evaluateDuelWord(duel,body.round,body.word);
    if(!result){
      const alternative=lexicalAlternative(body.word);
      const suggestion=alternative&&await evaluateDuelWord(duel,body.round,alternative)!==null?alternative:undefined;
      return reply({error:'Mot absent du dictionnaire.',...(suggestion?{suggestion}:{})},422);
    }
    const outcome = await store.submit(session, body.id, body.round, body.revision, body.requestId, result);
    return outcome === "conflict" ? reply({ error: "Manche close ou modifiée. Actualisez avant de réessayer." }, 409) : reply(await store.view(session.guest_id, body.id));
  } catch { return unavailable(); }
}
