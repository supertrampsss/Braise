import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './support/social-database';
import {randomToken} from '../lib/server-security';
import {legacyTargetWord} from '../lib/semantic';
import {evaluateWord2vec,setWord2vecObjectLoaderForTests} from '../lib/word2vec.server';

async function setup(modern=false){
 const data=database(),tokens=[randomToken(),randomToken(),randomToken()];
 for(let i=0;i<3;i++)await data.store.createGuest(['Alice','Basile','Claire'][i],tokens[i],'csrf',100);
 const [a,b,c]=await Promise.all(tokens.map(token=>data.store.session(token,101)));
 const invite=randomToken();await data.duels.create(a!,'duel',invite,modern?['assiette','maison','chemin']:[0,1,2],102,modern?{rules:'duel-word2vec-v1'}:undefined);await data.duels.accept(b!,invite,103);
 return {...data,a:a!,b:b!,c:c!,invite};
}
const miss={word:'route',temperature:10,rank:100,found:false};

test('opponent progress is public but accepted words and all solutions stay hidden until both close',async()=>{
 const {sqlite,duels,a,b,c}=await setup();try{
  await duels.submit(a,'duel',0,0,'a-miss',miss,104);
  let view=(await duels.view(b.guest_id,'duel',105))!;
  assert.equal(view.rounds[0].opponent!.attempts,1);assert.equal(view.rounds[0].opponent!.bestRank,100);
  assert.equal(view.rounds[0].revealed,false);assert.equal(view.rounds[0].answer,undefined);assert.deepEqual(view.opponentGuesses,[]);
  assert(!JSON.stringify(view).includes('route'));assert(!Object.hasOwn(view,'targets'));assert.equal(await duels.view(c.guest_id,'duel'),null);
  await duels.submit(a,'duel',0,1,'a-win',{word:legacyTargetWord(0),temperature:100,rank:1,found:true},106);
  view=(await duels.view(b.guest_id,'duel',107))!;assert.equal(view.rounds[0].revealed,false);assert.equal(view.opponentGuesses.length,0);
  await duels.submit(b,'duel',0,0,'b-win',{word:legacyTargetWord(0),temperature:100,rank:1,found:true},108);
  view=(await duels.view(b.guest_id,'duel',109))!;
  assert.equal(view.state,'active');assert.equal(view.rounds[0].revealed,true);assert.equal(view.rounds[0].answer,legacyTargetWord(0));assert.equal(view.opponentGuesses.length,2);assert.equal(view.rounds[0].decision,1);
  assert.equal(view.rounds[1].answer,undefined);assert.equal(view.decisions,null);assert.deepEqual(view.score,{won:1,lost:0,drawn:0});
 }finally{sqlite.close();}
});

test('expiry and forfeit reveal every solution even with no winning guess, but unaccepted expiry reveals none',async()=>{
 for(const reason of ['deadline','forfeit']){const {sqlite,duels,a,b}=await setup();try{
  if(reason==='forfeit')await duels.end(a,'duel',true,104);
  const view=(await duels.view(b.guest_id,'duel',reason==='deadline'?103+48*3600000:105))!;
  assert.equal(view.state,'finished');assert.deepEqual(view.rounds.map(round=>round.answer),[0,1,2].map(legacyTargetWord));
 }finally{sqlite.close();}}
 const {sqlite,duels,a}=await setup();try{
  await duels.create(a,'pending',randomToken(),[0,1,2],104);
  const view=(await duels.view(a.guest_id,'pending',104+7*86400000))!;assert.equal(view.state,'expired');assert(view.rounds.every(round=>!round.revealed&&!round.answer));
 }finally{sqlite.close();}
});

test('Word2Vec duels store ranks above30000 and empty rounds cannot beat a real attempt',async()=>{
 const {sqlite,duels,a,b}=await setup(true);try{
  assert.equal(await duels.submit(a,'duel',0,0,'far',{...miss,rank:100000},104),'accepted');
  const view=(await duels.view(a.guest_id,'duel',103+48*3600000))!;
  assert.equal(view.vocabularySize,155562);assert.deepEqual(view.decisions,[-1,0,0]);assert.equal(view.rounds[0].answer,'assiette');
  assert.equal((await duels.view(b.guest_id,'duel',103+48*3600000))!.opponentGuesses[0].rank,100000);
 }finally{sqlite.close();}
});

test('a rematch is addressed to the same opponent, visible in their list, and requires their explicit acceptance',async()=>{
 const {sqlite,duels,a,b,c}=await setup();try{
  const targets=['ordinateur','musique','soleil'];await duels.end(a,'duel',true,104);const token=randomToken();
  assert(await duels.rematch(a,'duel','rematch',token,targets,105));
  const list=await duels.list(b.guest_id,106);assert(list.some(row=>row.id==='rematch'&&row.canAcceptRematch));
  assert.equal((await duels.get(a.guest_id,'rematch'))!.opponent_id,null);assert.equal(await duels.accept(c,token,107),null);assert.equal(await duels.acceptRematch(c,'rematch',107),null);
  assert(await duels.acceptRematch(b,'rematch',108));assert.equal((await duels.get(a.guest_id,'rematch'))!.opponent_id,b.guest_id);
  assert.equal((await duels.get(a.guest_id,'rematch'))!.deadline,108+48*3600000);
 }finally{sqlite.close();}
});

test('rematch rejects an active parent, a third party, reused targets, revoked sessions and expired invitations',async()=>{
 const {sqlite,duels,store,a,b,c}=await setup();try{
  assert.equal(await duels.rematch(a,'duel','too-soon',randomToken(),['ordinateur','musique','soleil'],104),null);
  await duels.end(a,'duel',true,105);
  assert.equal(await duels.rematch(c,'duel','third',randomToken(),['ordinateur','musique','soleil'],106),null);
  const token=randomToken();await duels.rematch(a,'duel','next',token,['ordinateur','musique','soleil'],106);
  assert.equal(await duels.acceptRematch(b,'next',106+7*86400000),null);
  await store.revokeSession(b);assert.equal(await duels.acceptRematch(b,'next',107),null);
 }finally{sqlite.close();}
});

test('the new duel engine uses exactly the current Word2Vec scores and old editions retain their targets',async()=>{
 setWord2vecObjectLoaderForTests(async key=>{const b=await readFile('public/'+key);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);});
 try{
  const {evaluateDuelWord,duelTargetWord}=await import('../lib/duel-engine.server');
  const modern={rules:'duel-word2vec-v1',targets:JSON.stringify(['assiette','maison','chemin'])};
  assert.deepEqual(await evaluateDuelWord(modern,0,'bol'),await evaluateWord2vec('assiette','bol'));
  assert.equal(duelTargetWord({rules:'duel-v1',targets:'[0,1,2]'},1),legacyTargetWord(1));
 }finally{setWord2vecObjectLoaderForTests(null);}
});
