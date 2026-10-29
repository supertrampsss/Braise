import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import {DeviceSync} from '../components/device-sync';
import Circles from '../components/circles';
import Duels from '../components/duels';
import {SyncMemory,parseDeviceEnvelope,createDeviceEnvelope} from '../lib/device-sync';
import {loadLocalProfile,setLocalSound,recordLocalGameProgress} from '../lib/profile-storage';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
class Memory extends SyncMemory {refuse=false;setItem(k:string,v:string){if(this.refuse)throw new Error('quota');super.setItem(k,v);}removeItem(k:string){this.values.delete(k);}clear(){this.values.clear();}}
const reply=(body:unknown)=>Response.json(body);
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
function buttons(tree:ReactTestRenderer,label:string){return tree.root.findAll(n=>n.type==='button'&&text(n)===label);}
async function click(tree:ReactTestRenderer,label:string){const button=buttons(tree,label)[0];assert.ok(button,`button ${label}: ${text(tree.root)}`);assert.ok(!button.props.disabled,`${label} enabled`);await act(async()=>button.props.onClick());}
async function input(tree:ReactTestRenderer,id:string,value:string){await act(async()=>tree.root.findByProps({id}).props.onChange({target:{value}}));}
function form(tree:ReactTestRenderer,id:string){let node=tree.root.findByProps({id}).parent;while(node&&node.type!=='form')node=node.parent;assert.ok(node);return node;}
const token='a'.repeat(64),otherToken='b'.repeat(64);
// Protocol tests keep the menu closed; pointer and keyboard navigation are checked in the real browser.
function browser(storage=new Memory(),invite=token){Object.assign(globalThis,{requestAnimationFrame:()=>0,cancelAnimationFrame(){},window:{matchMedia(){return {matches:true,addEventListener(){},removeEventListener(){}};},addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){},getElementById(){return null;}},localStorage:storage,sessionStorage:new Memory(),location:{hash:invite?'#invitation='+invite:'',pathname:'/duels',origin:'https://braiz.io'},history:{replaceState(){}}});}

test('real upload button reconciles latest pending memory preferences and concurrent disk facts without local writes',async()=>{
 const storage=new Memory();browser(storage,'');let snapshot=loadLocalProfile(storage);let release!:(r:Response)=>void;let wait=false;let sent='';
 globalThis.fetch=async(url,options)=>{if(url==='/api/session')return reply({guest:{name:'A'},csrf:'csrf'});if(options?.method==='PUT'){sent=JSON.parse(options.body as string).payload;return reply({revision:0,payload:sent});}if(wait)return new Promise(resolve=>release=resolve);return reply({revision:-1,payload:null});};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,onSnapshot:()=>assert.fail('upload must not project profile')}));});
 try{await click(tree,'Configurer la synchronisation facultative');wait=true;await click(tree,'Préparer l’envoi de cet appareil');
 // Gameplay was stored, but the latest profile facts fail to persist during the pending GET.
 storage.setItem('braise.v1.game.free-001',JSON.stringify({guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1,acceptedAt:'2026-10-01T12:00:00.000Z'}],pins:[],hints:0,startedAt:1}));
 storage.refuse=true;snapshot=setLocalSound(true,'2026-10-01T12:00:00.000Z','memory-preference',storage,snapshot);assert.equal(snapshot.pendingActivities.length,1);
 const puzzle={id:'free-001',mode:'free' as const,seed:'001',date:'2026-10-01',number:1,vocabularySize:30000,resetAt:'2026-10-01T22:00:00.000Z',ref:{contractVersion:1 as const,id:'free-001',corpusVersion:'fr-fasttext-30000-v1',rulesVersion:'classic-v1',context:'free' as const,variant:'classic' as const,calendar:null}};
 snapshot=recordLocalGameProgress(puzzle,{guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1,acceptedAt:'2026-10-01T12:00:00.000Z'}],pins:[],hints:0,startedAt:1,profileV2StartIndex:0},storage,snapshot);assert.equal(snapshot.pendingActivities.length,2);
 storage.refuse=false;setLocalSound(false,'2026-10-01T11:00:00.000Z','other-tab',storage,loadLocalProfile(storage));storage.refuse=true;
 const bytes=[...storage.values];await act(async()=>tree.update(createElement(DeviceSync,{snapshot,onSnapshot:()=>assert.fail('unexpected profile update')})));
 await act(async()=>release(reply({revision:-1,payload:null})));await click(tree,'Confirmer l’envoi');
 const profile=JSON.parse(parseDeviceEnvelope(sent).profile);assert.equal(profile.activities.length,3);assert.ok(profile.activities.some((a:{type:string;word?:string})=>a.type==='guessAccepted'&&a.word==='arbre'));assert.ok(profile.activities.some((a:{id:string})=>a.id.includes('memory-preference')));assert.ok(profile.activities.some((a:{id:string})=>a.id.includes('other-tab')));assert.deepEqual([...storage.values],bytes);
 }finally{await act(async()=>tree.unmount());}
});

