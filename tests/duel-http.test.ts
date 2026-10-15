import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {env} from 'cloudflare:workers';
import {database} from './support/social-database';
import {GET,POST} from '../app/api/duels/route';
import {POST as register,DELETE as logout} from '../app/api/session/route';
import {setWord2vecObjectLoaderForTests} from '../lib/word2vec.server';

test('actual duel HTTP routes preserve secrets, use Word2Vec, reveal completed rounds and address a rematch',async()=>{
 const {sqlite,d1}=database();Object.assign(env,{DB:d1});
 setWord2vecObjectLoaderForTests(async key=>{const b=await readFile('public/'+key);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);});
 type Actor={cookie:string;csrf:string};const actors:Actor[]=[];
 const origin='https://braiz.io';
 const request=(path:string,actor?:Actor,body?:unknown,method=body?'POST':'GET')=>new Request(origin+path,{method,headers:{origin,'content-type':'application/json',...(actor?{cookie:actor.cookie,'x-braise-csrf':actor.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  for(const name of ['HTTP Alice','HTTP Basile','HTTP Claire']){const response=await register(request('/api/session',undefined,{name}));assert.equal(response.status,200);const data=await response.json() as {csrf:string};actors.push({csrf:data.csrf,cookie:response.headers.get('set-cookie')!.split(';')[0]});}
  const [a,b,c]=actors,id=crypto.randomUUID(),token='a'.repeat(64);
  let response=await POST(request('/api/duels',a,{action:'create',id,token}));assert.equal(response.status,200);let view=await response.json() as any;
  assert.equal(view.rules,'duel-word2vec-v1');assert.equal(view.vocabularySize,155562);assert(!('targets'in view));
  assert.equal((await GET(request('/api/duels?id='+id,c))).status,404);
  response=await POST(request('/api/duels',b,{action:'accept',token}));assert.equal(response.status,200);
  const targets=JSON.parse((sqlite.prepare('SELECT targets FROM braise_duels WHERE id=?').get(id) as {targets:string}).targets) as string[];
  assert.equal(new Set(targets).size,3);
  for(let round=0;round<3;round++){
   response=await POST(request('/api/duels',a,{action:'guess',id,round,revision:0,requestId:crypto.randomUUID(),word:targets[round]}));assert.equal(response.status,200);
   view=await (await GET(request('/api/duels?id='+id,b))).json();assert.equal(view.rounds[round].revealed,false);assert.equal(view.rounds[round].answer,undefined);assert(!view.opponentGuesses.some((g:any)=>g.round===round));
   response=await POST(request('/api/duels',b,{action:'guess',id,round,revision:0,requestId:crypto.randomUUID(),word:targets[round]}));assert.equal(response.status,200);view=await response.json();assert.equal(view.rounds[round].answer,targets[round]);assert.equal(view.rounds[round].revealed,true);
  }
  assert.equal(view.state,'finished');assert.deepEqual(view.decisions,[0,0,0]);assert.equal(view.opponentGuesses.length,3);
  const next=crypto.randomUUID(),nextToken='b'.repeat(64);
  response=await POST(request('/api/duels',a,{action:'rematch',id:next,parentId:id,token:nextToken}));assert.equal(response.status,200);
  const newTargets=JSON.parse((sqlite.prepare('SELECT targets FROM braise_duels WHERE id=?').get(next) as {targets:string}).targets) as string[];assert(newTargets.every(word=>!targets.includes(word)));
  assert.equal((await POST(request('/api/duels',c,{action:'accept',token:nextToken}))).status,409);
  assert.equal((await POST(request('/api/duels',c,{action:'accept-rematch',id:next}))).status,409);
  const list=await (await GET(request('/api/duels',b))).json() as {duels:any[]};assert(list.duels.some(row=>row.id===next&&row.canAcceptRematch));
  response=await POST(request('/api/duels',b,{action:'accept-rematch',id:next}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 }finally{for(const actor of actors)await logout(request('/api/session',actor,undefined,'DELETE'));sqlite.close();delete(env as Partial<Cloudflare.Env>).DB;setWord2vecObjectLoaderForTests(null);}
});
