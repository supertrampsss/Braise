import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchiveCalendar } from '../components/game-parts/archive-calendar';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discoverFree, withTargetIdentity } from '../lib/free-discovery.server';
import { readEncountered, rememberEncountered, DISCOVERY_KEY } from '../lib/free-discovery';
import { readLocalPlays, rememberPlayContext, readContexts, resumeSuggestion, gameSummary, PLAY_CONTEXT_KEY } from '../lib/play-hub';
import { getLegacyPuzzle, getLegacyArchivePuzzle } from '../lib/legacy-puzzles';
import { GET, POST } from '../app/api/game/route';
import { setSemanticObjectLoaderForTests } from '../lib/semantic-storage';
import { inputAfterAcceptedGuess } from '../lib/game-feedback';
import { EMPTY_GAME } from '../lib/legacy-storage';
import type { SavedGame } from '../lib/game-types';
const now = new Date('2026-10-12T12:00:00Z');
class Store {
  data = new Map<string,string>(); get length(){return this.data.size;} key(i:number){return [...this.data.keys()][i]??null;} getItem(k:string){return this.data.get(k)??null;} setItem(k:string,v:string){this.data.set(k,v);}
}
const game=(found=false):SavedGame=>({...EMPTY_GAME,pins:['maison'],startedAt:Date.parse('2026-10-10T12:00:00Z'),guesses:[{word:'maison',temperature:20,rank:800,found,order:1}]});
test('target-aware discovery visits all 120 actual targets, then reports depletion without answer',async()=>{
  const excluded:string[]=[],indexes=new Set<number>();
  for(let i=0;i<120;i++) {
    const result=await discoverFree({excluded,encountered:[],replay:false},now);assert.ok(result.puzzle);assert.equal(result.remaining,120-i);
    const index=getLegacyPuzzle('free',result.puzzle.seed,now).legacyIndex;assert.ok(!indexes.has(index));indexes.add(index);excluded.push(result.puzzle.targetIdentity);
    assert.ok(!('word' in result.puzzle));assert.ok(!('targetIndex' in result.puzzle));
  }
  const depleted=await discoverFree({excluded,encountered:[],replay:false},now);assert.equal(depleted.exhausted,true);assert.equal(depleted.puzzle,null);assert.equal(depleted.remaining,0);
  const replay=await discoverFree({excluded,encountered:['free-0'],replay:true},now);assert.ok(replay.puzzle);assert.equal(replay.exhausted,true);assert.notEqual(replay.puzzle.id,'free-0');
});
test('same V1 target under distinct seeds and daily archive resolves to the same opaque identity',async()=>{
  const daily=getLegacyArchivePuzzle('2026-09-07',now);let seed=0;while(getLegacyPuzzle('free',String(seed),now).legacyIndex!==daily.legacyIndex) seed++;
  const a=await withTargetIdentity(daily.publicPuzzle),b=await withTargetIdentity(getLegacyPuzzle('free',String(seed),now).publicPuzzle);assert.equal(a.targetIdentity,b.targetIdentity);
  const result=await discoverFree({excluded:[],encountered:['daily-2026-09-07',`free-${seed}`],replay:false},now);assert.equal(result.remaining,119);assert.ok(result.puzzle);assert.notEqual(result.puzzle.targetIdentity,a.targetIdentity);
});
test('seeded GET preserves V1 identity, leading zeros and target mapping',async()=>{
  for(const seed of ['0','00','042','42','2147483647']) {
    const expected=getLegacyPuzzle('free',seed);const response=await GET(new Request(`https://braiz.test/api/game?mode=free&seed=${seed}&edition=classic-v1`));assert.equal(response.status,200);const value=await response.json() as Record<string,unknown>;
    assert.equal(value.id,expected.publicPuzzle.id);assert.equal(value.seed,seed);assert.equal(value.number,expected.publicPuzzle.number);assert.deepEqual(value.ref,expected.publicPuzzle.ref);assert.match(String(value.targetIdentity),/^[a-f0-9]{64}$/);
  }
});
test('discovery rejects overflow, malformed IDs, future dates and invalid flags',async()=>{
  for(const fields of [{excluded:Array(121).fill('0'.repeat(64))},{encountered:Array(3001).fill('free-1')},{encountered:['daily-2028-01-01']},{encountered:['free-2147483648']},{excluded:['solution']},{replay:'yes'}]) await assert.rejects(()=>discoverFree({excluded:[],encountered:[],replay:false,...fields},now));
  const response=await POST(new Request('https://braiz.test/api/game',{method:'POST',body:JSON.stringify({action:'discover',excluded:['bad'],encountered:[],replay:false})}));assert.equal(response.status,400);
});
test('encounter ledger deduplicates, bounds and preserves corrupt data',()=>{
  const storage=new Store(),a='a'.repeat(64);assert.deepEqual(readEncountered(storage),[]);assert.ok(rememberEncountered(storage,[a,a]));assert.deepEqual(readEncountered(storage),[a]);storage.setItem(DISCOVERY_KEY,'{broken');assert.equal(readEncountered(storage),null);assert.equal(rememberEncountered(storage,[a]),false);assert.equal(storage.getItem(DISCOVERY_KEY),'{broken');
});
test('resume uses civil dates and real valid unfinished saves without manufacturing journey identity',()=>{
  const storage=new Store();storage.setItem('braise.v1.game.daily-2026-09-07',JSON.stringify(game()));storage.setItem('braise.v1.game.daily-2026-10-12',JSON.stringify(game()));storage.setItem('braise.v1.game.daily-2026-10-13',JSON.stringify(game()));storage.setItem('braise.v1.game.daily-2026-02-31',JSON.stringify(game()));storage.setItem('braise.v1.game.free-042',JSON.stringify(game()));storage.setItem('braise.v1.game.free-1','broken');
  const plays=readLocalPlays(storage,now);assert.equal(plays.length,3);assert.equal(plays.find(p=>p.id==='daily-2026-09-07')?.mode,'archive');assert.equal(plays.find(p=>p.id==='daily-2026-10-12')?.mode,'daily');assert.equal(plays.find(p=>p.id==='free-042')?.href,'/?libre=042&edition=classic-v1');assert.equal(plays.find(p=>p.id==='free-042')?.context,undefined);assert.ok(resumeSuggestion(plays));
});
test('explicit collection and expedition contexts survive reload; corrupt contexts are retained',()=>{
  const storage=new Store();storage.setItem('braise.v1.game.free-1000000046',JSON.stringify(game()));assert.ok(rememberPlayContext(storage,'free-1000000046',{mode:'challenge',collection:'nature-v1'}));assert.equal(readLocalPlays(storage,now)[0].label,'Nature · énigme 1');
  storage.setItem('braise.v1.game.free-042',JSON.stringify(game()));assert.ok(rememberPlayContext(storage,'free-042',{mode:'challenge',expedition:'sous-bois-v1',expeditionStep:2}));assert.match(readLocalPlays(storage,now).find(p=>p.id==='free-042')!.label,/étape 2\/3/);
  storage.setItem(PLAY_CONTEXT_KEY,'{"version":99}');assert.equal(readContexts(storage),null);assert.equal(rememberPlayContext(storage,'free-1',{mode:'free'}),false);assert.equal(storage.getItem(PLAY_CONTEXT_KEY),'{"version":99}');
});
test('win summary derives personal trials, actual hint rows, threshold order and best non-answer pistes',()=>{
  const saved=game();saved.guesses.push({word:'arbre',temperature:55,rank:9,found:false,order:2,hint:true},{word:'foret',temperature:100,rank:1,found:true,order:3});saved.hints=1;
  const summary=gameSummary(saved);assert.equal(summary.trials,2);assert.equal(summary.hints,1);assert.deepEqual(summary.milestones.map(m=>m.guess?.order),[1,2,2]);assert.equal(summary.bestPistes[0].word,'arbre');assert.ok(!summary.bestPistes.some(g=>g.found));
});
test('historical tutorial uses distinct daily target and exact real semantic response, not synthetic scoring',async t=>{
  t.mock.timers.enable({apis:['Date'],now});
  setSemanticObjectLoaderForTests(async key=>{try{const b=await readFile(`public/${key}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}catch{return null;}});
  const response=await GET(new Request('https://braiz.test/api/game?tutorial=1'));const puzzle=await response.json() as ReturnType<typeof getLegacyPuzzle>['publicPuzzle'];
  assert.equal(puzzle.mode,'free');assert.notEqual(getLegacyPuzzle('free',puzzle.seed).legacyIndex,getLegacyPuzzle('daily').legacyIndex);
  const evaluated=await POST(new Request('https://braiz.test/api/game',{method:'POST',body:JSON.stringify({mode:'free',seed:puzzle.seed,puzzleId:puzzle.id,puzzleRef:puzzle.ref,action:'guess',word:'maison'})}));assert.equal(evaluated.status,200);const result=await evaluated.json() as {temperature:number;rank:number};assert.ok(Number.isFinite(result.temperature));assert.ok(Number.isInteger(result.rank));
  const component=await readFile('components/game-parts/play-tutorial.tsx','utf8');assert.ok(!component.includes('recordLocalGameProgress'));assert.ok(!component.includes('saveGame'));assert.ok(!component.includes('writeLocal'));assert.ok(component.includes('samePuzzleRef'));
  t.mock.timers.reset();setSemanticObjectLoaderForTests(null);
});
test('input revisions and current-puzzle guard remain enforced; share text excludes words',async()=>{
  assert.equal(inputAfterAcceptedGuess('new word',false,2,1),'new word');assert.equal(inputAfterAcceptedGuess('same word',false,3,1),'same word');assert.equal(inputAfterAcceptedGuess('word',false,1,1),'');
  const source=await readFile('components/game.tsx','utf8');assert.ok(source.includes('if (request !== requestRef.current) return;'));assert.ok(source.includes('samePuzzleRef(data.puzzleRef, puzzle.ref)'));const share=source.slice(source.indexOf('  function resultText()'),source.indexOf('  async function shareResult()'));assert.ok(!share.includes('g.word'));assert.ok(!share.includes('best.word'));
});

test('archive calendar safely renders invalid, out-of-range and missing deep-link dates',()=>{
  for(const selected of ['','bogus','2026-99-99','2026-02-31','2020-01-01','2028-01-01']) {
    const rendered=renderToStaticMarkup(createElement(ArchiveCalendar,{max:'2026-10-11',selected,plays:[],disabled:false,onOpen:()=>{}}));
    assert.match(rendered,/octobre 2026/);assert.match(rendered,/2026-10-11/);assert.ok(!rendered.includes('NaN'));
  }
});