for(const [kind,Component,guestInput,tokenInput,accept,resume] of [
 ['circle',Circles,'circle-guest','circle-token','Rejoindre explicitement','Reprendre mon cercle'],
 ['duel',Duels,'duel-guest','duel-token','Rejoindre le duel','Reprendre mon duel'],
] as const){
 test(`${kind}: unavailable and pending inspections cannot create a guest or accept; exit retains normal entry`,async()=>{
  for(const identified of [false,true])for(const state of ['expired','revoked','full','unknown','excluded','unrecognized']){
   browser();const calls:Array<{url:string;method:string}>=[];let release!:(r:Response)=>void;
   globalThis.fetch=async(url,options)=>{const path=String(url);calls.push({url:path,method:options?.method??'GET'});if(path==='/api/session')return reply({guest:identified?{id:'guest-a',name:'A'}:null,csrf:'csrf'});if(path==='/api/invitations')return new Promise(resolve=>release=resolve);return reply({circles:[],duels:[]});};
   let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Component));});
   try{assert.equal(tree.root.findAllByProps({id:guestInput}).length,0);for(const button of buttons(tree,accept))assert.equal(button.props.disabled,true);
    await act(async()=>release(reply({state})));assert.equal(tree.root.findAllByProps({id:guestInput}).length,0);for(const button of buttons(tree,accept))assert.equal(button.props.disabled,true);
    // Even a direct submit of the disabled form cannot bypass inspection.
    if(identified)await act(async()=>form(tree,tokenInput).props.onSubmit({preventDefault(){}}));
    assert.equal(calls.filter(c=>c.method==='POST'&&c.url!=='/api/invitations').length,0);
    assert.equal(sessionStorage.getItem(`braiz.invitation.${kind}`),token);
    await click(tree,'Quitter cette invitation');assert.equal(sessionStorage.getItem(`braiz.invitation.${kind}`),null);
    if(!identified)assert.equal(tree.root.findAllByProps({id:guestInput}).length,1);
   }finally{await act(async()=>tree.unmount());}
  }
 });
 test(`${kind}: available invitation enables explicit identity creation, reinspection and acceptance`,async()=>{
  browser();const mutations:unknown[]=[];let created=false;
  globalThis.fetch=async(url,options)=>{const path=String(url);if(path==='/api/invitations')return reply({state:'ready',expiresAt:Date.now()+60000});if(options?.method==='POST'){const body=JSON.parse(options.body as string);mutations.push(body);if(path==='/api/session'){created=true;return reply({guest:{id:'guest-a',name:'A'},csrf:'csrf'});}if(kind==='circle')return reply({circle_id:'circle-owned'});return reply({id:'duel-owned',state:'active',hostName:'H',opponentName:'A',role:'opponent',guesses:[]});}if(path.includes('?id='))return reply({circle:{id:'circle-owned',name:'Friends',owner_id:'guest-a'},members:[],challenges:[],results:[]});return reply({guest:created?{id:'guest-a',name:'A'}:null,csrf:'csrf',circles:[],duels:[]});};
  let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Component));});
  try{assert.equal(mutations.length,0);await input(tree,guestInput,'A');await act(async()=>form(tree,guestInput).props.onSubmit({preventDefault(){}}));assert.deepEqual(mutations,[{name:'A'}]);assert.equal(buttons(tree,accept)[0].props.disabled,false);await act(async()=>form(tree,tokenInput).props.onSubmit({preventDefault(){}}));assert.deepEqual(mutations[1],{action:kind==='circle'?'join':'accept',token});assert.equal(sessionStorage.getItem(`braiz.invitation.${kind}`),null);}finally{await act(async()=>tree.unmount());}
 });
 test(`${kind}: accepted inspection resumes its owned destination; changed token cannot use a stale ready result`,async()=>{
  browser();const mutations:unknown[]=[];const reads:string[]=[];let delayed=false;let release!:(r:Response)=>void;
  globalThis.fetch=async(url,options)=>{const path=String(url);if(path==='/api/invitations'){if(delayed)return new Promise(resolve=>release=resolve);return reply({state:'accepted',destination:{kind,id:'owned-id'}});}if(options?.method==='POST')mutations.push(options.body);reads.push(path);if(path.includes('?id='))return reply(kind==='circle'?{circle:{id:'owned-id',name:'Friends',owner_id:'guest-a'},members:[],challenges:[],results:[]}:{id:'owned-id',state:'pending',hostName:'A',role:'host',guesses:[]});return reply({guest:{id:'guest-a',name:'A'},csrf:'csrf',circles:[],duels:[]});};
  let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Component));});
  try{assert.equal(buttons(tree,accept)[0].props.disabled,true);await click(tree,resume);assert.ok(reads.includes(`/api/${kind==='circle'?'circles':'duels'}?id=owned-id`));assert.equal(mutations.length,0);
   delayed=true;await input(tree,tokenInput,token);assert.equal(buttons(tree,accept)[0].props.disabled,true);await act(async()=>release(reply({state:'ready',expiresAt:Date.now()+60000})));assert.equal(buttons(tree,accept)[0].props.disabled,false);
   await input(tree,tokenInput,otherToken);assert.equal(sessionStorage.getItem(`braiz.invitation.${kind}`),otherToken);assert.equal(buttons(tree,accept)[0].props.disabled,true);const stale=release;await input(tree,tokenInput,token);await act(async()=>stale(reply({state:'ready',expiresAt:Date.now()+60000})));assert.equal(buttons(tree,accept)[0].props.disabled,true);await act(async()=>release(reply({state:'revoked'})));assert.equal(buttons(tree,accept)[0].props.disabled,true);assert.equal(mutations.length,0);
  }finally{await act(async()=>tree.unmount());}
 });
}


