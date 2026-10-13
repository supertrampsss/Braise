import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyV2Ref, isDailyV2Ref } from '../lib/daily-v2-contract';
import { dailyV2Document } from '../lib/daily-v2-storage';
import { restoreLegacyGame } from '../lib/legacy-storage';
import { canWriteGameDocument, writeAdmittedGame } from '../lib/game-write-admission';
import { SyncMemory, createDeviceEnvelope, parseDeviceEnvelope, inspectDeviceMerge, applyDeviceMerge } from '../lib/device-sync';
import { loadLocalProfile, recordLocalGameProgress, createLocalProfileExport, inspectLocalProfileImport } from '../lib/profile-storage';
import { readLocalPlays } from '../lib/play-hub';
import type { Puzzle } from '../lib/game-types';
const now = new Date('2027-01-06T12:00:00Z');
const id = 'daily-v2-2027-01-05';
const game = () => ({ guesses: [{ word: 'arbre', temperature: 12.34, rank: 900000, found: false, order: 1, acceptedAt: '2027-01-05T12:00:00.000Z' }], pins: ['arbre'], hints: 0, startedAt: Date.parse('2027-01-05T12:00:00.000Z') });
class Memory extends SyncMemory { removeItem(key:string) { this.values.delete(key); } clear() { this.values.clear(); } }
test('V2 save is explicitly versioned; cold restoration and V1 bytes remain separate', () => {
  const storage = new Memory(); const v1 = JSON.stringify({ ...game(), guesses: [{ ...game().guesses[0], rank: 42 }] });
  storage.setItem('braise.v1.game.free-00042',v1);
  assert.equal(writeAdmittedGame(storage,id,game()),true);
  const doc = JSON.parse(storage.getItem('braise.v1.game.'+id)!);
  assert.equal(doc.schemaVersion,2); assert.deepEqual(doc.puzzleRef,dailyV2Ref('2027-01-05','daily'));
  assert.deepEqual(restoreLegacyGame(id,now.getTime(),storage),game());
  assert.equal(storage.getItem('braise.v1.game.free-00042'),v1);
  assert.equal(readLocalPlays(storage,now).find(p=>p.id===id)?.mode,'archive');
});
test('unknown, forged and corrupt V2 documents cannot be overwritten', () => {
  for (const value of [game(), {...dailyV2Document(id,game()),schemaVersion:3}, {...dailyV2Document(id,game()),puzzleRef:dailyV2Ref('2027-01-06','daily')}, {...dailyV2Document(id,game()),token:'extra'}]) {
    const storage = new Memory(); const raw = JSON.stringify(value); storage.setItem('braise.v1.game.'+id,raw);
    assert.equal(canWriteGameDocument(storage,id),false); assert.equal(writeAdmittedGame(storage,id,game()),false); assert.equal(storage.getItem('braise.v1.game.'+id),raw);
  }
});
test('mixed sync preserves V1 leading-zero identity and full V2 ranks without replaying profile credit', () => {
  const source = new Memory(); writeAdmittedGame(source,id,game());
  writeAdmittedGame(source,'free-00042',{ ...game(), guesses: [{ ...game().guesses[0],rank:42 }] });
  const text = createDeviceEnvelope(source,loadLocalProfile(source),now); const parsed = parseDeviceEnvelope(text,now);
  assert.equal(parsed.version,2); assert.deepEqual(parsed.games.map(g=>g.id),[id,'free-00042']);
  const dest = new Memory(); let snapshot = loadLocalProfile(dest);
  for(let repeat=0;repeat<2;repeat++) { const plan=inspectDeviceMerge(text,dest,snapshot,now);snapshot=applyDeviceMerge(text,plan.revision,dest as unknown as Storage,snapshot,now); }
  assert.equal(restoreLegacyGame(id,now.getTime(),dest).guesses[0].rank,900000); assert.equal(snapshot.profile.guesses,0);
  assert.equal(JSON.parse(dest.getItem('braise.v1.game.free-00042')!).guesses[0].rank,42);
  type Mutable = {version:number;games:Array<{puzzleRef:{rulesVersion:string};game:{guesses:Array<{rank:number}>}}>};
  for(const mutate of [(v:Mutable)=>v.version=1,(v:Mutable)=>v.games[0].puzzleRef.rulesVersion='classic-v1',(v:Mutable)=>v.games[0].game.guesses[0].rank=1013882,(v:Mutable)=>v.games[1].game.guesses[0].rank=900000]) { const v=JSON.parse(text) as Mutable;mutate(v);assert.throws(()=>parseDeviceEnvelope(JSON.stringify(v),now)); }
  assert.throws(()=>parseDeviceEnvelope(text,new Date('2027-01-04T12:00:00Z')));
});
test('profile export labels mixed facts and validates exact V2 corpus/calendar/date on import', () => {
  const storage = new Memory(); const puzzle: Puzzle = {id,mode:'archive',seed:'2027-01-05',date:'2027-01-05',number:121,vocabularySize:1013881,resetAt:now.toISOString(),ref:dailyV2Ref('2027-01-05','archive')};
  const snapshot=recordLocalGameProgress(puzzle,{...game(),profileV2StartIndex:0},storage);
  const exported=createLocalProfileExport(snapshot,now);assert(exported.ok);const value=JSON.parse(exported.text);assert.equal(value.exportVersion,2);assert.equal(value.semanticScope,'v1-and-pinned-daily-v2');
  assert.equal(inspectLocalProfileImport(exported.text,new Memory(),now).status,'ready');
  value.activities[0].puzzleRef.corpusVersion='another-corpus';assert.equal(inspectLocalProfileImport(JSON.stringify(value),new Memory(),now).status,'invalid');
  assert.equal(isDailyV2Ref(dailyV2Ref('2027-01-05','daily'),new Date('2027-01-04T12:00:00Z')),false);
});
