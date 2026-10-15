import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {betterHintId} from '../lib/classic-hints';
import {evaluateWord2vec,word2vecHint,word2vecLegacyTargets,setWord2vecObjectLoaderForTests} from '../lib/word2vec.server';
import classicLexicon from '../data/semantic-v1-index.json';
import {parseWord2vecDocument,word2vecDocument} from '../lib/word2vec-storage';
import {word2vecRef} from '../lib/word2vec-contract';

test('hint selection only advances, excludes answer/used words, and returns null at rank2',()=>{
  const ranks=Array.from({length:40},(_,i)=>i+1);
  const used=new Set([39]);
  for(let level=0;level<3;level++){
    const id=betterHintId(ranks,used,level)!;assert(id>0);assert(!used.has(id));
    assert(ranks[id]<Math.min(...[...used].map(i=>ranks[i])));used.add(id);
  }
  assert.equal(betterHintId(ranks,new Set([1]),0),null);
  assert.equal(betterHintId(ranks,new Set([0]),0),null);
  assert.throws(()=>betterHintId(ranks,new Set(),3),RangeError);
});

test('three Word2Vec hints are exact corpus words, increasingly closer, and never reveal the answer',async()=>{
  setWord2vecObjectLoaderForTests(async key=>{const b=await readFile('public/'+key);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);});
  try{
    for(const target of ['assiette','maison','chemin']){
      const used=['taxe','bol'];let best=Math.min(...await Promise.all(used.map(async w=>(await evaluateWord2vec(target,w))!.rank)));
      for(let level=0;level<3;level++){
        const hint=await word2vecHint(target,level,used);assert(hint);assert(!hint.found);assert(hint.rank<best);assert(!used.includes(hint.word));assert.notEqual(hint.word,target);
        assert.deepEqual(hint,await evaluateWord2vec(target,hint.word));used.push(hint.word);best=hint.rank;
      }
    }
    const target=word2vecLegacyTargets[39],hint=await word2vecHint(target,0,['maison']);assert(hint);assert.notEqual(hint.word,'crespy');assert(classicLexicon.words.includes(hint.word));assert(hint.rank<(await evaluateWord2vec(target,'maison'))!.rank);
  }finally{setWord2vecObjectLoaderForTests(null);}
});

test('hint metadata survives strict Word2Vec saves and rejects an inconsistent or fourth hint',()=>{
  const id='daily-w2v-2026-10-13',game={startedAt:1,pins:[],hints:1,guesses:[{word:'bol',rank:350,temperature:42,found:false,hint:true,order:1}]};
  const doc=word2vecDocument(id,game);assert.deepEqual(parseWord2vecDocument(doc,id),game);
  assert.equal(parseWord2vecDocument({...doc,game:{...game,hints:0}},id),null);
  assert.equal(parseWord2vecDocument({...doc,game:{...game,hints:4}},id),null);
  assert.equal(parseWord2vecDocument({...doc,puzzleRef:{...word2vecRef(id,'daily'),corpusVersion:'fake'}},id),null);
});
