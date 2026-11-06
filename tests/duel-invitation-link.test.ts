import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import {DuelInvitationLink} from '../components/duel-invitation-link';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const link='https://braiz.test/duels#invitation='+'a'.repeat(64);
function text(node:ReactTestInstance):string{return node.children.map(value=>typeof value==='string'?value:text(value)).join('');}
function button(tree:ReactTestRenderer,label:string){return tree.root.findAll(node=>node.type==='button'&&text(node).trim()===label)[0];}
async function mount(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(createElement(DuelInvitationLink,{link}));});return tree;}
function browser(value:object){Object.defineProperty(globalThis,'navigator',{configurable:true,value});}

test('invitation sharing requires an explicit click and contains only the invitation, never an assertion of delivery',async()=>{
  const shares:ShareData[]=[],copies:string[]=[];
  browser({share:async(data:ShareData)=>{shares.push(data);},clipboard:{writeText:async(value:string)=>{copies.push(value);}}});
  const tree=await mount();try{
    assert.equal(shares.length,0);assert.equal(copies.length,0);
    await act(async()=>button(tree,'Inviter un ami').props.onClick());
    assert.equal(shares.length,1);assert.equal(shares[0].url,link);
    assert.equal(shares[0].title,'BRAIZ · Duel');assert.equal(copies.length,0);
    assert.doesNotMatch(text(tree.root),/envoy|reçu|Copié/i);
  }finally{await act(async()=>tree.unmount());}
});

test('cancelling native sharing is silent and never copies the private link',async()=>{
  let copies=0;
  browser({share:async()=>{throw new DOMException('Cancelled','AbortError');},clipboard:{writeText:async()=>{copies++;}}});
  const tree=await mount();try{
    await act(async()=>button(tree,'Inviter un ami').props.onClick());
    assert.equal(copies,0);assert.equal(text(tree.root.findByProps({role:'status'})),'');
    assert.equal(tree.root.findByProps({id:'duel-link'}).props.value,link);
  }finally{await act(async()=>tree.unmount());}
});

test('unsupported native sharing copies the invitation and tells the player to send it',async()=>{
  const copies:string[]=[];browser({clipboard:{writeText:async(value:string)=>{copies.push(value);}}});
  const tree=await mount();try{
    await act(async()=>button(tree,'Inviter un ami').props.onClick());
    assert.deepEqual(copies,[link]);assert.match(text(tree.root),/Collez-le dans un message/);
    assert.doesNotMatch(text(tree.root),/envoyée/);
  }finally{await act(async()=>tree.unmount());}
});

test('a denied native share leaves the explicit clipboard fallback available',async()=>{
  const copies:string[]=[];
  browser({share:async()=>{throw new DOMException('Denied','NotAllowedError');},clipboard:{writeText:async(value:string)=>{copies.push(value);}}});
  const tree=await mount();try{
    await act(async()=>button(tree,'Inviter un ami').props.onClick());assert.equal(copies.length,0);
    assert.match(text(tree.root),/partage est indisponible/);
    await act(async()=>button(tree,'Copier le lien').props.onClick());assert.deepEqual(copies,[link]);
    assert.match(text(tree.root),/Lien copié/);
  }finally{await act(async()=>tree.unmount());}
});

test('a denied clipboard leaves a selectable link and a late copy cannot label a renewed link as copied',async()=>{
  browser({clipboard:{writeText:async()=>{throw new Error('Denied');}}});
  const tree=await mount();try{
    await act(async()=>button(tree,'Copier le lien').props.onClick());
    assert.match(text(tree.root),/Sélectionnez le lien/);
    let release!:()=>void;browser({clipboard:{writeText:()=>new Promise<void>(resolve=>{release=resolve;})}});
    let pending!:Promise<void>;await act(async()=>{pending=button(tree,'Copier le lien').props.onClick();});
    const renewed=link.replace(/a{64}$/,'b'.repeat(64));
    await act(async()=>tree.update(createElement(DuelInvitationLink,{link:renewed})));
    await act(async()=>{release();await pending;});
    assert.equal(tree.root.findByProps({id:'duel-link'}).props.value,renewed);
    assert.equal(text(tree.root.findByProps({role:'status'})),'');assert(button(tree,'Copier le lien'));
  }finally{await act(async()=>tree.unmount());}
});
