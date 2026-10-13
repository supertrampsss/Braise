import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveClassicGame } from '../lib/classic-game.server';
import { setWord2vecObjectLoaderForTests } from '../lib/word2vec.server';
import { setSemanticObjectLoaderForTests } from '../lib/semantic-storage';
import { GET, POST } from '../app/api/game/route';
import { getLegacyPuzzle } from '../lib/legacy-puzzles';
import { writeAdmittedGame, recordAdmittedGameProgress } from '../lib/game-write-admission';
import { restoreLegacyGame } from '../lib/legacy-storage';
import { SyncMemory, createDeviceEnvelope, inspectDeviceMerge, applyDeviceMerge, parseDeviceEnvelope } from '../lib/device-sync';
import { loadLocalProfile, recordLocalGameProgress, createLocalProfileExport, inspectLocalProfileImport, importLocalProfile } from '../lib/profile-storage';
import { readLocalPlays } from '../lib/play-hub';
import { resumeExpedition } from '../lib/expedition-resume';
import { retryPuzzleLoad, admittedPuzzleUrl } from '../lib/game-navigation';
import { collectDiscoveryHistory, DISCOVERY_KEY } from '../lib/free-discovery';
import type { PuzzleRef } from '../lib/game-contracts';
import { discoverFree, legacyEncounterIdentityForWord } from '../lib/free-discovery.server';
import { collectionProgress, NATURE_COLLECTION } from '../lib/collections';
import { expeditionStatus } from '../lib/expedition-server';
import historical from '../data/legacy-v1.json';
const now = new Date('2026-10-13T12:00:00Z');
const corpus = 'frwac-word2vec-155562-d617b3a27db2-v1';
const ref = (id: string, context: 'daily'|'archive'|'free'|'challenge'='daily'):PuzzleRef => ({ contractVersion:1,id,corpusVersion:corpus,rulesVersion:'word2vec-v1',variant:'classic',context,calendar:id.startsWith('daily-')?{version:'paris-daily-word2vec-v1',date:id.slice(10)}:null });
const game = (rank=150000) => ({ guesses:[{word:'maison',temperature:12.34,rank,found:false,order:1,acceptedAt:now.toISOString()}],pins:['maison'],hints:0,startedAt:now.getTime() });
class Memory extends SyncMemory { removeItem(key:string){this.values.delete(key);} clear(){this.values.clear();} }
async function asset(key:string){const b=await readFile('public/'+key);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}

