import {env} from 'cloudflare:workers';
import {authenticate,serverHeaders,unavailable} from '@/lib/server-runtime';
import {validMutationOrigin,tokenHash} from '@/lib/server-security';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:serverHeaders});
/** Read-only capability inspection. A visit never creates an identity or consumes an invite. */
export async function POST(request:Request){try{
 if(!env.DB)return unavailable();if(!validMutationOrigin(request))return reply({error:'Origine invalide.'},403);
 const raw=await request.text();if(raw.length>256)return reply({error:'Requête trop grande.'},413);let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invitation illisible.'},400);}
 if(!body||Object.keys(body).some(k=>!['kind','token'].includes(k))||!['circle','duel'].includes(body.kind)||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Invitation invalide.'},400);
 const hash=await tokenHash(body.token),now=Date.now(),session=await authenticate(request);
 if(body.kind==='circle'){
 const row=await env.DB.prepare(`SELECT i.*,c.name,(SELECT count(*) FROM braise_circle_members WHERE circle_id=c.id AND state='active') AS members FROM braise_circle_invites i JOIN braise_circles c ON c.id=i.circle_id WHERE token_hash=?`).bind(hash).first<{circle_id:string;name:string;revoked:number;expires_at:number;uses:number;members:number}>();if(!row)return reply({state:'unknown'});
 const membership=session?await env.DB.prepare('SELECT state FROM braise_circle_members WHERE circle_id=? AND guest_id=?').bind(row.circle_id,session.guest_id).first<{state:string}>():null;
 const state=membership?.state==='active'?'accepted':membership?.state==='excluded'?'excluded':row.revoked?'revoked':row.expires_at<=now?'expired':row.uses>=20||row.members>=20?'full':'ready';return reply({state,name:row.name,expiresAt:row.expires_at});
 }
 const row=await env.DB.prepare('SELECT host_id,opponent_id,state,invite_expires FROM braise_duels WHERE token_hash=?').bind(hash).first<{host_id:string;opponent_id:string|null;state:string;invite_expires:number}>();if(!row)return reply({state:'unknown'});
 const state=row.opponent_id===session?.guest_id?'accepted':row.host_id===session?.guest_id?'owner':row.state==='cancelled'?'revoked':row.opponent_id?'full':row.invite_expires<=now?'expired':'ready';return reply({state,expiresAt:row.invite_expires});
}catch{return unavailable();}}
