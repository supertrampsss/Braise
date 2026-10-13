import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import index from '../data/semantic-v1-index.json';
import {findWord,nextHint} from '../lib/semantic';
import {setSemanticObjectLoaderForTests} from '../lib/semantic-storage';

setSemanticObjectLoaderForTests(async key=>{const bytes=await readFile('public/'+key);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);});
test('legacy neighbour suggestions follow the raw model order without editorial word or stem filters',async()=>{
  for(const segment of index.segments){
    const raw=gunzipSync(await readFile('public/'+segment.key)),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    const rankOffset=view.getUint32(24,true),orderOffset=view.getUint32(28,true);
    for(const start of [5,10,20,50,100,200,500]){
      const guesses=Array.from({length:5},(_,i)=>index.words[view.getUint16(orderOffset+(start+i)*2,true)]);
      const best=Math.min(...guesses.map(word=>view.getUint16(rankOffset+findWord(word)!*2,true)));
      const first=Math.min(350,Math.max(1,Math.floor(best*.55)));
      const expected=index.words[view.getUint16(orderOffset+first*2,true)];
      const actual=await nextHint(segment.targetIndex,0,guesses);
      assert.equal(actual?.word,expected,segment.word+' must follow the model, including unfamiliar words');
    }
  }
});
