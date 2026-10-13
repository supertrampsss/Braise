import { z } from 'zod';
import { createLocalProfileExport, inspectLocalProfileImport, importLocalProfile, loadLocalProfile, type ProfileSnapshot, type ProfileStorage } from './profile-storage';
import { PLAY_CONTEXT_KEY, readContexts } from './play-hub';
import { archiveDateStatus, parisDate } from './calendar';
import type { SavedGame } from './game-types';
import { DAILY_V2_START, dailyV2Date, dailyV2Ref, isDailyV2Ref } from './daily-v2-contract';
import { dailyV2Document, dailyV2GameSchema, parseDailyV2Document } from './daily-v2-storage';
import { isWord2vecRef, isWord2vecId, word2vecDate, word2vecRef, WORD2VEC_START } from './word2vec-contract';
import { word2vecDocument, word2vecGameSchema, parseWord2vecDocument } from './word2vec-storage';
export const SYNC_MAX_BYTES = 1 * 1024 * 1024;
const PREFIX = 'braise.v1.game.';
const instant = z.string().datetime();
const contextSchema = z.object({ mode:z.enum(['daily','archive','free','challenge']), collection:z.string().max(80).optional(), expedition:z.string().max(80).optional(), expeditionStep:z.number().int().min(1).max(3).optional() }).strict();
const guessSchema = z.object({word:z.string().min(1).max(50),temperature:z.number().min(-100).max(100),rank:z.number().int().min(1).max(30000),found:z.boolean(),order:z.number().int().min(1).max(3000),hint:z.boolean().optional(),acceptedAt:instant.optional()}).strict();
const gameSchema = z.object({ guesses:z.array(guessSchema).max(3000),pins:z.array(z.string().min(1).max(50)).max(3),hints:z.number().int().min(0).max(3),startedAt:z.number().int().nonnegative(),solvedAt:z.number().int().nonnegative().optional(),completedMode:z.enum(['daily','archive','free','challenge']).optional(),profileV2StartIndex:z.number().int().nonnegative().optional(),version:z.literal(1).optional(),schemaVersion:z.literal(1).optional(),formatVersion:z.literal(1).optional() }).strict();
const legacyItem=z.object({id:z.string().max(40),game:gameSchema,context:contextSchema.optional()}).strict();
const v2Item=z.object({id:z.string().max(40),puzzleRef:z.custom<import('./game-contracts').PuzzleRef>(isDailyV2Ref),game:dailyV2GameSchema,context:contextSchema.optional()}).strict();
const word2vecItem=z.object({id:z.string().max(40),puzzleRef:z.custom<import('./game-contracts').PuzzleRef>(isWord2vecRef),game:word2vecGameSchema,context:contextSchema.optional()}).strict();
const legacySchema=z.object({format:z.literal('braiz-personal-device-sync'),version:z.literal(1),corpus:z.literal('fr-fasttext-30000-v1'),rules:z.literal('classic-v1'),provenance:z.literal('personal-unverified'),createdAt:instant,profile:z.string().max(8*1024*1024),games:z.array(legacyItem).max(1000)}).strict();
const mixedSchema=z.object({format:z.literal('braiz-personal-device-sync'),version:z.literal(2),corpus:z.literal('mixed-v1-v2'),rules:z.literal('identity-bound'),provenance:z.literal('personal-unverified'),createdAt:instant,profile:z.string().max(8*1024*1024),games:z.array(z.union([legacyItem,v2Item])).max(1000)}).strict();
const word2vecSchema=z.object({format:z.literal('braiz-personal-device-sync'),version:z.literal(3),corpus:z.literal('mixed-v1-v2-word2vec'),rules:z.literal('identity-bound'),provenance:z.literal('personal-unverified'),createdAt:instant,profile:z.string().max(8*1024*1024),games:z.array(z.union([legacyItem,v2Item,word2vecItem])).max(1000)}).strict();
const schema=z.union([legacySchema,mixedSchema,word2vecSchema]);
export type DeviceEnvelope=z.infer<typeof schema>;
export class SyncMemory implements ProfileStorage {
  values=new Map<string,string>();
  constructor(storage?:ProfileStorage) { if(storage) for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key!==null){const value=storage.getItem(key);if(value!==null)this.values.set(key,value);}} }
  get length(){return this.values.size;} key(i:number){return [...this.values.keys()][i]??null;} getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);}
}
function fail(message:string):never{throw new Error(message);}
function parseJson(text:string):unknown{try{return JSON.parse(text);}catch{return fail('Copie JSON illisible. Aucune donnée modifiée.');}}
function parseSavedGame(text:string,id:string):SavedGame{const value=parseJson(text);if(isWord2vecId(id)){const game=parseWord2vecDocument(value,id);if(!game)fail('Sauvegarde de partie inconnue ou incompatible.');return game;}if(id.startsWith('daily-v2-')){const game=parseDailyV2Document(value,id);if(!game)fail('Sauvegarde V2 inconnue ou incompatible.');return game;}const parsed=gameSchema.safeParse(value);if(!parsed.success)fail('Sauvegarde de partie illisible, inconnue ou incompatible.');return parsed.data;}
function validId(id:string,now:Date){if(isWord2vecId(id))return (word2vecDate(id)??WORD2VEC_START)<=parisDate(now);const v2=dailyV2Date(id);return v2 ? v2<=parisDate(now) : /^free-\d{1,10}$/.test(id)&&Number(id.slice(5))<=2147483647 || /^daily-\d{4}-\d{2}-\d{2}$/.test(id)&&id.slice(6)<DAILY_V2_START&&(archiveDateStatus(id.slice(6),now)==='available'||id.slice(6)===parisDate(now));}
function validateGame(game:SavedGame,now:Date){
  if(game.startedAt>now.getTime()||(game.solvedAt??0)>now.getTime()||game.guesses.some(g=>g.acceptedAt&&Date.parse(g.acceptedAt)>now.getTime())||new Set(game.guesses.map(g=>g.word)).size!==game.guesses.length||new Set(game.guesses.map(g=>g.order)).size!==game.guesses.length||(game.profileV2StartIndex??0)>game.guesses.length) fail('Partie incohérente ou datée dans le futur.');
}
export function parseDeviceEnvelope(text:string,now=new Date()):DeviceEnvelope{
  if(new TextEncoder().encode(text).length>SYNC_MAX_BYTES)fail('Copie trop grande (1 Mio maximum), aucune donnée tronquée.');
  const result=schema.safeParse(parseJson(text));if(!result.success)fail('Format de synchronisation inconnu, futur ou incohérent.');const value=result.data;
  if(value.version===1 && value.profile.includes('"classic-v2"'))fail('Une copie V1 ne peut déclarer des parties V2.');
  if(value.version!==3&&value.profile.includes('"word2vec-v1"'))fail('Une copie ancienne ne peut déclarer cette édition.');
  if(Date.parse(value.createdAt)>now.getTime()||new Set(value.games.map(g=>g.id)).size!==value.games.length)fail('Copie incohérente ou datée dans le futur.');
  const rawProfile=parseJson(value.profile) as {legacyRaw?:unknown};
  if(rawProfile&&typeof rawProfile.legacyRaw==='string'){const legacy=z.object({wins:z.array(z.object({id:z.string(),date:z.string(),mode:z.enum(['daily','free','challenge']),tries:z.number(),hints:z.number()}).strict()),guesses:z.number(),sound:z.boolean()}).strict();if(!legacy.safeParse(parseJson(rawProfile.legacyRaw)).success)fail('La copie historique contient des champs inconnus : transfert refusé.');}
  const profile=inspectLocalProfileImport(value.profile,new SyncMemory(),now);if(!['ready','unchanged'].includes(profile.status))fail(profile.reason);
  for(const item of value.games){if(!validId(item.id,now))fail('Identité de partie incompatible.');const v2=dailyV2Date(item.id),w2v=isWord2vecId(item.id);if(w2v?value.version!==3||!('puzzleRef' in item)||!isWord2vecRef(item.puzzleRef,now)||!parseWord2vecDocument({schemaVersion:3,puzzleRef:item.puzzleRef,game:item.game},item.id):v2 ? value.version===1 || !('puzzleRef' in item) || !isDailyV2Ref(item.puzzleRef,now) || item.puzzleRef.id!==item.id : 'puzzleRef' in item)fail('Référence de partie incompatible.');validateGame(item.game,now);const published=v2??(w2v?(word2vecDate(item.id)??WORD2VEC_START):null);if(published&&(parisDate(new Date(item.game.startedAt))<published||item.game.guesses.some(g=>g.acceptedAt&&parisDate(new Date(g.acceptedAt))<published)))fail('Partie antérieure à sa publication.');if(item.game.guesses.some(g=>g.found)||item.game.solvedAt)fail('Seules les parties en cours appartiennent à cette copie.');
    if(item.context){const memory=new SyncMemory();memory.setItem(PLAY_CONTEXT_KEY,JSON.stringify({version:1,items:{[item.id]:item.context}}));if(!readContexts(memory)||item.id.startsWith('daily-')!==['daily','archive'].includes(item.context.mode))fail('Contexte de partie incohérent.');}
  }return value;
}
export function createDeviceEnvelope(storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date()){
  const profile=createLocalProfileExport(snapshot,now);if(!profile.ok)fail(profile.reason);
  const contexts=readContexts(storage);if(!contexts)fail('Contextes locaux illisibles : copie refusée.');
  const games:z.infer<typeof word2vecSchema>['games']=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;const id=key.slice(PREFIX.length);const game=parseSavedGame(storage.getItem(key)!,id);validateGame(game,now);if(!validId(id,now))fail('Une partie locale utilise une identité inconnue.');if(game.guesses.some(g=>g.found)||game.solvedAt)continue;const date=dailyV2Date(id);games.push({id,game,...(isWord2vecId(id)?{puzzleRef:word2vecRef(id,word2vecDate(id)?'daily':'free')}:date?{puzzleRef:dailyV2Ref(date,'daily')} : {}),...(contexts[id]?{context:contexts[id]}:{})});}
  const mixed=games.some(item=>'puzzleRef' in item)||profile.text.includes('"classic-v2"');
  const w2v=games.some(item=>isWord2vecId(item.id))||profile.text.includes('"word2vec-v1"');
  const value={format:'braiz-personal-device-sync',...(w2v?{version:3,corpus:'mixed-v1-v2-word2vec',rules:'identity-bound'}:mixed?{version:2,corpus:'mixed-v1-v2',rules:'identity-bound'}:{version:1,corpus:'fr-fasttext-30000-v1',rules:'classic-v1'}),provenance:'personal-unverified',createdAt:now.toISOString(),profile:profile.text,games};const text=JSON.stringify(value);parseDeviceEnvelope(text,now);return text;
}
/** Reconcile the current memory facts and latest disk facts in a private staging copy only. */
export type LiveDeviceGame={id:string;game:SavedGame};
export function prepareDeviceUpload(storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date(),live?:LiveDeviceGame|null){
  const incomplete='La partie en mémoire n’est pas entièrement enregistrée. Envoi refusé pour éviter une copie incomplète. Réessayez après une sauvegarde réussie.';
  if(live&&(live.game.guesses.length||live.game.pins.length||live.game.hints)){
    const raw=storage.getItem(PREFIX+live.id);if(!raw)fail(incomplete);
    const saved=parseSavedGame(raw,live.id);try{assertGameFactsPreserved(live.game,saved);}catch{fail(incomplete);}
  }
  // Pending profile facts cannot stand in for a missing playable save, even without a mounted board.
  for(const fact of snapshot.pendingActivities){
    if(fact.type!=='guessAccepted'||fact.puzzleRef.variant!=='classic'||!validId(fact.puzzleRef.id,now)||snapshot.profile.wins.some(win=>win.id===fact.puzzleRef.id))continue;
    const raw=storage.getItem(PREFIX+fact.puzzleRef.id);
    if(!raw||!parseSavedGame(raw,fact.puzzleRef.id).guesses.some(guess=>guess.word===fact.word&&!guess.hint))fail(incomplete);
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
/** Bind a prepared upload to its disk facts, complete memory profile and live board. */
export function deviceUploadRevision(storage:ProfileStorage,snapshot:ProfileSnapshot,live?:LiveDeviceGame|null){
  return JSON.stringify([relevantRevision(storage,snapshot),snapshot.transferBase,snapshot.transferEvidence,live??null]);
}
function unionGame(local:SavedGame,incoming:SavedGame,now:Date):SavedGame{
  validateGame(local,now);const guesses=[...local.guesses];for(const g of incoming.guesses){const existing=guesses.find(x=>x.word===g.word);if(existing){guesses[guesses.indexOf(existing)]=mergeGuessFacts(existing,g);}else guesses.push({...g,order:Math.max(0,...guesses.map(x=>x.order))+1});}
  const pins=[...new Set([...local.pins,...incoming.pins])];const hints=Math.max(local.hints,incoming.hints,guesses.filter(g=>g.hint).length);if(pins.length>3||guesses.length>3000||hints>3)fail('La fusion dépasserait la limite des épingles ou essais. Aucun élément supprimé.');
  return {...local,guesses,pins,hints,startedAt:Math.min(local.startedAt,incoming.startedAt),profileV2StartIndex:guesses.length};
}
export function inspectDeviceMerge(text:string,storage:ProfileStorage,snapshot:ProfileSnapshot,now=new Date()){
  const value=parseDeviceEnvelope(text,now);const staged=new SyncMemory(storage);const contexts=readContexts(staged);if(!contexts)fail('Contextes locaux illisibles.');
  const preview=inspectLocalProfileImport(value.profile,staged,now,snapshot);if(!preview.planId||!['ready','unchanged'].includes(preview.status))fail(preview.reason);
  for(const item of value.games){const key=PREFIX+item.id;const raw=staged.getItem(key);const local=raw?parseSavedGame(raw,item.id):null;
    if(contexts[item.id]&&item.context&&JSON.stringify(contexts[item.id])!==JSON.stringify(item.context))fail('Contextes différents pour une même partie : choisissez un appareil source.');
    const game=local?unionGame(local,item.game,now):{...item.game,profileV2StartIndex:item.game.guesses.length};staged.setItem(key,JSON.stringify(isWord2vecId(item.id)?word2vecDocument(item.id,game):dailyV2Date(item.id)?dailyV2Document(item.id,game):game));if(!contexts[item.id]&&item.context)contexts[item.id]=item.context;
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
