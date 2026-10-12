import { z } from 'zod';
import { createLocalProfileExport, inspectLocalProfileImport, importLocalProfile, loadLocalProfile, type ProfileSnapshot, type ProfileStorage } from './profile-storage';
import { PLAY_CONTEXT_KEY, readContexts } from './play-hub';
import { archiveDateStatus, parisDate } from './calendar';
import type { SavedGame } from './game-types';
export const SYNC_MAX_BYTES = 1 * 1024 * 1024;
const PREFIX = 'braise.v1.game.';
const instant = z.string().datetime();
const contextSchema = z.object({ mode:z.enum(['daily','archive','free','challenge']), collection:z.string().max(80).optional(), expedition:z.string().max(80).optional(), expeditionStep:z.number().int().min(1).max(3).optional() }).strict();
const guessSchema = z.object({word:z.string().min(1).max(50),temperature:z.number().min(-100).max(100),rank:z.number().int().min(1).max(30000),found:z.boolean(),order:z.number().int().min(1).max(3000),hint:z.boolean().optional(),acceptedAt:instant.optional()}).strict();
const gameSchema = z.object({ guesses:z.array(guessSchema).max(3000),pins:z.array(z.string().min(1).max(50)).max(3),hints:z.number().int().min(0).max(3),startedAt:z.number().int().nonnegative(),solvedAt:z.number().int().nonnegative().optional(),completedMode:z.enum(['daily','archive','free','challenge']).optional(),profileV2StartIndex:z.number().int().nonnegative().optional(),version:z.literal(1).optional(),schemaVersion:z.literal(1).optional(),formatVersion:z.literal(1).optional() }).strict();
const schema=z.object({format:z.literal('braiz-personal-device-sync'),version:z.literal(1),corpus:z.literal('fr-fasttext-30000-v1'),rules:z.literal('classic-v1'),provenance:z.literal('personal-unverified'),createdAt:instant,profile:z.string().max(8*1024*1024),games:z.array(z.object({id:z.string().max(40),game:gameSchema,context:contextSchema.optional()}).strict()).max(1000)}).strict();
export type DeviceEnvelope=z.infer<typeof schema>;
export class SyncMemory implements ProfileStorage {
  values=new Map<string,string>();
  constructor(storage?:ProfileStorage) { if(storage) for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key!==null){const value=storage.getItem(key);if(value!==null)this.values.set(key,value);}} }
  get length(){return this.values.size;} key(i:number){return [...this.values.keys()][i]??null;} getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);}
}
function fail(message:string):never{throw new Error(message);}
function parseJson(text:string):unknown{try{return JSON.parse(text);}catch{return fail('Copie JSON illisible. Aucune donnée modifiée.');}}
function parseSavedGame(text:string){const parsed=gameSchema.safeParse(parseJson(text));if(!parsed.success)fail('Sauvegarde de partie illisible, inconnue ou incompatible.');return parsed.data;}
function validId(id:string,now:Date){return /^free-\d{1,10}$/.test(id)&&Number(id.slice(5))<=2147483647 || /^daily-/.test(id)&&(archiveDateStatus(id.slice(6),now)==='available'||id.slice(6)===parisDate(now));}
function validateGame(game:SavedGame,now:Date){
  if(game.startedAt>now.getTime()||(game.solvedAt??0)>now.getTime()||game.guesses.some(g=>g.acceptedAt&&Date.parse(g.acceptedAt)>now.getTime())||new Set(game.guesses.map(g=>g.word)).size!==game.guesses.length||new Set(game.guesses.map(g=>g.order)).size!==game.guesses.length||(game.profileV2StartIndex??0)>game.guesses.length) fail('Partie incohérente ou datée dans le futur.');
}
export function parseDeviceEnvelope(text:string,now=new Date()):DeviceEnvelope{
  if(new TextEncoder().encode(text).length>SYNC_MAX_BYTES)fail('Copie trop grande (1 Mio maximum), aucune donnée tronquée.');
  const result=schema.safeParse(parseJson(text));if(!result.success)fail('Format de synchronisation inconnu, futur ou incohérent.');const value=result.data;
  if(Date.parse(value.createdAt)>now.getTime()||new Set(value.games.map(g=>g.id)).size!==value.games.length)fail('Copie incohérente ou datée dans le futur.');
  const rawProfile=parseJson(value.profile) as {legacyRaw?:unknown};
  if(rawProfile&&typeof rawProfile.legacyRaw==='string'){const legacy=z.object({wins:z.array(z.object({id:z.string(),date:z.string(),mode:z.enum(['daily','free','challenge']),tries:z.number(),hints:z.number()}).strict()),guesses:z.number(),sound:z.boolean()}).strict();if(!legacy.safeParse(parseJson(rawProfile.legacyRaw)).success)fail('La copie historique contient des champs inconnus : transfert refusé.');}
  const profile=inspectLocalProfileImport(value.profile,new SyncMemory(),now);if(!['ready','unchanged'].includes(profile.status))fail(profile.reason);
  for(const item of value.games){if(!validId(item.id,now))fail('Identité de partie incompatible.');validateGame(item.game,now);if(item.game.guesses.some(g=>g.found)||item.game.solvedAt)fail('Seules les parties en cours appartiennent à cette copie.');
    if(item.context){const memory=new SyncMemory();memory.setItem(PLAY_CONTEXT_KEY,JSON.stringify({version:1,items:{[item.id]:item.context}}));if(!readContexts(memory)||item.id.startsWith('daily-')!==['daily','archive'].includes(item.context.mode))fail('Contexte de partie incohérent.');}
  }return value;
}
export function createDeviceEnvelope(storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date()){
  const profile=createLocalProfileExport(snapshot,now);if(!profile.ok)fail(profile.reason);
  const contexts=readContexts(storage);if(!contexts)fail('Contextes locaux illisibles : copie refusée.');
  const games:DeviceEnvelope['games']=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;const id=key.slice(PREFIX.length);const game=parseSavedGame(storage.getItem(key)!);validateGame(game,now);if(!validId(id,now))fail('Une partie locale utilise une identité inconnue.');if(game.guesses.some(g=>g.found)||game.solvedAt)continue;games.push({id,game,...(contexts[id]?{context:contexts[id]}:{})});}
  const value:DeviceEnvelope={format:'braiz-personal-device-sync',version:1,corpus:'fr-fasttext-30000-v1',rules:'classic-v1',provenance:'personal-unverified',createdAt:now.toISOString(),profile:profile.text,games};const text=JSON.stringify(value);parseDeviceEnvelope(text,now);return text;
}
/** Reconcile the current memory facts and latest disk facts in a private staging copy only. */
export type LiveDeviceGame={id:string;game:SavedGame};
export function prepareDeviceUpload(storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date(),live?:LiveDeviceGame|null){
  const incomplete='La partie en mémoire n’est pas entièrement enregistrée. Envoi refusé pour éviter une copie incomplète. Réessayez après une sauvegarde réussie.';
  if(live&&(live.game.guesses.length||live.game.pins.length||live.game.hints)){
    const raw=storage.getItem(PREFIX+live.id);if(!raw)fail(incomplete);
    const saved=parseSavedGame(raw);try{assertGameFactsPreserved(live.game,saved);}catch{fail(incomplete);}
  }
  // Pending profile facts cannot stand in for a missing playable save, even without a mounted board.
  for(const fact of snapshot.pendingActivities){
    if(fact.type!=='guessAccepted'||fact.puzzleRef.variant!=='classic'||!validId(fact.puzzleRef.id,now)||snapshot.profile.wins.some(win=>win.id===fact.puzzleRef.id))continue;
    const raw=storage.getItem(PREFIX+fact.puzzleRef.id);
    if(!raw||!parseSavedGame(raw).guesses.some(guess=>guess.word===fact.word&&!guess.hint))fail(incomplete);
  }
  const exported=createLocalProfileExport(snapshot,now);if(!exported.ok)fail(exported.reason);
  const staged=new SyncMemory(storage);
  const preview=inspectLocalProfileImport(exported.text,staged,now,snapshot);
  if(!preview.planId||!['ready','unchanged'].includes(preview.status))fail(preview.reason);
  const imported=importLocalProfile(exported.text,preview.planId,staged,snapshot,now);
  if(!imported.persisted||!imported.snapshot)fail(imported.reason);
  return createDeviceEnvelope(staged,imported.snapshot,now);
}
/** Order is device-local; score, clue/proposition identity and known acceptance time are facts. */
function mergeGuessFacts(local:SavedGame['guesses'][number],incoming:SavedGame['guesses'][number]){
  if(local.word!==incoming.word||local.temperature!==incoming.temperature||local.rank!==incoming.rank||local.found!==incoming.found||Boolean(local.hint)!==Boolean(incoming.hint)||local.acceptedAt&&incoming.acceptedAt&&local.acceptedAt!==incoming.acceptedAt)fail('Essais incompatibles : les deux copies sont conservées.');
  return {...local,...(local.acceptedAt||incoming.acceptedAt?{acceptedAt:local.acceptedAt??incoming.acceptedAt}:{})};
}
/** A cloud replacement must contain every existing fact, including known metadata. */
export function assertGameFactsPreserved(existing:SavedGame,incoming:SavedGame){
  if(incoming.hints<existing.hints||existing.pins.some(pin=>!incoming.pins.includes(pin)))fail('Des indices ou épingles distants manquent. Fusionnez avant de remplacer.');
  for(const guess of existing.guesses){
    const next=incoming.guesses.find(g=>g.word===guess.word);
    if(!next)fail('Des essais distants manquent. Fusionnez avant de remplacer.');
    const merged=mergeGuessFacts(guess,next);
    if(merged.acceptedAt!==next.acceptedAt)fail('La date connue d’un essai distant manque. Fusionnez avant de remplacer.');
  }
}
function relevantRevision(storage:ProfileStorage,snapshot:ProfileSnapshot){const records=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&(k.startsWith('braise.v1.')||k.startsWith('braise.v2.profile.')||k.startsWith('braise.v2.backup.')||k===PLAY_CONTEXT_KEY))records.push([k,storage.getItem(k)]);}return JSON.stringify([records.sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),snapshot.pendingActivities,snapshot.activities,snapshot.transferLegacyRaw]);}
function unionGame(local:SavedGame,incoming:SavedGame,now:Date):SavedGame{
  validateGame(local,now);const guesses=[...local.guesses];for(const g of incoming.guesses){const existing=guesses.find(x=>x.word===g.word);if(existing){guesses[guesses.indexOf(existing)]=mergeGuessFacts(existing,g);}else guesses.push({...g,order:Math.max(0,...guesses.map(x=>x.order))+1});}
  const pins=[...new Set([...local.pins,...incoming.pins])];const hints=Math.max(local.hints,incoming.hints,guesses.filter(g=>g.hint).length);if(pins.length>3||guesses.length>3000||hints>3)fail('La fusion dépasserait la limite des épingles ou essais. Aucun élément supprimé.');
  return {...local,guesses,pins,hints,startedAt:Math.min(local.startedAt,incoming.startedAt),profileV2StartIndex:guesses.length};
}
export function inspectDeviceMerge(text:string,storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date()){
  const value=parseDeviceEnvelope(text,now);const staged=new SyncMemory(storage);const contexts=readContexts(staged);if(!contexts)fail('Contextes locaux illisibles.');
  const preview=inspectLocalProfileImport(value.profile,staged,now,snapshot);if(!preview.planId||!['ready','unchanged'].includes(preview.status))fail(preview.reason);
  for(const item of value.games){const key=PREFIX+item.id;const raw=staged.getItem(key);const local=raw?parseSavedGame(raw):null;
    if(contexts[item.id]&&item.context&&JSON.stringify(contexts[item.id])!==JSON.stringify(item.context))fail('Contextes différents pour une même partie : choisissez un appareil source.');
    const game=local?unionGame(local,item.game,now):{...item.game,profileV2StartIndex:item.game.guesses.length};staged.setItem(key,JSON.stringify(game));if(!contexts[item.id]&&item.context)contexts[item.id]=item.context;
  }
  staged.setItem(PLAY_CONTEXT_KEY,JSON.stringify({version:1,items:contexts}));
  const imported=importLocalProfile(value.profile,preview.planId,staged,snapshot,now);if(!imported.persisted)fail(imported.reason);
  return {revision:relevantRevision(storage,snapshot),staged,games:value.games.length,activities:preview.addedActivities,snapshot:imported.snapshot!};
}
/** Synchronous revision check and staged writes; rollback on quota failure. No game/reward effects. */
export function applyDeviceMerge(text:string,expectedRevision:string,storage:Storage,snapshot:ProfileSnapshot,now=new Date(),beforeCommit?:()=>boolean){
  if(relevantRevision(storage,snapshot)!==expectedRevision)fail('La progression locale a changé. Relisez un nouvel aperçu.');
  const plan=inspectDeviceMerge(text,storage,snapshot,now);const writes=[...plan.staged.values].filter(([k,v])=>storage.getItem(k)!==v);const before=writes.map(([k])=>[k,storage.getItem(k)] as const);
  if(beforeCommit&&!beforeCommit())fail('Une partie a évolué ou charge encore. Relisez un nouvel aperçu.');
  try{for(const[k,v]of writes){storage.setItem(k,v);if(storage.getItem(k)!==v)fail('Écriture locale non confirmée.');}}catch{for(const[k,v]of before){try{if(v===null)storage.removeItem(k);else storage.setItem(k,v);}catch{/* report partial storage failure below */}}fail('Stockage insuffisant : fusion interrompue. Vérifiez la sauvegarde locale avant de réessayer.');}
  return loadLocalProfile(storage);
}
