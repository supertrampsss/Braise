import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {database} from './support/social-database';
import {randomToken,tokenHash} from '../lib/server-security';
import {GET,POST} from '../app/api/duels/route';
import type {DuelListPage,DuelView} from '../lib/duel-presentation';
import {readFile} from 'node:fs/promises';
import {setWord2vecObjectLoaderForTests} from '../lib/word2vec.server';

async function setup(){
 const data=database(),now=Date.now(),tokens=[randomToken(),randomToken(),randomToken()],csrf=['csrf-a','csrf-b','csrf-c'];
 for(let index=0;index<3;index++)await data.store.createGuest(['Alice','Basile','Claire'][index],tokens[index],csrf[index],now);
 const actors=await Promise.all(tokens.map(async(token,index)=>({session:(await data.store.session(token,now))!,cookie:'__Host-braise_session='+token,csrf:csrf[index]})));
 return {...data,actors,now};
}
type Actor=Awaited<ReturnType<typeof setup>>['actors'][number];
function request(path:string,actor?:Actor,body?:unknown,headers:Record<string,string>={}){
 return new Request('https://braiz.io'+path,{method:body?'POST':'GET',headers:{origin:'https://braiz.io','content-type':'application/json',...(actor?{cookie:actor.cookie,'x-braise-csrf':actor.csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
}

test('invitation renewal is owner-only, origin/CSRF checked, idempotent and invalidates the previous link',async()=>{
 const {sqlite,d1,duels,actors:[a,b,c],now}=await setup();Object.assign(env,{DB:d1});
 try{
  const id=crypto.randomUUID(),old=randomToken(),next=randomToken(),later=randomToken();await duels.create(a.session,id,old,[0,1,2],now);
  const view=(await duels.view(a.session.guest_id,id,now))!;assert.equal(view.invitationVersion,await tokenHash(old));assert(!JSON.stringify(view).includes(old));
  assert.equal((await GET(request('/api/duels?id='+id,c))).status,404);
  const body={action:'renew-invitation',id,previousVersion:view.invitationVersion,token:next};
  assert.equal((await POST(request('/api/duels',undefined,body))).status,403);
  assert.equal((await POST(request('/api/duels',a,body,{'x-braise-csrf':'wrong'}))).status,403);
  assert.equal((await POST(request('/api/duels',a,body,{origin:'https://other.test'}))).status,403);
  assert.equal((await POST(request('/api/duels',c,body))).status,409);
  for(let replay=0;replay<2;replay++){
   const response=await POST(request('/api/duels',a,body));assert.equal(response.status,200);
   const updated=await response.json() as DuelView;assert.equal(updated.invitationVersion,await tokenHash(next));assert.equal(updated.inviteExpires,view.inviteExpires);assert(!JSON.stringify(updated).includes(next));
  }
  assert.equal(await duels.accept(b.session,old,now+1),null);
  assert.equal((sqlite.prepare('SELECT token_hash FROM braise_duels WHERE id=?').get(id) as {token_hash:string}).token_hash,await tokenHash(next));
  assert.equal((await POST(request('/api/duels',a,{...body,previousVersion:await tokenHash(next),token:later}))).status,200);
  assert.equal((await POST(request('/api/duels',a,body))).status,409); // A stale retry cannot roll back a newer link.
  assert.equal(await duels.accept(b.session,next,now+2),null);assert(await duels.accept(b.session,later,now+2));
  assert.equal((await POST(request('/api/duels',a,{...body,previousVersion:await tokenHash(later)}))).status,409);
  assert.equal((await duels.view(b.session.guest_id,id,now+3))!.invitationVersion,undefined);
 }finally{sqlite.close();delete(env as Partial<Cloudflare.Env>).DB;}
});

test('renewal cannot revive cancelled or expired invitations, use revoked sessions, or modify a rematch',async()=>{
 const {sqlite,duels,store,actors:[a,b],now}=await setup();
 try{
  for(const state of ['cancelled','expired','accepted']){
   const id=crypto.randomUUID(),token=randomToken();await duels.create(a.session,id,token,[0,1,2],now);
   if(state==='cancelled')await duels.end(a.session,id,false,now+1);
   if(state==='accepted')await duels.accept(b.session,token,now+1);
   assert.equal(await duels.renewInvitation(a.session,id,await tokenHash(token),randomToken(),state==='expired'?now+7*86400000:now+2),false);
  }
  const parent=crypto.randomUUID(),token=randomToken();await duels.create(a.session,parent,token,[0,1,2],now);await duels.accept(b.session,token,now+1);await duels.end(a.session,parent,true,now+2);
  const id=crypto.randomUUID(),rematchToken=randomToken();await duels.rematch(a.session,parent,id,rematchToken,['ordinateur','musique','soleil'],now+3);
  assert.equal((await duels.view(a.session.guest_id,id,now+4))!.invitationVersion,undefined);
  assert.equal(await duels.renewInvitation(a.session,id,await tokenHash(rematchToken),randomToken(),now+4),false);
  const pending=crypto.randomUUID(),pendingToken=randomToken();await duels.create(a.session,pending,pendingToken,[0,1,2],now);
  await store.revokeSession(a.session);assert.equal(await duels.renewInvitation(a.session,pending,await tokenHash(pendingToken),randomToken(),now+1),false);
 }finally{sqlite.close();}
});

test('keyset pagination crosses fifty rows without duplicates, even on tied timestamps and new insertions',async()=>{
 const {sqlite,d1,duels,actors:[a,b],now}=await setup();Object.assign(env,{DB:d1});
 try{
  const insert=sqlite.prepare("INSERT INTO braise_duels(id,host_id,token_hash,targets,rules,state,created_at,invite_expires) VALUES (?,?,?,'[0,1,2]','duel-v1','cancelled',?,?)");
  const ids=Array.from({length:111},(_,index)=>'00000000-0000-4000-8000-'+index.toString().padStart(12,'0'));
  for(const [index,id] of ids.entries())insert.run(id,index===110?b.session.guest_id:a.session.guest_id,await tokenHash(id),now,now+86400000);
  const first=await duels.listPage(a.session.guest_id,{group:'finished'},now);assert.equal(first.duels.length,50);assert.equal(first.counts.finished,110);assert(first.nextCursor);assert(!JSON.stringify(first).includes('targets'));assert(!JSON.stringify(first).includes('token_hash'));
  const newest=crypto.randomUUID();insert.run(newest,a.session.guest_id,await tokenHash(newest),now+1,now+86400000);
  const second=await duels.listPage(a.session.guest_id,{group:'finished',cursor:first.nextCursor},now+2);assert.equal(second.duels.length,50);assert(second.nextCursor);
  const third=await duels.listPage(a.session.guest_id,{group:'finished',cursor:second.nextCursor},now+2);assert.equal(third.duels.length,10);assert.equal(third.nextCursor,null);
  const loaded=[...first.duels,...second.duels,...third.duels].map(row=>row.id);assert.equal(new Set(loaded).size,110);assert(!loaded.includes(ids[110]));assert(!loaded.includes(newest));
  assert.equal((await duels.listPage(a.session.guest_id,{group:'finished'},now+2)).duels[0].id,newest);
  for(const suffix of ['group=nope','group=play&cursor='+encodeURIComponent(first.nextCursor),'cursor=all:0:bad%27or1','cursor='+'x'.repeat(1000)])assert.equal((await GET(request('/api/duels?'+suffix,a))).status,400);
  assert.equal((await GET(request('/api/duels?group=finished'))).status,401);
  const response=await GET(request('/api/duels?group=finished&cursor='+encodeURIComponent(first.nextCursor),a));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json() as DuelListPage).duels.length,50);
 }finally{sqlite.close();delete(env as Partial<Cloudflare.Env>).DB;}
});

test('list groups prioritize playable rounds and addressed rematches, then pending opponents, then terminal duels',async()=>{
 const {sqlite,duels,actors:[a,b,c],now}=await setup();
 try{
  const play=crypto.randomUUID(),waiting=crypto.randomUUID(),invite=crypto.randomUUID(),parent=crypto.randomUUID();
  for(const id of [play,waiting,parent]){const token=randomToken();await duels.create(a.session,id,token,[0,1,2],now);await duels.accept(b.session,token,now+1);}
  await duels.create(a.session,invite,randomToken(),[0,1,2],now);
  for(let round=0;round<3;round++)await duels.submit(a.session,waiting,round,0,'win-'+round,{word:'test-'+round,rank:1,temperature:100,found:true},now+2);
  await duels.end(a.session,parent,true,now+2);
  const rematch=crypto.randomUUID();await duels.rematch(b.session,parent,rematch,randomToken(),['ordinateur','musique','soleil'],now+3);
  const page=await duels.listPage(a.session.guest_id,{group:'play'},now+4);assert.deepEqual(new Set(page.duels.map(row=>row.id)),new Set([play,rematch]));assert.deepEqual(page.counts,{play:2,waiting:2,finished:1});
  assert.deepEqual(new Set((await duels.listPage(a.session.guest_id,{group:'waiting'},now+4)).duels.map(row=>row.id)),new Set([waiting,invite]));
  assert.deepEqual((await duels.listPage(a.session.guest_id,{group:'finished'},now+4)).duels.map(row=>row.id),[parent]);
  assert.equal((await duels.listPage(c.session.guest_id,{},now+4)).duels.length,0);
  const expired=await duels.listPage(a.session.guest_id,{group:'play'},now+8*86400000);assert.equal(expired.duels.length,0);assert.equal(expired.counts.finished,5);
 }finally{sqlite.close();}
});

test('a real Word2Vec ligature rejection suggests only an available spelling without recording it as a guess',async()=>{
 const {sqlite,d1,duels,actors:[a,b],now}=await setup();Object.assign(env,{DB:d1});
 setWord2vecObjectLoaderForTests(async key=>{const bytes=await readFile('public/'+key);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);});
 try{
  const id=crypto.randomUUID(),token=randomToken();await duels.create(a.session,id,token,['assiette','maison','chemin'],now,{rules:'duel-word2vec-v1'});await duels.accept(b.session,token,now+1);
  const guess={action:'guess',id,round:0,revision:0,requestId:crypto.randomUUID(),word:'œuf'};
  let response=await POST(request('/api/duels',a,guess));assert.equal(response.status,422);
  assert.deepEqual(await response.json(),{error:'Mot absent du dictionnaire.',suggestion:'oeuf'});
  assert.equal((await duels.view(a.session.guest_id,id))!.guesses.length,0);
  response=await POST(request('/api/duels',a,{...guess,word:'cœurnonlexical'}));assert.equal(response.status,422);assert(!('suggestion' in (await response.json() as Record<string,unknown>)));
  response=await POST(request('/api/duels',a,{...guess,word:'oeuf',requestId:crypto.randomUUID()}));assert.equal(response.status,200);
  const view=await response.json() as DuelView;assert.equal(view.guesses.length,1);assert.equal(view.guesses[0].word,'oeuf');
 }finally{sqlite.close();delete(env as Partial<Cloudflare.Env>).DB;setWord2vecObjectLoaderForTests(null);}
});
