import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import Duels from '../components/duels';
import ServerGame from '../components/server-game';
import {SyncMemory} from '../lib/device-sync';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function text(node:ReactTestInstance):string{return node.children.map(c=>typeof c==='string'?c:text(c)).join('');}
for(const [kind,Component] of [['duel',Duels],['server',ServerGame]] as const) test(`${kind} real resumed history formats12.25 and1234 in French without modifying scores`,async()=>{
 Object.assign(globalThis,{window:{addEventListener(){},removeEventListener(){},setInterval(){return 0;},clearInterval(){}},document:{hidden:false,addEventListener(){},removeEventListener(){}},location:{hash:'',search:'?game=owned',pathname:'/'+kind,origin:'https://braiz.test'},sessionStorage:new SyncMemory()});
 const guess={word:'arbre',temperature:12.25,rank:1234,ordinal:1,found:kind==='duel'?0:false,round:0};const original=JSON.stringify(guess);
 globalThis.fetch=async url=>{const path=String(url);if(path==='/api/session')return Response.json({guest:{id:'guest',name:'A'},csrf:'csrf'});if(path.includes('?id='))return Response.json(kind==='duel'?{id:'owned',state:'active',hostName:'A',opponentName:'B',role:'host',deadline:null,guesses:[guess]}:{game:{id:'owned',state:'active',revision:1},guesses:[guess]});return Response.json(kind==='duel'?{duels:[{id:'owned',state:'active'}]}:{games:[]});};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(Component));});
 try{if(kind==='duel')await act(async()=>tree.root.findAll(n=>n.type==='button'&&text(n).startsWith('Défi owned'))[0].props.onClick());assert.match(text(tree.root),/12°/);assert.match(text(tree.root),/1\u202f234/);assert.doesNotMatch(text(tree.root),/12\.3°/);assert.equal(JSON.stringify(guess),original);}finally{await act(async()=>tree.unmount());}
});

for (const revision of [0, 1, 2]) test(`server real resumed revision ${revision} uses truthful singular/plural copy`, async () => {
 Object.assign(globalThis,{window:{addEventListener(){},removeEventListener(){},setInterval(){return 0;},clearInterval(){}},document:{hidden:false,addEventListener(){},removeEventListener(){}},location:{hash:'',search:'?game=owned',pathname:'/espace',origin:'https://braiz.test'},sessionStorage:new SyncMemory()});
 const view={game:{id:'owned',state:'active',revision},guesses:Array.from({length:revision},(_,index)=>({word:'maison',temperature:33.2,rank:121,ordinal:index+1,found:false}))};
 const original=JSON.stringify(view);
 globalThis.fetch=async url=>{const path=String(url);if(path==='/api/session')return Response.json({guest:{id:'guest',name:'A'},csrf:'csrf'});if(path.includes('?id='))return Response.json(view);return Response.json({games:[]});};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(ServerGame));});
 try{assert.match(text(tree.root),new RegExp(`${revision} ${revision===1?'essai conservé':'essais conservés'} côté serveur`));assert.equal(JSON.stringify(view),original);}finally{await act(async()=>tree.unmount());}
});
