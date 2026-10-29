import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import Duels from '../components/duels';
import {duelShareText,type DuelView} from '../lib/duel-presentation';
import {REQUEST_TIMEOUT_MS} from '../lib/request-json';
import {Dialog} from '../components/ui/dialog';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
const base:DuelView={id:'d',hostName:'Alice',opponentName:'Basile',role:'host',state:'active',inviteExpires:Date.now()+86400000,deadline:Date.now()+172800000,forfeiter:null,decisions:null,guesses:[{round:0,word:'chemin',ordinal:1,rank:61,temperature:1,found:0}]};
const completed:DuelView={...base,state:'finished',decisions:[-1,0,1],vocabularySize:30000,opponentGuesses:[{round:0,word:'sentier',ordinal:1,rank:42,temperature:1,found:0}],rounds:[0,1,2].map((round)=>({own:{found:false,attempts:1,bestRank:61,closed:true},opponent:{found:false,attempts:1,bestRank:42,closed:true},revealed:true,answer:['port','peur','bonheur'][round],decision:[-1,0,1][round]}))};
function browser(){const memory=new Map();const storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)};Object.assign(globalThis,{window:{matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})},document:{hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}},localStorage:storage,sessionStorage:storage,location:{origin:'https://braiz.test',pathname:'/duels',hash:''},history:{replaceState(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});}
async function mount(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Duels));});await act(async()=>tree.root.findByProps({'data-duel-id':'d'}).props.onClick());return tree;}
function mockApi(getView:()=>DuelView,mutation?:(body:Record<string,unknown>,options?:RequestInit)=>Promise<Response>,poll?:(options?:RequestInit)=>Promise<Response>){const calls:Array<{path:string;body?:Record<string,unknown>}>=[];let reads=0;globalThis.fetch=async(url,options)=>{const path=String(url),body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});if(body)return mutation?mutation(body,options):Response.json(getView());if(path==='/api/session')return Response.json({guest:{id:'a',name:'Alice'},csrf:'csrf'});if(path.includes('?id=')){reads++;return reads>1&&poll?poll(options):Response.json(getView());}return Response.json({duels:[{id:'d',hostName:'Alice',opponentName:'Basile',state:getView().state}]});};return calls;}

test('finished duels expose solutions, both searches, per-round reasons and a spoiler-free share action',async()=>{
 browser();mockApi(()=>completed);const tree=await mount();try{const value=text(tree.root);assert(value.includes('port'));assert(value.includes('sentier'));assert(value.includes('Meilleure proximité'));assert(tree.root.findAll(node=>node.type==='button'&&text(node)==='Partager le résultat').length);const shared=duelShareText(completed);for(const word of ['port','peur','bonheur','sentier','chemin'])assert(!shared.includes(word));}finally{await act(async()=>tree.unmount());}
});

test('the rematch action addresses the previous duel instead of making a generic invitation',async()=>{
 browser();const calls=mockApi(()=>completed,async()=>Response.json({...base,id:'new',state:'pending',opponentName:'Basile',rematchOf:'d',deadline:null,guesses:[]}));const tree=await mount();try{await act(async()=>tree.root.findAll(node=>node.type==='button'&&text(node)==='Revanche')[0].props.onClick());const mutation=calls.find(call=>call.body);assert.equal(mutation?.body?.action,'rematch');assert.equal(mutation?.body?.parentId,'d');}finally{await act(async()=>tree.unmount());}
});

test('automatic refresh updates accepted facts without clearing the field or replaying submission effects',async(t)=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});browser();let data={...base};const calls=mockApi(()=>data);const tree=await mount();try{
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'institut'}}));
  data={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};
  await act(async()=>t.mock.timers.tick(8000));assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'institut');assert(text(tree.root).includes('route'));assert.equal(calls.filter(c=>c.body).length,0);assert.equal(tree.root.findByProps({'data-renderer':'fillable-svg'}).props['data-reveal-motion'],false);
  Object.assign(document,{hidden:true});const before=calls.length;await act(async()=>t.mock.timers.tick(16000));assert.equal(calls.length,before);
 }finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});

test('a confirmed409 conflict can be retried after polling while network retries retain their identity',async(t)=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});browser();let data={...base},writes=0;
 const calls=mockApi(()=>data,async()=>{writes++;if(writes===1){data={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};return Response.json({error:'Manche modifiée.'},{status:409});}return Response.json({...data,guesses:[...data.guesses,{round:0,word:'voyage',ordinal:3,rank:40,temperature:1,found:0}]});});
 const tree=await mount();try{await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'voyage'}}));await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));await act(async()=>t.mock.timers.tick(8000));assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'voyage');await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));const mutations=calls.filter(call=>call.body);assert.deepEqual(mutations.map(call=>call.body?.revision),[1,2]);assert.notEqual(mutations[0].body?.requestId,mutations[1].body?.requestId);}finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});