test('real upload preparation refuses unreadable newer local facts without offering confirmation or modifying storage',async()=>{
 const storage=new Memory();browser(storage,'');const snapshot=loadLocalProfile(storage);storage.setItem('braise.v2.profile.event.corrupt','{');const before=[...storage.values];
 globalThis.fetch=async(url)=>reply(url==='/api/session'?{guest:{name:'A'},csrf:'csrf'}:{revision:-1,payload:null});let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,onSnapshot:()=>assert.fail('no projection')}));});
 try{await click(tree,'Configurer la synchronisation facultative');await click(tree,'Préparer l’envoi de cet appareil');assert.equal(buttons(tree,'Confirmer l’envoi').length,0);assert.equal(tree.root.findAllByProps({role:'alert'}).length,1);assert.deepEqual([...storage.values],before);}finally{await act(async()=>tree.unmount());}
});


test('actual upload preparation refuses missing/stale saved games known from pending profile or current board',async()=>{
 for(const persisted of ['missing','stale'])for(const liveBoard of [false,true]){
  const storage=new Memory();browser(storage,'');let snapshot=loadLocalProfile(storage);
  const puzzle={id:'free-001',mode:'free' as const,seed:'001',date:'2026-10-01',number:1,vocabularySize:30000,resetAt:'2026-10-01T22:00:00.000Z',ref:{contractVersion:1 as const,id:'free-001',corpusVersion:'fr-fasttext-30000-v1',rulesVersion:'classic-v1',context:'free' as const,variant:'classic' as const,calendar:null}};
  const game={guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1,acceptedAt:'2026-10-01T12:00:00.000Z'}],pins:['arbre'],hints:0,startedAt:1,profileV2StartIndex:0};
  if(persisted==='stale')storage.setItem('braise.v1.game.free-001',JSON.stringify({...game,guesses:[],pins:[]}));
  // Both cases matter: profile write failed, or profile persisted but the board save failed.
  storage.refuse=!liveBoard;snapshot=recordLocalGameProgress(puzzle,game,storage,snapshot);const before=[...storage.values];
  globalThis.fetch=async(url)=>reply(url==='/api/session'?{guest:{name:'A'},csrf:'csrf'}:{revision:-1,payload:null});
  const guard=liveBoard?{revision:()=> 'current',admit:()=>true,currentGame:()=>({id:puzzle.id,game})}:undefined;
  let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,mergeGuard:guard,onSnapshot:()=>assert.fail('no projection')}));});
  try{await click(tree,'Configurer la synchronisation facultative');await click(tree,'Préparer l’envoi de cet appareil');assert.equal(buttons(tree,'Confirmer l’envoi').length,0);assert.match(text(tree.root.findByProps({role:'alert'})),/partie en mémoire.*incomplète/);assert.deepEqual([...storage.values],before);}finally{await act(async()=>tree.unmount());}
 }
});


