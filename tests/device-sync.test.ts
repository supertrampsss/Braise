import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SyncMemory,createDeviceEnvelope,parseDeviceEnvelope,inspectDeviceMerge,applyDeviceMerge} from '../lib/device-sync';
import {loadLocalProfile} from '../lib/profile-storage';
import {PLAY_CONTEXT_KEY} from '../lib/play-hub';
const now=new Date('2026-10-12T12:00:00Z');
class Memory extends SyncMemory {removeItem(k:string){this.values.delete(k);}clear(){this.values.clear();}}
function game(word='arbre',pins:string[]=[]){return {guesses:[{word,temperature:12,rank:200,found:false,order:1}],pins,hints:0,startedAt:1};}
function source(){const storage=new Memory();storage.setItem('braise.v1.game.free-0012',JSON.stringify(game()));storage.setItem(PLAY_CONTEXT_KEY,JSON.stringify({version:1,items:{'free-0012':{mode:'challenge'}}}));return storage;}
test('sync is distinct, preserves leading seed zeros and excludes credentials/unknown local storage',()=>{const s=source();s.setItem('secret-session','never-upload');const text=createDeviceEnvelope(s,loadLocalProfile(s),now);assert.ok(!text.includes('never-upload'));const parsed=parseDeviceEnvelope(text,now);assert.equal(parsed.games[0].id,'free-0012');assert.equal(parsed.games[0].context?.mode,'challenge');assert.throws(()=>parseDeviceEnvelope(JSON.stringify({...parsed,token:'secret'}),now));assert.throws(()=>parseDeviceEnvelope(JSON.stringify({...parsed,version:2}),now));});
test('strict fields, corrupt/future local saves and oversized sets refuse before upload',()=>{for(const fields of [{version:2},{token:'secret'},{startedAt:now.getTime()+1}]){const s=source();s.setItem('braise.v1.game.free-0012',JSON.stringify({...game(),...fields}));assert.throws(()=>createDeviceEnvelope(s,loadLocalProfile(s),now));}const s=source();for(let i=0;i<1001;i++)s.setItem('braise.v1.game.free-'+(i+100),JSON.stringify(game()));assert.throws(()=>createDeviceEnvelope(s,loadLocalProfile(s),now));});
test('preview performs no writes; union preserves local trials/pins and repeat merge is neutral',()=>{const a=source(),b=new Memory();a.setItem('braise.v1.game.free-0012',JSON.stringify(game('arbre',['arbre'])));b.setItem('braise.v1.game.free-0012',JSON.stringify(game('bois',['bois'])));const text=createDeviceEnvelope(a,loadLocalProfile(a),now),snapshot=loadLocalProfile(b);const before=[...b.values];const plan=inspectDeviceMerge(text,b,snapshot,now);assert.deepEqual([...b.values],before);const merged=applyDeviceMerge(text,plan.revision,b as unknown as Storage,snapshot,now);const saved=JSON.parse(b.getItem('braise.v1.game.free-0012')!);assert.deepEqual(saved.guesses.map((g:{word:string})=>g.word),['bois','arbre']);assert.deepEqual(saved.pins,['bois','arbre']);assert.equal(saved.profileV2StartIndex,2);const next=inspectDeviceMerge(text,b,merged,now);applyDeviceMerge(text,next.revision,b as unknown as Storage,merged,now);assert.equal(JSON.parse(b.getItem('braise.v1.game.free-0012')!).guesses.length,2);assert.equal(merged.profile.guesses,0);});
test('stale revision, incompatible scores, pin overflow, context and future local save preserve all local state',()=>{const a=source();const text=createDeviceEnvelope(a,loadLocalProfile(a),now);for(const variant of [{...game(),version:2},{...game(),guesses:[{...game().guesses[0],rank:9}]}]){const b=new Memory();b.setItem('braise.v1.game.free-0012',JSON.stringify(variant));const p=loadLocalProfile(b),before=[...b.values];assert.throws(()=>inspectDeviceMerge(text,b,p,now));assert.deepEqual([...b.values],before);}const b=new Memory(),p=loadLocalProfile(b),plan=inspectDeviceMerge(text,b,p,now);b.setItem('braise.v1.game.free-0001',JSON.stringify(game()));assert.throws(()=>applyDeviceMerge(text,plan.revision,b as unknown as Storage,p,now),/changé/);
 a.setItem('braise.v1.game.free-0012',JSON.stringify(game('a',['a','b','c'])));b.setItem('braise.v1.game.free-0012',JSON.stringify(game('d',['d'])));assert.throws(()=>inspectDeviceMerge(createDeviceEnvelope(a,loadLocalProfile(a),now),b,loadLocalProfile(b),now),/limite/);
});
test('unknown fields in historical baseline cannot carry secrets',()=>{const s=source();s.setItem('braise.v1.profile',JSON.stringify({wins:[],guesses:1,sound:false,token:'private'}));assert.throws(()=>createDeviceEnvelope(s,loadLocalProfile(s),now));});

