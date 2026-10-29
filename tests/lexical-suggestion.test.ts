import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lexicalAlternative} from '../lib/lexical-suggestion';
import {GET,POST} from '../app/api/game/route';
import {setWord2vecObjectLoaderForTests} from '../lib/word2vec.server';

test('ligature alternatives are explicit and do not broaden normalisation',()=>{
  assert.equal(lexicalAlternative(' ŒUF '),'oeuf');
  assert.equal(lexicalAlternative('cœur'),'coeur');
  assert.equal(lexicalAlternative('sœur'),'soeur');
  assert.equal(lexicalAlternative('cote'),null);
  assert.equal(lexicalAlternative('été'),null);
});

test('unknown ligatures remain rejected without a score and suggest only a real corpus entry',async()=>{
  setWord2vecObjectLoaderForTests(async key=>{const bytes=await readFile('public/'+key);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);});
  try{
    const puzzle=await (await GET(new Request('https://braiz.test/api/game?mode=free&seed=042&edition=word2vec-v1'))).json() as {id:string;ref:unknown};
    for(const [word,suggestion] of [['œuf','oeuf'],['cœur','coeur'],['sœur','soeur'],['œzzzzzz',null]]){
      const response=await POST(new Request('https://braiz.test/api/game',{method:'POST',body:JSON.stringify({mode:'free',seed:'042',puzzleId:puzzle.id,puzzleRef:puzzle.ref,action:'guess',word})}));
      assert.equal(response.status,422);
      assert.deepEqual(await response.json(),suggestion?{error:'Mot inconnu.',suggestion}:{error:'Mot inconnu.'});
    }
  }finally{setWord2vecObjectLoaderForTests(null);}
});
