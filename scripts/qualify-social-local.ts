import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import assert from 'node:assert/strict';
import {GET,PUT,DELETE} from '../app/api/sync/route';
import {POST as inspectInvite} from '../app/api/invitations/route';
import {env} from '../tests/support/cloudflare-workers';
import {ServerStore} from '../lib/server-store';
import {CircleStore} from '../lib/circle-store';
import {randomToken} from '../lib/server-security';
import {createDeviceEnvelope,SyncMemory} from '../lib/device-sync';
import {loadLocalProfile} from '../lib/profile-storage';
const runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("D1 qualification only")}}',d1Databases:['DB'],d1Persist:mkdtempSync('work/d4-')});
try{
 const db=await runtime.getD1Database('DB');env.DB=db as unknown as D1Database;
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const store=new ServerStore(env.DB),circles=new CircleStore(env.DB),token=randomToken(),csrf='local-test';await store.createGuest('Local D1 qualification',token,csrf);const session=(await store.session(token))!;
 const request=(method:string,body?:unknown,path='/api/sync')=>new Request('https://braiz.io'+path,{method,headers:{origin:'https://braiz.io','Content-Type':'application/json',cookie:'__Host-braise_session='+token,'X-Braise-CSRF':csrf},...(body?{body:JSON.stringify(body)}:{})});
 const storage=new SyncMemory(),payload=createDeviceEnvelope(storage,loadLocalProfile(storage));assert.equal((await PUT(request('PUT',{revision:-1,payload}))).status,200);assert.equal((await PUT(request('PUT',{revision:-1,payload}))).status,409);assert.equal((await GET(request('GET'))).status,200);assert.equal((await DELETE(request('DELETE',{revision:0}))).status,200);assert.equal((await store.syncSnapshot(session.guest_id))?.payload,null);
 const richer=JSON.parse(payload);richer.games=[{id:'free-001',game:{guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1,hint:true,acceptedAt:'2026-10-01T12:00:00Z'}],pins:[],hints:1,startedAt:1}}];
 const richPayload=JSON.stringify(richer);assert.equal((await PUT(request('PUT',{revision:1,payload:richPayload}))).status,200);
 delete richer.games[0].game.guesses[0].hint;delete richer.games[0].game.guesses[0].acceptedAt;
 assert.equal((await PUT(request('PUT',{revision:2,payload:JSON.stringify(richer)}))).status,409);assert.equal((await store.syncSnapshot(session.guest_id))?.payload,richPayload);
 const id=crypto.randomUUID(),invitation=randomToken();await circles.create(session,id,'Qualification locale');assert.ok(await circles.setGoal(session,id,1));await circles.invite(session,id,invitation);const inspected=await inspectInvite(request('POST',{kind:'circle',token:invitation},'/api/invitations'));assert.equal(inspected.status,200);assert.deepEqual((await inspected.json() as {destination:unknown}).destination,{kind:'circle',id});assert.equal((await circles.goal(session.guest_id,id))?.completed,0);
 const {weekStartParis}=await import('../lib/weekly-ritual');const challenge=(await circles.challenge(session,id,weekStartParis(),'001'))!;const game=(await circles.enter(session,challenge.id))!;
 const won={word:'fixture',temperature:100,rank:1,found:true};assert.equal(await store.submit(session,game,0,'local-proof',won),'accepted');assert.equal(await store.submit(session,game,0,'local-proof',won),'replayed');assert.equal((await circles.goal(session.guest_id,id))?.completed,1);assert.equal((await circles.goal(session.guest_id,id))?.achieved,true);
 await store.revokeSession(session);assert.equal((await PUT(request('PUT',{revision:1,payload}))).status,403);
 console.log('PASS real local D1: migrations0000-0005, authenticated sync, revision409, delete-own-copy, revoked403, circle goal, read-only owned invitation destination, metadata loss409 with intact cloud bytes. No production data.');
}finally{delete env.DB;await runtime.dispose();}