test('classic cutover is Paris midnight, immutable across archives, with exact historical dispatch',async()=>{
  setWord2vecObjectLoaderForTests(asset);
  const before=await resolveClassicGame('daily','',undefined,new Date('2026-10-12T21:59:59Z'),{});
  assert.equal(before.publicPuzzle.id,'daily-2026-10-12');before.close();
  const first=await resolveClassicGame('daily','',undefined,new Date('2026-10-12T22:00:00Z'),{});
  assert.equal(first.publicPuzzle.id,'daily-w2v-2026-10-13');assert.equal(first.targetWord,'assiette');
  assert.equal(first.publicPuzzle.vocabularySize,155562);assert.equal(first.publicPuzzle.ref.corpusVersion,corpus);
  const archive=await resolveClassicGame('archive','','2026-10-13',new Date('2026-10-14T12:00:00Z'),{});
  assert.equal(archive.targetWord,first.targetWord);assert.equal(archive.publicPuzzle.id,first.publicPuzzle.id);first.close();archive.close();
});
test('API serves the new edition and rejects unknown, missing/forged refs, hints and broken assets',async t=>{
  t.mock.timers.enable({apis:['Date'],now});setWord2vecObjectLoaderForTests(asset);
  const response=await GET(new Request('https://braiz.test/api/game'));assert.equal(response.status,200);
  const puzzle=await response.json() as {id:string;ref:PuzzleRef};assert.equal(puzzle.id,'daily-w2v-2026-10-13');
  const post=(extra:Record<string,unknown>)=>POST(new Request('https://braiz.test/api/game',{method:'POST',body:JSON.stringify({mode:'daily',puzzleId:puzzle.id,puzzleRef:puzzle.ref,action:'guess',word:'assiette',...extra})}));
  assert.equal((await post({})).status,200);assert.equal((await post({word:'zzzbraizinconnu'})).status,422);
  assert.equal((await post({puzzleRef:undefined})).status,409);assert.equal((await post({puzzleRef:{...puzzle.ref,rulesVersion:'classic-v1'}})).status,409);
  assert.equal((await post({action:'hint'})).status,410);
  assert.equal((await GET(new Request('https://braiz.test/api/game?mode=archive&date=2026-10-12&edition=word2vec-v1'))).status,409);
  assert.equal((await GET(new Request('https://braiz.test/api/game?mode=free&seed=42&edition=classic-v2'))).status,409);
  const tutorial=await GET(new Request('https://braiz.test/api/game?tutorial=1'));assert.equal(tutorial.status,200);const example=await tutorial.json() as {ref:PuzzleRef;seed:string};assert.equal(example.ref.rulesVersion,'word2vec-v1');
  const exampleService=await resolveClassicGame('free',example.seed,undefined,now,{});assert.notEqual(exampleService.targetWord,'assiette');exampleService.close();
  setWord2vecObjectLoaderForTests(async()=>null);assert.equal((await GET(new Request('https://braiz.test/api/game'))).status,503);assert.equal((await post({})).status,503);
  t.mock.timers.reset();setWord2vecObjectLoaderForTests(null);
});
test('explicit old API refs preserve seed identity and raw legacy scores after cutover',async t=>{
  t.mock.timers.enable({apis:['Date'],now});setSemanticObjectLoaderForTests(asset);setWord2vecObjectLoaderForTests(asset);
  const old=getLegacyPuzzle('free','042',now).publicPuzzle;
  const response=await GET(new Request('https://braiz.test/api/game?mode=free&seed=042&edition=classic-v1'));assert.equal(response.status,200);const puzzle=await response.json() as {ref:PuzzleRef};assert.deepEqual(puzzle.ref,old.ref);
  const value=await POST(new Request('https://braiz.test/api/game',{method:'POST',body:JSON.stringify({mode:'free',seed:'042',puzzleId:old.id,puzzleRef:old.ref,action:'guess',word:'maison'})}));assert.equal(value.status,200);assert.equal((await value.json() as {puzzleRef:PuzzleRef}).puzzleRef.corpusVersion,'fr-fasttext-30000-v1');
  t.mock.timers.reset();setSemanticObjectLoaderForTests(null);setWord2vecObjectLoaderForTests(null);
});
test('strict new saves and mixed transfers preserve historical bytes, full ranks and neutral repeated credit',()=>{
  const source=new Memory(),id='daily-w2v-2026-10-13',old=JSON.stringify(game(42));source.setItem('braise.v1.game.free-042',old);
  assert.equal(writeAdmittedGame(source,id,game()),true);const doc=JSON.parse(source.getItem('braise.v1.game.'+id)!);assert.equal(doc.schemaVersion,3);assert.deepEqual(doc.puzzleRef,ref(id));
  assert.equal(restoreLegacyGame(id,now.getTime(),source).guesses[0].rank,150000);assert.equal(source.getItem('braise.v1.game.free-042'),old);
  const puzzle={id,mode:'daily' as const,seed:'2026-10-13',date:'2026-10-13',number:37,vocabularySize:155562,resetAt:now.toISOString(),ref:ref(id)};
  const profile=recordAdmittedGameProgress(puzzle,{...game(),profileV2StartIndex:0},source)!;const exported=createLocalProfileExport(profile,now);assert(exported.ok);assert.equal(JSON.parse(exported.text).exportVersion,3);
  const dest=new Memory();let snapshot=loadLocalProfile(dest);const copy=createDeviceEnvelope(source,profile,now);assert.equal(parseDeviceEnvelope(copy,now).version,3);
  for(let i=0;i<2;i++){const plan=inspectDeviceMerge(copy,dest,snapshot,now);snapshot=applyDeviceMerge(copy,plan.revision,dest as unknown as Storage,snapshot,now);}
  assert.equal(snapshot.profile.guesses,1);assert.equal(restoreLegacyGame(id,now.getTime(),dest).guesses[0].rank,150000);assert.equal(dest.getItem('braise.v1.game.free-042'),JSON.stringify({...game(42),profileV2StartIndex:1}));
  assert.equal(readLocalPlays(dest,now).find(p=>p.id===id)?.href,'/?edition=word2vec-v1');assert(collectDiscoveryHistory(dest,snapshot,now).includes(id));
  const malformed=JSON.parse(copy);malformed.games.find((g:{id:string})=>g.id===id).game.guesses[0].rank=155563;assert.throws(()=>parseDeviceEnvelope(JSON.stringify(malformed),now));
  const forged=JSON.parse(exported.text);forged.activities[0].puzzleRef.corpusVersion='wrong';assert.equal(inspectLocalProfileImport(JSON.stringify(forged),new Memory(),now).status,'invalid');
  const transferDest=new Memory();const preview=inspectLocalProfileImport(exported.text,transferDest,now);assert.equal(preview.status,'ready');assert(importLocalProfile(exported.text,preview.planId!,transferDest,undefined,now).persisted);
  source.setItem('braise.v1.game.'+id,JSON.stringify({...doc,puzzleRef:{...doc.puzzleRef,rulesVersion:'classic-v1'}}));assert.equal(writeAdmittedGame(source,id,game()),false);
});
test('Voyage restores nonempty historical saves in their own edition and new saves in Word2Vec',async()=>{
  for(const legacy of [true,false]){
    const seed='1700000049',old=game(42),next=game(),reads:string[]=[];
    const result=await resumeExpedition('sous-bois-v1',{status:async()=>({id:'sous-bois-v1',completed:0,length:3,seed}),readGame:id=>{reads.push(id);return id===(legacy?'free-':'free-w2v-')+seed?(legacy?old:next):{guesses:[],pins:[],hints:0,startedAt:1};},isCurrent:()=>true});
    assert(result);assert.equal(result.saved?.guesses[0].rank,legacy?42:150000);assert.equal((result as unknown as {edition:string}).edition,legacy?'classic-v1':'word2vec-v1');assert(reads.includes('free-w2v-'+seed));
  }
});
test('resume URL and retry carry historical edition without changing the ordinary destination',async()=>{
  const load={mode:'free' as const,locator:'042',edition:'classic-v1' as const};const url=admittedPuzzleUrl(new URL('https://braiz.test/?surface=explore'),load,{seed:'042',date:'2026-10-13'});assert.equal(url.searchParams.get('edition'),'classic-v1');
  await retryPuzzleLoad(load,async(...args)=>{assert.equal(args[6],'classic-v1');});
});
test('all new daily secrets have an identity and discovery excludes cross-mode encounters',async()=>{
  setWord2vecObjectLoaderForTests(asset);
  let unrelated: Awaited<ReturnType<typeof resolveClassicGame>>|undefined;
  for(let day=14;day<=31;day++){
    const date=`2026-10-${day}`,service=await resolveClassicGame('daily','',undefined,new Date(date+'T12:00:00Z'),{});
    assert.match(service.targetIdentity??'',/^[a-f0-9]{64}$/);
    if(!unrelated&&!historical.targets.includes(service.targetWord))unrelated=service;else service.close();
  }
  const daily=await resolveClassicGame('daily','',undefined,now,{});assert.equal(daily.targetIdentity,await legacyEncounterIdentityForWord('assiette'));
  const discovery=await discoverFree({excluded:[daily.targetIdentity,unrelated!.targetIdentity],encountered:['daily-w2v-2026-10-13'],replay:false},new Date('2026-10-31T12:00:00Z'));
  assert.equal(discovery.remaining,119);assert.equal(discovery.puzzle?.ref.rulesVersion,'word2vec-v1');assert.notEqual(discovery.puzzle?.targetIdentity,daily.targetIdentity);daily.close();unrelated?.close();setWord2vecObjectLoaderForTests(null);
});
test('new collection victories and oeuf Voyage proofs retain the historical targets',async()=>{
  const progress=collectionProgress([{id:'free-w2v-'+NATURE_COLLECTION.seeds[0],date:'2026-10-13',mode:'challenge',tries:1,hints:0}]);assert.equal(progress.completed[0],true);
  setSemanticObjectLoaderForTests(asset);assert.equal((await expeditionStatus('fourneaux-v1',['farine','oeuf'])).completed,2);setSemanticObjectLoaderForTests(null);
});
test('the profile journal refuses forged Word2Vec identities before any write',()=>{
  const storage=new Memory(),id='daily-w2v-2026-10-13';
  const puzzle={id,mode:'daily' as const,seed:'2026-10-13',date:'2026-10-13',number:37,vocabularySize:155562,resetAt:now.toISOString(),ref:{...ref(id),corpusVersion:'forged'}};
  assert.throws(()=>recordLocalGameProgress(puzzle,{...game(),profileV2StartIndex:0},storage));assert.equal(storage.length,0);
});
test('an explicit historical Voyage resume keeps its edition when both saves coexist',async()=>{
  const seed='1700000049',old=game(42),modern=game();
  const dependencies={edition:'classic-v1' as const,status:async()=>({id:'sous-bois-v1',completed:0,length:3,seed}),readGame:(id:string)=>id===`free-${seed}`?old:modern,isCurrent:()=>true};
  const result=await resumeExpedition('sous-bois-v1',dependencies);assert.equal(result?.saved,old);assert.equal(result?.edition,'classic-v1');
});
test('profile-only transfer excludes the oeuf daily across historical modes without new credit',async t=>{
  const instant=new Date('2027-09-30T12:00:00Z');t.mock.timers.enable({apis:['Date'],now:instant});setWord2vecObjectLoaderForTests(asset);
  const daily=await resolveClassicGame('daily','',undefined,instant,{});
  try{
    assert.equal(daily.targetWord,'oeuf');const answer=await daily.evaluate('oeuf');assert(answer?.found);
    const source=new Memory(),saved={guesses:[{...answer,order:1,acceptedAt:instant.toISOString()}],pins:[],hints:0,startedAt:instant.getTime(),solvedAt:instant.getTime(),profileV2StartIndex:0};
    const profile=recordLocalGameProgress(daily.publicPuzzle,saved,source),exported=createLocalProfileExport(profile,instant);assert(exported.ok);
    const dest=new Memory();let snapshot=loadLocalProfile(dest);
    for(let repeat=0;repeat<2;repeat++){const preview=inspectLocalProfileImport(exported.text,dest,instant);assert(preview.planId);const imported=importLocalProfile(exported.text,preview.planId,dest,snapshot,instant);assert(imported.persisted&&imported.snapshot);snapshot=imported.snapshot;}
    assert.equal(dest.getItem(DISCOVERY_KEY),null);assert.equal(dest.getItem('braise.v1.game.'+daily.publicPuzzle.id),null);
    const history=collectDiscoveryHistory(dest,snapshot,instant);assert.deepEqual(history,[daily.publicPuzzle.id]);const before=JSON.stringify([...dest.values]),stats={...snapshot.profile};
    let seed=0;while(historical.targets[getLegacyPuzzle('free',String(seed),instant).legacyIndex]!=='œuf')seed++;
    for(const encountered of [history,[...history,`free-${seed}`]]){
      const discovery=await discoverFree({excluded:[],encountered,replay:false},instant);
      assert.equal(discovery.remaining,119);assert.notEqual(discovery.puzzle?.targetIdentity,daily.targetIdentity);
      assert.equal(discovery.encountered.filter(identity=>identity===daily.targetIdentity).length,1);
    }
    assert.deepEqual(loadLocalProfile(dest).profile,stats);assert.equal(stats.guesses,1);assert.equal(stats.wins.length,1);assert.equal(JSON.stringify([...dest.values]),before);
  }finally{daily.close();setWord2vecObjectLoaderForTests(null);t.mock.timers.reset();}
});
