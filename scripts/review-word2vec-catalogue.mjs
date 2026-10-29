import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

// A private editorial worksheet from immutable published columns, never a new ranking.
const root=new URL('../',import.meta.url);
const manifestBytes=await readFile(new URL('data/word2vec-index.json',root));
const index=JSON.parse(manifestBytes);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const entries=[];
for(const target of index.targets){
  const compressed=await readFile(new URL('public/'+target.key,root));
  assert.equal(compressed.length,target.compressedBytes,target.word);
  assert.equal(sha(compressed),target.objectSha256,target.word);
  const raw=gunzipSync(compressed,{maxOutputLength:target.rawBytes});
  assert.equal(raw.length,target.rawBytes,target.word);
  assert.equal(sha(raw),target.rawSha256,target.word);
  assert.equal(raw.toString('ascii',0,4),'BWS2');
  assert.equal(raw.readUInt32LE(8),index.vocabularySize);
  assert.equal(raw.readUInt32LE(12),target.wordId);
  const offset=raw.readUInt32LE(20);
  assert.equal(raw.readUInt32LE(offset),target.wordId);
  const neighbours=Array.from({length:64},(_,position)=>{
    const wordId=raw.readUInt32LE(offset+4*(position+1));
    return {word:index.words[wordId],rank:position+2,storedScore:raw.readInt16LE(32+2*(position+1))};
  });
  entries.push({word:target.word,objectSha256:target.objectSha256,neighbours,editorialDecision:'pending-human-review'});
}
const output=new URL('work/editorial-review/',root);
await mkdir(output,{recursive:true});
const report={format:'braiz-word2vec-editorial-review',version:1,generatedAt:new Date().toISOString(),corpus:index.corpusVersion,manifestSha256:sha(manifestBytes),columnsVerified:entries.length,neighboursPerTarget:64,numericalScope:'Hashes, header and exact neighbour extraction. Not a recomputation from source vectors.',entries};
await writeFile(new URL('catalogue.json',output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({columnsVerified:entries.length,neighboursPerTarget:64,report:'work/editorial-review/catalogue.json',editorialApproval:false}));
