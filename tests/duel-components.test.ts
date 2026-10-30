import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,StrictMode} from 'react';
import {act,create,type ReactTestRenderer,type ReactTestInstance} from 'react-test-renderer';
import Duels from '../components/duels';
import {SyncMemory} from '../lib/device-sync';
import type {DuelView} from '../lib/duel-presentation';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(value=>typeof value==='string'?value:text(value)).join('');}
class Memory extends SyncMemory{removeItem(key:string){this.values.delete(key);}}
function browser(){Object.assign(globalThis,{window:{matchMedia(){return {matches:true,addEventListener(){},removeEventListener(){}};}},document:{hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}},localStorage:new Memory(),sessionStorage:new Memory(),location:{hash:'',pathname:'/duels',origin:'https://braiz.test'},history:{replaceState(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){}});}
const initial:DuelView={id:'owned',hostName:'A',opponentName:'B',inviteExpires:Date.now()+604800000,state:'active',deadline:Date.now()+172800000,role:'host',forfeiter:null,decisions:null,guesses:[{round:0,word:'route',ordinal:1,rank:281,temperature:25,found:0},{round:0,word:'chemin',ordinal:2,rank:61,temperature:25,found:0}]};
async function mount(view=initial,strict=false){let tree!:ReactTestRenderer;await act(async()=>{tree=create(strict?createElement(StrictMode,null,createElement(Duels)):createElement(Duels));});await act(async()=>tree.root.findByProps({'data-duel-id':'owned'}).props.onClick());return tree;}
async function word(tree:ReactTestRenderer,value:string){await act(async()=>tree.root.findByProps({id:'duel-word'}).props.onChange({target:{value}}));}
function route(view:DuelView,mutation?:(body:Record<string,unknown>)=>Promise<Response>){const calls:Array<{path:string;body?:Record<string,unknown>}>=[];globalThis.fetch=async(url,options)=>{const path=String(url),body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});if(body)return mutation?mutation(body):Response.json(view);if(path==='/api/session')return Response.json({guest:{id:'guest',name:'A'},csrf:'csrf'});return Response.json(path.includes('?id=')?view:{duels:[{id:'owned',state:view.state,hostName:view.hostName,opponentName:view.opponentName}]});};return calls;}
test('a restored duel uses the approved flame, exact proximity, nearest-first history and silent restoration',async()=>{
 browser();const data=JSON.parse(JSON.stringify(initial)),raw=JSON.stringify(data),calls=route(data);const tree=await mount(data,true);
 try{assert.equal(calls.filter(call=>call.path==='/api/session').length,1);assert.equal(calls.filter(call=>call.body).length,0);assert.deepEqual(tree.root.findAllByProps({className:'guess-word'}).map(node=>text(node)),['chemin','route']);assert.equal(tree.root.findByProps({id:'duel-word'}).props.placeholder,'Mot');assert.equal(tree.root.findByProps({'aria-label':'Envoyer'}).children[0],'Envoyer');assert.doesNotMatch(text(tree.root),/°|Votre mot|Proposer|restantes|rang /);const flame=tree.root.findByProps({'data-renderer':'fillable-svg'});assert.equal(flame.props['data-celebrating'],false);assert.equal(flame.props['data-reveal-motion'],false);assert.equal(JSON.stringify(data),raw);}finally{await act(async()=>tree.unmount());}
});
test('accepted guesses preserve edits during the request and a worse guess cannot lower the best progression',async()=>{
 browser();let release!:(response:Response)=>void;let data=JSON.parse(JSON.stringify(initial)) as DuelView;const calls=route(data,async()=>new Promise(resolve=>release=resolve));const tree=await mount(data);
 try{const position=tree.root.findByProps({className:'proximity-meter'}).props.style['--proximity-position'];await word(tree,'taxe');await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));await word(tree,'institut');data={...data,guesses:[...data.guesses,{round:0,word:'taxe',ordinal:3,rank:20000,temperature:9,found:0}]};await act(async()=>release(Response.json(data)));assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'institut');assert.equal(tree.root.findByProps({className:'proximity-meter'}).props.style['--proximity-position'],position);assert.equal(tree.root.findByProps({'data-renderer':'fillable-svg'}).props['data-reveal-motion'],false);assert.equal(calls.filter(call=>call.body?.action==='guess').length,1);}finally{await act(async()=>tree.unmount());}
});
test('a refused word stays in the field, adds no trial and a retry preserves the request identity',async()=>{
 browser();const calls=route(initial,async()=>Response.json({error:'Mot absent du dictionnaire.'},{status:422}));const tree=await mount();
 try{await word(tree,'inconnu');for(let i=0;i<2;i++)await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'inconnu');assert.match(text(tree.root),/Mot absent du dictionnaire/);assert.match(text(tree.root),/2\/30 essais/);const mutations=calls.filter(call=>call.body?.action==='guess');assert.equal(mutations.length,2);assert.equal(mutations[0].body?.requestId,mutations[1].body?.requestId);}finally{await act(async()=>tree.unmount());}
});
test('switching rounds clears a previous rejection but keeps a new rejection visible',async()=>{
 browser();const calls=route(initial,async()=>Response.json({error:'Mot absent du dictionnaire.'},{status:422}));const tree=await mount();
 try{
  await word(tree,'premierinconnu');
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  assert.equal(text(tree.root.findByProps({id:'duel-error'})),'Mot absent du dictionnaire.');
  const rounds=tree.root.findByProps({'aria-label':'Choisir la manche'}).findAllByType('button');
  await act(async()=>rounds[1].props.onClick());
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'');
  assert.equal(tree.root.findAllByProps({id:'duel-error'}).length,0);
  assert.match(text(tree.root),/0\/30 essais/);
  assert.equal(calls.filter(call=>call.body?.action==='guess').length,1);
  await word(tree,'secondinconnu');
  await act(async()=>tree.root.findByProps({className:'guess-form'}).props.onSubmit({preventDefault(){}}));
  assert.equal(text(tree.root.findByProps({id:'duel-error'})),'Mot absent du dictionnaire.');
  assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'secondinconnu');
  assert.equal(tree.root.findByProps({className:'guess-form'}).props['aria-busy'],false);
  assert.match(text(tree.root),/0\/30 essais/);
  assert.deepEqual(calls.filter(call=>call.body?.action==='guess').map(call=>call.body?.round),[0,1]);
 }finally{await act(async()=>tree.unmount());}
});