test('a stale background response cannot remove a guess accepted by a later mutation',async(t)=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});browser();let release!:(response:Response)=>void;
 const fresh={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};
 mockApi(()=>base,async()=>Response.json(fresh),async()=>new Promise(resolve=>release=resolve));const tree=await mount();try{
  await act(async()=>t.mock.timers.tick(8000));await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'route'}}));await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));await act(async()=>release(Response.json(base)));assert(text(tree.root).includes('route'));assert.equal(tree.root.findAllByProps({className:'guess-word'}).length,2);
 }finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});

test('a normalized duplicate gives a precise message without spending an attempt or making a request',async()=>{
 browser();const data={...base,guesses:[...base.guesses,{round:0,word:'école',ordinal:2,rank:200,temperature:1,found:0},{round:0,word:"l'homme",ordinal:3,rank:300,temperature:1,found:0}]};
 const calls=mockApi(()=>data);const tree=await mount();try{
  for(const value of [' CHEMIN ','E\u0301COLE','L’HOMME']){
   await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value}}));
   await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
   assert.match(text(tree.root),/est déjà dans vos essais/);assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,value);
  }
  assert.equal(calls.filter(call=>call.body).length,0);assert.match(text(tree.root),/3\/30 essais/);
 }finally{await act(async()=>tree.unmount());}
});

test('a stalled guess releases the form, preserves the next input and retries with the same request identity',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});browser();let writes=0;
 const data={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};
 const calls=mockApi(()=>base,async(_body,options)=>{
  if(++writes===1)return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  return Response.json(data);
 });
 const tree=await mount();try{
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'route'}}));
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  assert.equal(tree.root.findByProps({className:'guess-form'}).props['aria-busy'],true);
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'institut'}}));
  await act(async()=>t.mock.timers.tick(REQUEST_TIMEOUT_MS));
  assert.equal(tree.root.findByProps({className:'guess-form'}).props['aria-busy'],false);
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'institut');assert.match(text(tree.root),/Connexion trop lente/);
  await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'route'}}));
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  const mutations=calls.filter(call=>call.body);assert.equal(mutations.length,2);assert.equal(mutations[0].body?.requestId,mutations[1].body?.requestId);
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'');assert.match(text(tree.root),/2\/30 essais/);
 }finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});

test('the send button returns focus to the field only while the player still owns that focus',async()=>{
 for(const moved of [false,true]){
  browser();let focused=0,release!:(response:Response)=>void;
  const field={isConnected:true,focus(){focused++;Object.assign(document,{activeElement:field});}},button={},other={};
  Object.assign(document,{body:{},activeElement:button,getElementById:(id:string)=>id==='duel-word'?field:null});
  Object.assign(globalThis,{requestAnimationFrame:(callback:FrameRequestCallback)=>{callback(0);return 1;}});
  const data={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};
  mockApi(()=>base,async()=>new Promise(resolve=>release=resolve));const tree=await mount();try{
   await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'route'}}));
   await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){},currentTarget:{contains:(node:unknown)=>node===button||node===field}}));
   if(moved)Object.assign(document,{activeElement:other});
   await act(async()=>release(Response.json(data)));
   assert.equal(focused,moved?0:1);
  }finally{await act(async()=>tree.unmount());}
 }
});

test('an existing player can find access backup without starting a recovery action',async()=>{
 browser();const calls=mockApi(()=>base);const tree=await mount();try{
  const link=tree.root.findAll(node=>node.type==='a'&&text(node)==='Sauvegarder mon accès');
  assert.equal(link.length,1);assert.equal(link[0].props.href,'/espace');assert.equal(calls.filter(call=>call.body).length,0);
 }finally{await act(async()=>tree.unmount());}
});

test('sharing failures expose selectable spoiler-free text while a cancelled native share stays closed',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{for(const mode of ['clipboard','native','cancelled']){
  browser();Object.assign(document,{body:undefined});let copies=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
   ...(mode==='clipboard'?{}:{share:async()=>{throw mode==='cancelled'?new DOMException('Cancelled','AbortError'):new Error('Unavailable');}}),
   clipboard:{writeText:async()=>{copies++;throw new Error('Clipboard unavailable');}}
  }});
  mockApi(()=>completed);const tree=await mount();try{
   await act(async()=>tree.root.findAll(node=>node.type==='button'&&text(node)==='Partager le résultat')[0].props.onClick({currentTarget:null}));
   const dialog=tree.root.findAllByType(Dialog).find(node=>node.props.children.props.className==='braise-dialog duel-share')!;
   assert.equal(dialog.props.open,mode!=='cancelled');assert.equal(copies,mode==='cancelled'?0:1);
   if(mode!=='cancelled'){
    const field=dialog.props.children.props.children.find((node:{type:unknown})=>node.type==='textarea');
    assert.equal(field.props.readOnly,true);assert.equal(field.props.value,duelShareText(completed));
    for(const word of ['port','peur','bonheur','sentier','chemin'])assert(!field.props.value.includes(word));
    let selected=false;field.props.onFocus({currentTarget:{select(){selected=true;}}});assert.equal(selected,true);
   }
  }finally{await act(async()=>tree.unmount());}
 }}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator');}
});
