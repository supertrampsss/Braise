import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { indexCanonicalTar } from '../scripts/build-semantic-range-pack-v2.mjs';
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function tar(name = 'file.json', type = 48) {
 const header = Buffer.alloc(512); header.write(name); header.write('00000000003\0',124); header[156]=type; header.write('ustar\0',257);
 header.fill(32,148,156); header.write(header.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
 return Buffer.concat([header,Buffer.from('abc'),Buffer.alloc(509+1024)]);
}
function pin(bytes: Buffer) { return {bytes:bytes.length,sha256:sha256(bytes),chunks:[{bytes:bytes.length,sha256:sha256(bytes)}]}; }
test('offline TAR positions bind complete archive, chunks and logical file bytes', async()=>{
 const root=await mkdtemp(join(tmpdir(),'range-tar-'));const path=join(root,'input.tar');
 try {const bytes=tar();await writeFile(path,bytes);const indexed=await indexCanonicalTar(path,pin(bytes));assert.deepEqual(indexed.files,[{path:'file.json',offset:512,bytes:3,sha256:sha256(Buffer.from('abc'))}]);
 const corrupt=pin(bytes);corrupt.sha256='0'.repeat(64);await assert.rejects(indexCanonicalTar(path,corrupt),/hash mismatch/);
 corrupt.sha256=pin(bytes).sha256;corrupt.chunks[0].sha256='0'.repeat(64);await assert.rejects(indexCanonicalTar(path,corrupt),/chunk hash/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('offline TAR refuses traversal, links, extension state, duplicate entries and malformed padding',async t=>{
 const root=await mkdtemp(join(tmpdir(),'range-tar-'));const path=join(root,'input.tar');
 try {for(const [name,bytes] of Object.entries({traversal:tar('../secret'),symlink:tar('file',50),pax:tar('file',120),duplicate:Buffer.concat([tar().subarray(0,1024),tar()]),checksum:(()=>{const b=tar();b[0]^=1;return b;})(),trailing:(()=>{const b=tar();b[b.length-1]=1;return b;})(),unterminated:tar().subarray(0,1024)})) await t.test(name,async()=>{await writeFile(path,bytes);await assert.rejects(indexCanonicalTar(path,pin(bytes)));});
 await mkdir(join(root,'directory'));await assert.rejects(indexCanonicalTar(join(root,'directory'),pin(tar())),/archive pin/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('target packaging preserves the independently verified inventory and refuses later archive corruption',async()=>{
 const {buildSemanticCorpus}=await import('../scripts/build-semantic-corpus-v2.mjs');
 const {qualifySemanticBatch}=await import('../scripts/qualify-semantic-batch-v2.mjs');
 const {loadActiveCorpus}=await import('../scripts/semantic-target-v2-common.mjs');
 const {packRuntimeTarget}=await import('../scripts/build-semantic-range-pack-v2.mjs');
 const {readFile}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'range-target-'));const corpusDir=join(root,'c'),archiveDir=join(root,'a'),outputDir=join(root,'pack');
 try{const source=join(root,'source.vec');await writeFile(source,'4 2\nalpha 1 0\nbêta 0 1\ngamma -1 0\ndelta 0 -1\n');await buildSemanticCorpus({sourcePath:source,outputDir:corpusDir});const corpus=await loadActiveCorpus(corpusDir);
 await qualifySemanticBatch({corpusDir,archiveDir,targetsDir:join(root,'t'),evidenceDir:join(root,'e'),checkpointDir:join(root,'p'),targetIds:[0],onProgress:()=>{}});await mkdir(outputDir);
 const packed=await packRuntimeTarget({archiveDir,corpus,targetId:0,outputDir});const chunk=packed.archive.chunks[0];const bytes=await readFile(join(outputDir,chunk.sha256+'.blob'));assert.equal(sha256(bytes),chunk.sha256);assert.ok(bytes.length<8*1024*1024);
 const archiveRoot=join(archiveDir,corpus.manifest.corpusId,'targets','0000000000');for(const file of packed.files)assert.deepEqual(bytes.subarray(file.offset,file.offset+file.bytes),await readFile(join(archiveRoot,file.path)));
 const tarPath=join(root,'pack.tar');await writeFile(tarPath,bytes);assert.deepEqual((await indexCanonicalTar(tarPath,{...chunk,chunks:[chunk]})).files,packed.files);
 await writeFile(join(archiveRoot,packed.files.find((f:{path:string})=>f.path.startsWith('pages/'))!.path),'corrupt');await assert.rejects(packRuntimeTarget({archiveDir,corpus,targetId:0,outputDir}),/archive object mismatch/);assert.deepEqual(await readFile(join(outputDir,chunk.sha256+'.blob')),bytes);
 }finally{await rm(root,{recursive:true,force:true});}
});
