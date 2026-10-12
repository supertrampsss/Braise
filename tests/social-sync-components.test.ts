import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import {DeviceSync} from '../components/device-sync';
import Circles from '../components/circles';
import Duels from '../components/duels';
import {SyncMemory,parseDeviceEnvelope} from '../lib/device-sync';
import {loadLocalProfile,setLocalSound,recordLocalGameProgress} from '../lib/profile-storage';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
class Memory extends SyncMemory {refuse=false;setItem(k:string,v:string){if(this.refuse)throw new Error('quota');super.setItem(k,v);}removeItem(k:string){this.values.delete(k);}clear(){this.values.clear();}}
const reply=(body:unknown)=>Response.json(body);
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
function buttons(tree:ReactTestRenderer,label:string){return tree.root.findAll(n=>n.type==='button'&&text(n)===label);}
async function click(tree:ReactTestRenderer,label:string){const button=buttons(tree,label)[0];assert.ok(button,`button ${label}: ${text(tree.root)}`);assert.ok(!button.props.disabled,`${label} enabled`);await act(async()=>button.props.onClick());}
async function input(tree:ReactTestRenderer,id:string,value:string){await act(async()=>tree.root.findByProps({id}).props.onChange({target:{value}}));}
function form(tree:ReactTestRenderer,id:string){return tree.root.findByProps({id}).parent!;}
const token='a'.repeat(64),otherToken='b'.repeat(64);
function browser(storage=new Memory(),invite=token){Object.assign(globalThis,{localStorage:storage,sessionStorage:new Memory(),location:{hash:invite?'#invitation='+invite:'',pathname:'/duels',origin:'https://braiz.io'},history:{replaceState(){}}});}

test('real upload button reconciles latest pending memory preferences and concurrent disk facts without local writes',async()=>{
 const storage=new Memory();browser(storage,'');let snapshot=loadLocalProfile(storage);let release!:(r:Response)=>void;let wait=false;let sent='';
 globalThis.fetch=async(url,options)=>{if(url==='/api/session')return reply({guest:{name:'A'},csrf:'csrf'});if(options?.method==='PUT'){sent=JSON.parse(options.body as string).payload;return reply({revision:0,payload:sent});}if(wait)return new Promise(resolve=>release=resolve);return reply({revision:-1,payload:null});};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DeviceSync,{snapshot,onSnapshot:()=>assert.fail('upload must not project profile')}));});
 try{await click(tree,'Configurer la synchronisation facultative');wait=true;await click(tree,'Préparer l’envoi de cet appareil');
 // The snapshot changes while GET is pending, after a genuine storage failure.
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
 ['duel',Duels,'duel-guest','duel-token','Accepter et démarrer les 48 heures','Reprendre mon duel'],
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
