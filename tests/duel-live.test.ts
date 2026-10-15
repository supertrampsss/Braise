import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import Duels from '../components/duels';
import {duelShareText,type DuelView} from '../lib/duel-presentation';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
const base:DuelView={id:'d',hostName:'Alice',opponentName:'Basile',role:'host',state:'active',inviteExpires:Date.now()+86400000,deadline:Date.now()+172800000,forfeiter:null,decisions:null,guesses:[{round:0,word:'chemin',ordinal:1,rank:61,temperature:1,found:0}]};
const completed:DuelView={...base,state:'finished',decisions:[-1,0,1],vocabularySize:30000,opponentGuesses:[{round:0,word:'sentier',ordinal:1,rank:42,temperature:1,found:0}],rounds:[0,1,2].map((round)=>({own:{found:false,attempts:1,bestRank:61,closed:true},opponent:{found:false,attempts:1,bestRank:42,closed:true},revealed:true,answer:['port','peur','bonheur'][round],decision:[-1,0,1][round]}))};
function browser(){const memory=new Map();const storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)};Object.assign(globalThis,{window:{matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})},document:{hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}},localStorage:storage,sessionStorage:storage,location:{origin:'https://braiz.test',pathname:'/duels',hash:''},history:{replaceState(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});}
async function mount(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Duels));});await act(async()=>tree.root.findByProps({'data-duel-id':'d'}).props.onClick());return tree;}
function mockApi(getView:()=>DuelView,mutation?:(body:Record<string,unknown>)=>Promise<Response>,poll?:(options?:RequestInit)=>Promise<Response>){const calls:Array<{path:string;body?:Record<string,unknown>}>=[];let reads=0;globalThis.fetch=async(url,options)=>{const path=String(url),body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});if(body)return mutation?mutation(body):Response.json(getView());if(path==='/api/session')return Response.json({guest:{id:'a',name:'Alice'},csrf:'csrf'});if(path.includes('?id=')){reads++;return reads>1&&poll?poll(options):Response.json(getView());}return Response.json({duels:[{id:'d',hostName:'Alice',opponentName:'Basile',state:getView().state}]});};return calls;}

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

test('a stale background response cannot remove a guess accepted by a later mutation',async(t)=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout']});browser();let release!:(response:Response)=>void;
 const fresh={...base,guesses:[...base.guesses,{round:0,word:'route',ordinal:2,rank:50,temperature:1,found:0}]};
 mockApi(()=>base,async()=>Response.json(fresh),async()=>new Promise(resolve=>release=resolve));const tree=await mount();try{
  await act(async()=>t.mock.timers.tick(8000));await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value:'route'}}));await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));await act(async()=>release(Response.json(base)));assert(text(tree.root).includes('route'));assert.equal(tree.root.findAllByProps({className:'guess-word'}).length,2);
 }finally{await act(async()=>tree.unmount());t.mock.timers.reset();}
});