test('a new upload preparation retires the old confirmation before refusal or network failure',async()=>{
 for(const failure of ['missing','stale','network']){
  const storage=new Memory();browser(storage,'');const snapshot=loadLocalProfile(storage);
  let game={guesses:[] as Array<{word:string;rank:number;temperature:number;found:boolean;order:number}>,pins:[] as string[],hints:0,startedAt:1};
  storage.setItem('braise.v1.game.free-001',JSON.stringify(game));let puts=0,rejectRead:((e:Error)=>void)|undefined;let failRead=false;
  globalThis.fetch=async(url,options)=>{if(url==='/api/session')return reply({guest:{name:'A'},csrf:'csrf'});if(options?.method==='PUT'){puts++;return reply({revision:0,payload:null});}if(failRead)return new Promise((_resolve,reject)=>{rejectRead=reject;});return reply({revision:-1,payload:null});};
  const guard={revision:()=> 'board',admit:()=>true,currentGame:()=>({id:'free-001',game})};let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,mergeGuard:guard,onSnapshot:()=>assert.fail('no projection')}));});
  try{await click(tree,'Configurer la synchronisation facultative');await click(tree,'Préparer l’envoi de cet appareil');const staleConfirm=buttons(tree,'Confirmer l’envoi')[0].props.onClick;
   if(failure==='network')failRead=true;else {game={...game,guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1}]};if(failure==='missing')storage.removeItem('braise.v1.game.free-001');}
   await click(tree,'Préparer l’envoi de cet appareil');assert.equal(buttons(tree,'Confirmer l’envoi').length,0);
   if(rejectRead)await act(async()=>rejectRead!(new Error('Network failed')));
   assert.equal(buttons(tree,'Confirmer l’envoi').length,0);assert.equal(tree.root.findAllByProps({role:'alert'}).length,1);
   await act(async()=>staleConfirm());assert.equal(puts,0);assert.equal(buttons(tree,'Confirmer l’envoi').length,0);
  }finally{await act(async()=>tree.unmount());}
 }
});

