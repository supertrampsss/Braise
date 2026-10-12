import { authenticate, serverHeaders, store, unavailable } from '@/lib/server-runtime';
import { parseDeviceEnvelope, inspectDeviceMerge, SyncMemory, SYNC_MAX_BYTES } from '@/lib/device-sync';
import { loadLocalProfile } from '@/lib/profile-storage';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:serverHeaders});
export async function GET(request:Request){try{const session=await authenticate(request);if(!session)return reply({error:'Retrouvez votre identité dans Votre espace.'},401);const row=await store().syncSnapshot(session.guest_id);return reply({revision:row?.revision??-1,payload:row?.payload??null,updatedAt:row?.updated_at??null});}catch{return unavailable();}}
async function mutation(request:Request,remove:boolean){
  try{
    const session=await authenticate(request,true);if(!session)return reply({error:'Session ou origine invalide.'},403);
    // Stream bound: Content-Length alone is neither mandatory nor trustworthy.
    const reader=request.body?.getReader();if(!reader)return reply({error:'Requête vide.'},400);const chunks:Uint8Array[]=[];let bytes=0;
    while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>SYNC_MAX_BYTES*2+1024){await reader.cancel();return reply({error:'Copie trop grande.'},413);}chunks.push(value);}
    const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(buffer));}catch{return reply({error:'JSON illisible.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['revision',...(remove?[]:['payload'])].includes(k))||!Number.isSafeInteger(body.revision)||body.revision < -1||(!remove&&typeof body.payload!=='string'))return reply({error:'Format invalide.'},400);
    const current=await store().syncSnapshot(session.guest_id);if((current?.revision??-1)!==body.revision)return reply({error:'La copie distante a changé. Rechargez son aperçu.'},409);
    if(!remove){
      try{parseDeviceEnvelope(body.payload);if(current?.payload){const memory=new SyncMemory();const existing=parseDeviceEnvelope(current.payload);const profile=loadLocalProfile(memory);inspectDeviceMerge(current.payload,memory,profile); // Validate existing baseline too.
        // Both historical baselines must agree; union content must be explicitly downloaded before replacement.
        const incoming=parseDeviceEnvelope(body.payload);const a=JSON.parse(existing.profile),b=JSON.parse(incoming.profile);
        if(a.legacyRaw!==null&&a.legacyRaw!==b.legacyRaw)throw new Error('Historiques V1 incompatibles.');
        const facts=new Set([...b.activities,...b.evidence].map((item:unknown)=>JSON.stringify(item)));if([...a.activities,...a.evidence].some((item:unknown)=>!facts.has(JSON.stringify(item))))throw new Error('Fusionnez d’abord la progression distante : des faits manquent dans cet envoi.');
        for(const item of existing.games){const next=incoming.games.find(g=>g.id===item.id);if(!next)throw new Error('Une partie distante manque. Fusionnez-la avant de remplacer la copie, ou supprimez explicitement la copie distante.');if(item.context&&JSON.stringify(item.context)!==JSON.stringify(next.context))throw new Error('Un contexte distant a changé. Fusionnez avant de remplacer.');if(next.game.hints<item.game.hints)throw new Error('Des indices distants manquent. Fusionnez avant de remplacer.');if(item.game.guesses.some(g=>!next.game.guesses.some(n=>n.word===g.word&&n.rank===g.rank&&n.temperature===g.temperature))||item.game.pins.some(p=>!next.game.pins.includes(p)))throw new Error('Des essais ou épingles distants manquent. Fusionnez avant de remplacer.');}
      }}catch(cause){return reply({error:cause instanceof Error?cause.message:'Copie invalide.'},400);}
    }
    const result=await store().saveSync(session,body.revision,remove?null:body.payload);return result?reply({revision:result.revision,payload:result.payload,updatedAt:result.updated_at}):reply({error:'La session ou la copie a changé. Rechargez.'},409);
  }catch{return unavailable();}
}
export const PUT=(request:Request)=>mutation(request,false);
export const DELETE=(request:Request)=>mutation(request,true);
