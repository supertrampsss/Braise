import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import manifest from '../data/word2vec-index.json';
import { loadWord2vecObjectFromRuntime } from '../lib/word2vec.server';

test('HTTP asset packaging delivers the pinned compressed bytes without transparent gzip decoding',async()=>{
  const entry=manifest.targets.find(target=>target.word==='assiette')!;
  const compressed=await readFile('public/'+entry.key);
  const server=createServer((request,response)=>{
    assert.equal(request.url,'/'+entry.key);
    // Match static HTTP serving: a .gz pathname declares an encoded resource.
    if(request.url!.endsWith('.gz'))response.setHeader('Content-Encoding','gzip');
    response.end(compressed);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  try{
    const runtime={ASSETS:{fetch:(request:Request)=>fetch(`http://127.0.0.1:${address.port}${new URL(request.url).pathname}`)}};
    const delivered=await loadWord2vecObjectFromRuntime(runtime,entry.key);assert(delivered);
    assert.equal(delivered.byteLength,entry.compressedBytes);
    assert.equal(createHash('sha256').update(Buffer.from(delivered)).digest('hex'),entry.objectSha256);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