test('actual merge admission invalidates late POST and resumed next guess retains merged trials and pins',async()=>{
 const {deviceBoardRevision,admitDeviceBoardMerge}=await import('../lib/device-sync-admission');const {restoreLegacyGame}=await import('../lib/legacy-storage');const {writeAdmittedGame}=await import('../lib/game-write-admission');
 const a=source(),b=new Memory();a.setItem('braise.v1.game.free-0012',JSON.stringify(game('arbre',['arbre'])));b.setItem('braise.v1.game.free-0012',JSON.stringify(game('bois',['bois'])));const snapshot=loadLocalProfile(b),text=createDeviceEnvelope(a,loadLocalProfile(a),now),plan=inspectDeviceMerge(text,b,snapshot,now);
 const state={request:4,navigation:2,puzzle:'free-0012',busy:false},read=()=>deviceBoardRevision(state),expected=read(),lateRequest=state.request;let oldPostResolve!:()=>void;const oldPost=new Promise<void>(resolve=>{oldPostResolve=resolve;}).then(()=>{if(lateRequest===state.request)writeAdmittedGame(b,'free-0012',game('stale'));});
 state.busy=true;assert.throws(()=>applyDeviceMerge(text,plan.revision,b as unknown as Storage,snapshot,now,()=>admitDeviceBoardMerge(expected,read,()=>state.request++)));assert.equal(JSON.parse(b.getItem('braise.v1.game.free-0012')!).guesses.length,1);
 state.busy=false;applyDeviceMerge(text,plan.revision,b as unknown as Storage,snapshot,now,()=>admitDeviceBoardMerge(expected,read,()=>state.request++));oldPostResolve();await oldPost;
 const restored=restoreLegacyGame('free-0012',now.getTime(),b);assert.deepEqual(restored.guesses.map(g=>g.word),['bois','arbre']);assert.deepEqual(restored.pins,['bois','arbre']);assert.ok(writeAdmittedGame(b,'free-0012',{...restored,guesses:[...restored.guesses,{word:'forêt',temperature:20,rank:150,found:false,order:3}]}));assert.deepEqual(JSON.parse(b.getItem('braise.v1.game.free-0012')!).guesses.map((g:{word:string})=>g.word),['bois','arbre','forêt']);
 state.navigation++;assert.equal(admitDeviceBoardMerge(expected,read,()=>state.request++),false);
});

test('hint union never restores already consumed hints and rejects more than three distinct clues',()=>{
 const a=source(),b=new Memory();const hint=(word:string,order:number)=>({...game(word).guesses[0],hint:true,order});a.setItem('braise.v1.game.free-0012',JSON.stringify({...game(),guesses:[hint('a',1),hint('b',2)],hints:2}));b.setItem('braise.v1.game.free-0012',JSON.stringify({...game(),guesses:[hint('c',1),hint('d',2)],hints:2}));const text=createDeviceEnvelope(a,loadLocalProfile(a),now),snapshot=loadLocalProfile(b),before=[...b.values];assert.throws(()=>inspectDeviceMerge(text,b,snapshot,now),/limite/);assert.deepEqual([...b.values],before);
});


test('game fact union preserves known timestamps in either direction, rejects clue/date conflicts, and keeps local order',()=>{
 const date='2026-10-01T12:00:00Z',other='2026-10-01T13:00:00Z';
 for(const remoteDated of [false,true]){
  const a=source(),b=source();const dated={...game(),guesses:[{...game().guesses[0],acceptedAt:date,order:5}]};
  (remoteDated?a:b).setItem('braise.v1.game.free-0012',JSON.stringify(dated));
  const plan=inspectDeviceMerge(createDeviceEnvelope(a,loadLocalProfile(a),now),b,loadLocalProfile(b),now);
  const merged=JSON.parse(plan.staged.getItem('braise.v1.game.free-0012')!);assert.equal(merged.guesses[0].acceptedAt,date);assert.equal(merged.guesses[0].order,remoteDated?1:5);
 }
 for(const changed of [{hint:true},{acceptedAt:other}]){
  const a=source(),b=source();a.setItem('braise.v1.game.free-0012',JSON.stringify({...game(),guesses:[{...game().guesses[0],acceptedAt:date}]}));b.setItem('braise.v1.game.free-0012',JSON.stringify({...game(),guesses:[{...game().guesses[0],acceptedAt:date,...changed}]}));
  const snapshot=loadLocalProfile(b),before=[...b.values];assert.throws(()=>inspectDeviceMerge(createDeviceEnvelope(a,loadLocalProfile(a),now),b,snapshot,now),/incompatibles/);assert.deepEqual([...b.values],before);
 }
});
