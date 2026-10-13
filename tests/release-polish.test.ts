import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import TwoBraises from '../components/two-braises-game';
import Intruder from '../components/intruder-game';
import EmbedDemo from '../components/embed-demo';
import {ProfileTransfer} from '../components/profile-transfer';
import {SyncMemory} from '../lib/device-sync';
import {loadLocalProfile,saveIntruderAttempt} from '../lib/profile-storage';
import {answerIntruder,summarizeIntruder} from '../lib/intruder-server';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
function browser(){
 const storage=new SyncMemory(),frames:Array<()=>void>=[];
 const body={},doc={activeElement:body as unknown,body,hidden:false,addEventListener(){},removeEventListener(){}};
 Object.assign(globalThis,{document:doc,localStorage:storage,location:{search:'',origin:'https://braiz.test'},window:{addEventListener(){},removeEventListener(){}},requestAnimationFrame:(fn:()=>void)=>frames.push(fn),cancelAnimationFrame(){}});
 return{storage,frames,doc};
}
async function submit(tree:ReactTestRenderer,word:string){await act(async()=>tree.root.findByProps({id:'two-guess'}).props.onChange({target:{value:word}}));await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){},currentTarget:{contains(){return true;}}}));}
function evaluation(word:string,foundA:boolean,foundB:boolean){return{word,values:[{word,temperature:foundA?100:20,rank:foundA?1:200,found:foundA},{word,temperature:foundB?100:30,rank:foundB?1:300,found:foundB}]};}
for(const finish of ['focus','move-away','unmount'] as const)test(`TwoBraises accepted final action ${finish}: focus ownership and restoration stay distinct`,async()=>{
 const b=browser();let focuses=0;let resultNode:unknown;
 globalThis.fetch=async(_url,opts)=>{const word=JSON.parse(opts!.body as string).word;return Response.json(evaluation(word,word==='arbre',word==='fleur'));};
 const mock=(node:ReactElement)=>{const props=node.props as {tabIndex?:number};const value={focus(){b.doc.activeElement=value;if(props.tabIndex===-1)focuses++;}};if(props.tabIndex===-1)resultNode=value;return value;};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(TwoBraises),{createNodeMock:mock});});
 try{
  await submit(tree,'arbre');assert.match(text(tree.root.findByType('caption')),/^1 essai distinct$/);await act(async()=>{b.frames.splice(0).forEach(fn=>fn());});
  await submit(tree,'fleur');assert.equal(tree.root.findAllByType('form').length,0);assert.match(text(tree.root),/Les deux mots sont trouvés ! 2 essais/);
  assert.equal(focuses,0,'focus is deferred until result DOM commits');
  if(finish==='move-away')b.doc.activeElement={otherControl:true};
  if(finish==='unmount')await act(async()=>tree.unmount());
  await act(async()=>{b.frames.splice(0).forEach(fn=>fn());});
  assert.equal(focuses,finish==='focus'?1:0);
  if(finish==='focus'){
   assert.equal(b.doc.activeElement,resultNode);
   await act(async()=>tree.unmount());b.doc.activeElement=b.doc.body;focuses=0;
   await act(async()=>{tree=create(createElement(TwoBraises),{createNodeMock:mock});});
   assert.match(text(tree.root),/Les deux mots sont trouvés ! 2 essais/);
   assert.equal(b.frames.length,0,'restoration must not schedule terminal focus');assert.equal(focuses,0);assert.equal(b.doc.activeElement,b.doc.body);
  }
 }finally{await act(async()=>tree.unmount());}
});
test('Intrus completed restore renders exactly one answer to review without replaying any response',async()=>{
 browser();
 for(let index=0;index<20;index++){const correct=answerIntruder(index,0).answer;const choice=index===0?(correct+1)%4:correct;saveIntruderAttempt({edition:'intrus-v1',index,choice,occurredAt:new Date().toISOString()});}
 let calls=0;globalThis.fetch=async(url,opts)=>{assert.equal(url,'/api/intruder/summary');calls++;return Response.json(summarizeIntruder(JSON.parse(opts!.body as string).attempts));};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Intruder));});
 try{assert.equal(calls,1);const summary=text(tree.root.findByProps({'aria-label':'Bilan de la session'}));assert.match(summary,/19 réponses justes · 1 réponse à revoir/);assert.doesNotMatch(summary,/1 réponses à revoir/);}
 finally{await act(async()=>tree.unmount());}
});
test('profile picker has a meaningful name and its visible import button still triggers the native file control',async()=>{
 const b=browser();let opened=0;let tree!:ReactTestRenderer;
 await act(async()=>{tree=create(createElement(ProfileTransfer,{snapshot:loadLocalProfile(b.storage),onSnapshot(){}}),{createNodeMock:node=>node.type==='input'&&(node.props as {type?:string}).type==='file'?{click(){opened++;}}:null});});
 try{const file=tree.root.findByProps({type:'file'});assert.equal(file.props['aria-label'],'Fichier JSON du profil à importer');assert.equal(file.props.tabIndex,-1);assert.equal(file.props['aria-hidden'],'true');const action=tree.root.findAll(n=>n.type==='button'&&text(n)==='Importer un fichier JSON')[0];await act(async()=>action.props.onClick());assert.equal(opened,1);}
 finally{await act(async()=>tree.unmount());}
});
test('enabled integration copy describes real origin access without a stale public-closed claim',()=>{
 const markup=renderToStaticMarkup(createElement(EmbedDemo));assert.doesNotMatch(markup,/restent fermés au public/);assert.match(markup,/une adresse autorisée/);assert.match(markup,/cookies tiers/);
});
