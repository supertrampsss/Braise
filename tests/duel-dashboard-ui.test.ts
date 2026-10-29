import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import Duels from '../components/duels';
import type {DuelView,DuelListPage} from '../lib/duel-presentation';
import {tokenHash} from '../lib/server-security';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(value=>typeof value==='string'?value:text(value)).join('');}
function browser(){
 const memory=new Map<string,string>(),storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)};
 Object.assign(globalThis,{window:{matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})},document:{hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}},localStorage:storage,sessionStorage:storage,location:{origin:'https://braiz.test',pathname:'/duels',hash:''},history:{replaceState(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});
 return storage;
}
const base:DuelView={id:'owned',hostName:'Alice',opponentName:'Basile',role:'host',state:'active',inviteExpires:Date.now()+86400000,deadline:Date.now()+172800000,forfeiter:null,decisions:null,guesses:[{round:0,word:'chemin',ordinal:1,rank:61,temperature:1,found:0}]};
const rows=(ids:string[],state='active')=>ids.map(id=>({id,hostName:'Alice',opponentName:'Basile',state}));
const counts={play:1,waiting:1,finished:3};
function page(ids:string[],nextCursor:string|null=null,state='active'):DuelListPage{return {duels:rows(ids,state),nextCursor,counts};}
async function mount(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Duels));});return tree;}
function button(tree:ReactTestRenderer,label:string){return tree.root.findAll(node=>node.type==='button'&&text(node)===label)[0];}

test('pagination keeps older results through refresh and filter changes leave an active input intact',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});browser();const paths:string[]=[];
 globalThis.fetch=async(url)=>{const path=String(url),parsed=new URL(path,'https://braiz.test');paths.push(path);
  if(path==='/api/session')return Response.json({guest:{id:'a',name:'Alice'},csrf:'csrf'});
  if(parsed.searchParams.has('id'))return Response.json(base);
  const group=parsed.searchParams.get('group');
  return Response.json(group==='finished'?(parsed.searchParams.has('cursor')?page(['old-c'],null,'finished'):page(['old-a','old-b'],'finished:100:old-b','finished')):group==='waiting'?page(['invitation'],null,'pending'):page(['owned']));
 };
 const tree=await mount();try{
  await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'jardin'}}));
  await act(async()=>button(tree,'Terminés3').props.onClick());
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'jardin');
  await act(async()=>button(tree,'Voir plus de duels').props.onClick());
  assert.deepEqual(tree.root.findAll(node=>node.props['data-duel-id']).map(node=>node.props['data-duel-id']),['old-a','old-b','old-c']);
  await act(async()=>t.mock.timers.tick(8000));
  assert.deepEqual(tree.root.findAll(node=>node.props['data-duel-id']).map(node=>node.props['data-duel-id']),['old-a','old-b','old-c']);
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'jardin');
  assert(paths.filter(path=>path.includes('cursor=finished%3A100%3Aold-b')).length>=2);
  await act(async()=>button(tree,'En attente1').props.onClick());
  assert.deepEqual(tree.root.findAll(node=>node.props['data-duel-id']).map(node=>node.props['data-duel-id']),['invitation']);
 }finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});

test('a lost invitation can be explicitly renewed, retaining the same token after an uncertain response',async()=>{
 browser();const old='a'.repeat(64),oldHash=await tokenHash(old);let pending={...base,state:'pending',opponentName:null,deadline:null,guesses:[],invitationVersion:oldHash};
 const mutations:Array<Record<string,unknown>>=[];
 globalThis.fetch=async(url,options)=>{
  const path=String(url),body=options?.body?JSON.parse(String(options.body)):null;
  if(body){mutations.push(body);pending={...pending,invitationVersion:await tokenHash(body.token)};if(mutations.length===1)throw new TypeError('Network interrupted');return Response.json(pending);}
  if(path==='/api/session')return Response.json({guest:{id:'a',name:'Alice'},csrf:'csrf'});
  return Response.json(path.includes('?id=')?pending:page(['owned'],null,'pending'));
 };
 const tree=await mount();try{
  await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());assert.equal(mutations.length,0);assert.equal(tree.root.findAllByProps({id:'duel-link'}).length,0);
  assert(text(tree.root).includes('Le lien précédent sera invalidé.'));
  for(let retry=0;retry<2;retry++)await act(async()=>button(tree,'Créer un nouveau lien').props.onClick());
  assert.equal(mutations.length,2);assert.equal(mutations[0].action,'renew-invitation');assert.equal(mutations[0].previousVersion,oldHash);assert.equal(mutations[0].token,mutations[1].token);
  assert.equal(tree.root.findByProps({id:'duel-link'}).props.value,'https://braiz.test/duels#invitation='+mutations[0].token);
 }finally{await act(async()=>tree.unmount());}
});

test('a link retained in the tab is hidden when another device has replaced it',async()=>{
 const storage=browser();storage.setItem('braiz.duel.link.owned','https://braiz.test/duels#invitation='+'a'.repeat(64));
 const pending={...base,state:'pending',opponentName:null,deadline:null,guesses:[],invitationVersion:await tokenHash('b'.repeat(64))};
 globalThis.fetch=async url=>Response.json(String(url)==='/api/session'?{guest:{id:'a',name:'Alice'},csrf:'csrf'}:String(url).includes('?id=')?pending:page(['owned'],null,'pending'));
 const tree=await mount();try{await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());assert.equal(tree.root.findAllByProps({id:'duel-link'}).length,0);assert(button(tree,'Créer un nouveau lien'));}finally{await act(async()=>tree.unmount());}
});

test('a spelling suggestion fills the input only after explicit choice, never submits or consumes a trial',async()=>{
 browser();let mutations=0,focused=0;
 globalThis.fetch=async(url,options)=>{
  if(options?.body){mutations++;return Response.json({error:'Mot absent du dictionnaire.',suggestion:'oeuf'},{status:422});}
  return Response.json(String(url)==='/api/session'?{guest:{id:'a',name:'Alice'},csrf:'csrf'}:String(url).includes('?id=')?base:page(['owned']));
 };
 const tree=await mount();try{
  await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'œuf'}}));
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'œuf');assert.equal(mutations,1);assert.match(text(tree.root),/1\/30 essais/);
  Object.assign(document,{getElementById:(id:string)=>id==='duel-word'?{focus(){focused++;}}:null});
  await act(async()=>button(tree,'Utiliser « oeuf »').props.onClick());
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'oeuf');assert.equal(mutations,1);assert.equal(focused,1);assert.match(text(tree.root),/1\/30 essais/);
 }finally{await act(async()=>tree.unmount());}
});

test('a late unknown-word response does not mark the next typed word invalid or offer an outdated spelling',async()=>{
 browser();let respond!:(response:Response)=>void;
 globalThis.fetch=async(url,options)=>{
  if(options?.body)return new Promise<Response>(resolve=>{respond=resolve;});
  return Response.json(String(url)==='/api/session'?{guest:{id:'a',name:'Alice'},csrf:'csrf'}:String(url).includes('?id=')?base:page(['owned']));
 };
 const tree=await mount();try{
  await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'œuf'}}));
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'jardin'}}));
  await act(async()=>respond(Response.json({error:'Mot absent du dictionnaire.',suggestion:'oeuf'},{status:422})));
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'jardin');
  assert.equal(button(tree,'Utiliser « oeuf »'),undefined);assert.doesNotMatch(text(tree.root),/Mot absent du dictionnaire/);
 }finally{await act(async()=>tree.unmount());}
});