test('confirmation rechecks the prepared local revision, current board and live save admission before PUT',async()=>{
 for(const change of ['disk','memory','profile','busy','navigation']){
  const storage=new Memory();browser(storage,'');let snapshot=loadLocalProfile(storage),revision:string|null='board';
  let game={guesses:[] as Array<{word:string;rank:number;temperature:number;found:boolean;order:number}>,pins:[] as string[],hints:0,startedAt:1};storage.setItem('braise.v1.game.free-001',JSON.stringify(game));let puts=0;
  globalThis.fetch=async(url,options)=>{if(url==='/api/session')return reply({guest:{name:'A'},csrf:'csrf'});if(options?.method==='PUT')puts++;return reply({revision:-1,payload:null});};
  const guard={revision:()=>revision,admit:()=>true,currentGame:()=>({id:'free-001',game})};let tree!:ReactTestRenderer;const render=()=>createElement(DeviceSync,{snapshot,mergeGuard:guard,onSnapshot:()=>assert.fail('no projection')});await act(async()=>{tree=create(render());});
  try{await click(tree,'Configurer la synchronisation facultative');await click(tree,'Préparer l’envoi de cet appareil');
   if(change==='disk')storage.setItem('braise.v1.game.free-001',JSON.stringify({...game,pins:['arbre']}));
   if(change==='memory')game={...game,guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1}]};
   if(change==='profile'){storage.refuse=true;snapshot=setLocalSound(true,'2026-10-01T12:00:00.000Z','new-after-preview',storage,snapshot);await act(async()=>tree.update(render()));}
   if(change==='busy')revision=null;if(change==='navigation')revision='another-board';
   await click(tree,'Confirmer l’envoi');assert.equal(puts,0);assert.equal(buttons(tree,'Confirmer l’envoi').length,0);assert.equal(tree.root.findAllByProps({role:'alert'}).length,1);
  }finally{await act(async()=>tree.unmount());}
 }
});

test('remote merge preview and confirmation refuse an unsaved current board without reloading it',async()=>{
 for(const phase of ['preview','confirmation']){
  const saved={guesses:[{word:'arbre',rank:200,temperature:12,found:false,order:1}],pins:[] as string[],hints:0,startedAt:1};
  const unsaved={...saved,guesses:[...saved.guesses,{word:'jardin',rank:42,temperature:35,found:false,order:2}]};
  const storage=new Memory();storage.setItem('braise.v1.game.free-0012',JSON.stringify(saved));browser(storage,'');
  const source=new Memory();source.setItem('braise.v1.game.free-99',JSON.stringify(saved));const payload=createDeviceEnvelope(source,loadLocalProfile(source));
  const snapshot=loadLocalProfile(storage),before=[...storage.values];let live=phase==='preview'?unsaved:saved,reads=0,tree!:ReactTestRenderer;
  globalThis.fetch=async url=>reply(url==='/api/session'?{guest:{name:'A'},csrf:'csrf'}:{revision:1,payload});
  const guard={revision:()=> 'same-board',admit:()=>assert.fail('must reject before admission'),currentGame:()=>{reads++;return{id:'free-0012',game:live};}};
  await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,mergeGuard:guard,onSnapshot:()=>assert.fail('must not reload the disk board')}));});
  try{
   await click(tree,'Configurer la synchronisation facultative');await click(tree,'Aperçu de la copie distante');
   if(phase==='confirmation'){live=unsaved;await click(tree,'Confirmer la fusion locale');}else assert.equal(buttons(tree,'Confirmer la fusion locale').length,0);
   assert.match(text(tree.root.findByProps({role:'alert'})),/partie en mémoire.*incomplète/);assert.deepEqual([...storage.values],before);assert.ok(reads>=(phase==='preview'?1:2));assert.equal(live.guesses.length,2);
  }finally{await act(async()=>tree.unmount());}
 }
});
