import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectDiscoveryHistory} from '../lib/free-discovery';
import {loadLocalProfile,profileActivitiesForGame,type ProfileSnapshot} from '../lib/profile-storage';
import {SyncMemory} from '../lib/device-sync';
import {getLegacyPuzzle} from '../lib/legacy-puzzles';
import {dailyV2Ref} from '../lib/daily-v2-contract';
const now=new Date('2028-01-04T12:00:00Z');
const template=getLegacyPuzzle('free','1',now).publicPuzzle;
const fact=(seed:string)=>profileActivitiesForGame({...template,id:'free-'+seed,seed,ref:{...template.ref,id:'free-'+seed}},{guesses:[{word:'arbre',temperature:12.25,rank:1234,found:false,order:1,acceptedAt:now.toISOString()}],hints:0,pins:[],startedAt:1,profileV2StartIndex:0})[0];
test('all snapshot fact families and saved keys deduplicate before the3000 bound without any write or mutation',()=>{
 const storage=new SyncMemory(), base=loadLocalProfile(storage);const activities=Array.from({length:3000},(_,i)=>fact(String(i)));const snapshot:ProfileSnapshot={...base,activities,pendingActivities:activities,transferEvidence:activities};storage.setItem('braise.v1.game.free-0','{}');const before=JSON.stringify(snapshot),bytes=[...storage.values];
 assert.equal(collectDiscoveryHistory(storage,snapshot,now).length,3000);assert.deepEqual([...storage.values],bytes);assert.equal(JSON.stringify(snapshot),before);
 assert.throws(()=>collectDiscoveryHistory(storage,{...snapshot,pendingActivities:[...activities,fact('3000')]},now),/dépasse la limite/);
});
test('variant, invalid corpus/calendar, future and malformed IDs are excluded without converting leading-zero orV2 identities',()=>{
 const storage=new SyncMemory(), base=loadLocalProfile(storage), classic=fact('00042');assert.equal(classic.type,'guessAccepted');if(classic.type!=='guessAccepted')return;
 const variant={...classic,id:'variant',puzzleRef:{...classic.puzzleRef,variant:'intruder' as const}};
 const two={...variant,id:'two',puzzleRef:{...variant.puzzleRef,variant:'two-braises' as const}};
 const badCorpus={...classic,id:'bad-corpus',puzzleRef:{...classic.puzzleRef,id:'free-9',corpusVersion:'unknown'}};
 const v2={...classic,id:'daily',puzzleRef:dailyV2Ref('2027-01-05','archive')};
 const badCalendar={...v2,id:'bad-calendar',puzzleRef:{...v2.puzzleRef,id:'daily-v2-2027-01-06',calendar:{version:'forged',date:'2027-01-06'}}};
 for(const id of ['intruder-1','two-braises-1','free-2147483648','daily-2026-02-30','daily-2027-01-05','daily-v2-2028-01-05'])storage.setItem('braise.v1.game.'+id,'{}');
 const snapshot={...base,activities:[variant,two,badCorpus,v2,badCalendar],pendingActivities:[classic],transferEvidence:[classic]};assert.deepEqual(collectDiscoveryHistory(storage,snapshot,now),['daily-v2-2027-01-05','free-00042']);
});