test('switching rounds restores only that round and never replays a win celebration or a proposal',async()=>{
 browser();const data={...initial,guesses:[...initial.guesses,{round:1,word:'assiette',ordinal:1,rank:1,temperature:100,found:1}]};const calls=route(data);const tree=await mount(data);
 try{const buttons=tree.root.findByProps({'aria-label':'Choisir la manche'}).findAllByType('button');await act(async()=>buttons[1].props.onClick());assert.equal(tree.root.findAllByProps({id:'duel-word'}).length,0);assert.deepEqual(tree.root.findAllByProps({className:'guess-word'}).map(node=>text(node)),['assiette']);assert.equal(tree.root.findByProps({'data-renderer':'fillable-svg'}).props['data-celebrating'],false);await act(async()=>buttons[0].props.onClick());assert.equal(tree.root.findByProps({id:'duel-word'}).props.value,'');assert.equal(calls.filter(call=>call.body).length,0);}finally{await act(async()=>tree.unmount());}
});
test('an expired or terminal duel exposes its factual result and cannot submit a word',async()=>{
 for(const data of [{...initial,deadline:Date.now()-1},{...initial,state:'finished',decisions:[-1,0,1]}]){browser();route(data);const tree=await mount(data);try{assert.equal(tree.root.findAllByProps({id:'duel-word'}).length,0);if(data.state==='finished'){assert.match(text(tree.root),/Égalité/);assert.match(text(tree.root),/1 — 1/);}else assert.match(text(tree.root),/Délai écoulé/);}finally{await act(async()=>tree.unmount());}}
});
test('explicit fresh creation submits the pseudonym then creates one private duel with the new session CSRF',async()=>{
 browser();const calls:Array<{path:string;body?:Record<string,unknown>;csrf?:string}>=[];const pending={...initial,state:'pending',opponentName:null,deadline:null,guesses:[]};
 globalThis.fetch=async(url,options)=>{const path=String(url),body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body,csrf:(options?.headers as Record<string,string>)?.['X-Braise-CSRF']});if(path==='/api/session')return Response.json(body?{guest:{id:'guest',name:'A'},csrf:'fresh-csrf'}:{guest:null});return Response.json(body?pending:{duels:[{id:'owned',state:'pending',hostName:'A',opponentName:null}]});};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Duels));});
 try{assert.equal(calls.filter(call=>call.body).length,0);await act(async()=>tree.root.findAll(node=>node.type==='button'&&text(node)==='Créer un duel')[0].props.onClick());const input=tree.root.findByProps({id:'duel-guest'});await act(async()=>input.props.onChange({target:{value:'A'}}));await act(async()=>input.parent!.props.onSubmit({preventDefault(){}}));const mutations=calls.filter(call=>call.body);assert.equal(mutations.length,2);assert.deepEqual(mutations[0].body,{name:'A'});assert.equal(mutations[1].body?.action,'create');assert.equal(mutations[1].csrf,'fresh-csrf');assert.match(tree.root.findByProps({id:'duel-link'}).props.value,/\/duels#invitation=[a-f0-9]{64}$/);assert.equal(calls.filter(call=>call.body?.action==='accept').length,0);}finally{await act(async()=>tree.unmount());}
});
test('opening an accepted duel replaces pending list metadata with actual names and its deadline',async()=>{
 browser();globalThis.fetch=async url=>{const path=String(url);if(path==='/api/session')return Response.json({guest:{id:'guest',name:'A'},csrf:'csrf'});return Response.json(path.includes('?id=')?initial:{duels:[{id:'owned',state:'pending',hostName:'A',opponentName:null,deadline:null}]});};
 const tree=await mount();try{const row=tree.root.findByProps({'data-duel-id':'owned'});assert.match(text(row),/A vs B/);assert.match(text(row),/En cours/);assert.doesNotMatch(text(row),/invitation|Invitation envoyée/);}finally{await act(async()=>tree.unmount());}
});
