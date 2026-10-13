import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import{semanticRuntimeQualification,type RuntimeQualificationSet}from'../lib/semantic-runtime-qualification';
import{boundedRangeBucket}from'../lib/semantic-v2-bounded-r2';
import type{RangeBucket}from'../lib/semantic-v2-range-r2';
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const token='x'.repeat(64), expires='2099-01-01T00:00:00Z';
function fixture(){
 const blobs=new Map<string,Uint8Array>();const add=(b:Uint8Array)=>{const r={sha256:hash(b),bytes:b.length};blobs.set(r.sha256,b);return r;};
 const bytes=new TextEncoder().encode('real bounded bytes');const chunk=add(bytes);const key='corpus/target/object';
 const shard=add(new TextEncoder().encode(JSON.stringify({schemaVersion:1,format:'BRT2-range-shard',archive:{bytes:bytes.length,chunks:[chunk]},files:[{key,offset:0,...chunk}]})));
 const rootReference=add(new TextEncoder().encode(JSON.stringify({schemaVersion:1,format:'BRT2-range-root',shards:[{prefix:'corpus/',...shard}]})));
 const set:RuntimeQualificationSet={schemaVersion:1,rootReference,pins:{corpusId:'corpus',manifestSha256:'a'.repeat(64),semanticSha256:'b'.repeat(64),dictionarySize:5,index:{key,sha256:chunk.sha256},targets:{'0':{key,sha256:chunk.sha256}}},cases:[{caseId:'range',kind:'range',key,bytes:bytes.length,sha256:chunk.sha256},{caseId:'wrong-pin',kind:'wrong-pin',word:'mot'},{caseId:'corrupt-range',kind:'corrupt-range',targetId:0,wordId:1}]};
 const pinset=hash(JSON.stringify(set));let reads=0;
 const bucket:RangeBucket={async get(key,options){reads++;const b=blobs.get(key.split('/').at(-1)!);if(!b)return null;const part=options?b.slice(options.range.offset,options.range.offset+options.range.length):b;return{size:b.length,range:options?.range,body:new Blob([part as Uint8Array<ArrayBuffer>]).stream()};}};
 return{set,pinset,bucket,blobs,reads:()=>reads};
}
const request=(body:unknown={caseId:'range'},auth=`Bearer ${token}`)=>new Request('https://example.test/api/semantic-runtime-qualification',{method:'POST',headers:{authorization:auth},body:JSON.stringify(body)});
test('private qualification requires temporary bounded auth and exact compiled capability before any read',async()=>{
 const f=fixture();for(const runtime of [{},{token,expires:'2000-01-01',pinset:f.pinset},{token,expires,pinset:'0'.repeat(64)}])assert.equal((await semanticRuntimeQualification(request(),{...runtime,bucket:f.bucket},f.set,f.pinset)).status,404);
 for(const auth of ['Bearer wrong','x'.repeat(1025)])assert.equal((await semanticRuntimeQualification(request(undefined,auth),{token,expires,pinset:f.pinset,bucket:f.bucket},f.set,f.pinset)).status,404);
 assert.equal(f.reads(),0);
 const modified=structuredClone(f.set);modified.cases[0].caseId='changed';assert.equal((await semanticRuntimeQualification(request(),{token,expires,pinset:f.pinset,bucket:f.bucket},modified,f.pinset)).status,503);assert.equal(f.reads(),0);
});
test('qualification accepts only one compiled case and emits hashes/counters, no words or paths',async()=>{
 const f=fixture();const runtime={token,expires,pinset:f.pinset,bucket:f.bucket};
 for(const body of [{caseId:'range',key:'secret'},[{caseId:'range'}],{caseId:'x'.repeat(257)}])assert.equal((await semanticRuntimeQualification(request(body),runtime,f.set,f.pinset)).status,400);
 assert.equal((await semanticRuntimeQualification(request({caseId:'unknown'}),runtime,f.set,f.pinset)).status,404);assert.equal(f.reads(),0);
 for(const caseId of ['range','wrong-pin','corrupt-range']){const response=await semanticRuntimeQualification(request({caseId}),runtime,f.set,f.pinset);assert.equal(response.status,200);const body=await response.json() as {pass:boolean;reads:number;bytes:number;resultSha256:string};assert.deepEqual(Object.keys(body).sort(),['bytes','caseId','pass','pinset','reads','resultSha256']);assert.equal(body.pass,true);assert.equal(body.reads,3);assert.ok(body.bytes>0);assert.match(body.resultSha256,/^[a-f0-9]{64}$/);}
 const response=await semanticRuntimeQualification(request({caseId:'corrupt-range'}),{...runtime,bucket:{get:async()=>null}},f.set,f.pinset);assert.equal(response.status,503);assert.equal((await response.json() as {pass:boolean}).pass,false);
});
test('bounded R2 counts received bytes, rejects excess reads and cancels excess bodies',async()=>{
 let cancelled=false;const control=new AbortController();const bucket:RangeBucket={get:async()=>({size:10,body:new ReadableStream({start(c){c.enqueue(new Uint8Array(10));},cancel(){cancelled=true;}})})};
 const b=boundedRangeBucket(bucket,{reads:1,bytes:5,signal:control.signal});const o=await b.bucket.get('key');await assert.rejects(new Response(o!.body).arrayBuffer(),/byte-budget/);assert.equal(cancelled,true);assert.deepEqual(b.counters,{reads:1,bytes:10});await assert.rejects(b.bucket.get('key'),/read-budget/);b.close();
});
test('deadline cancels a stalled body and cancels a late object returned by a pending R2 get',async()=>{
 let cancelled=0;const controller=new AbortController();const body=new ReadableStream<Uint8Array>({cancel(){cancelled++;}});
 const b=boundedRangeBucket({get:async()=>({size:1,body})},{reads:2,bytes:2,signal:controller.signal});const object=await b.bucket.get('key');const reading=new Response(object!.body).arrayBuffer();controller.abort();await assert.rejects(reading,/deadline/);await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,1);b.close();
 const lateControl=new AbortController();let complete!:(o:{size:number;body:ReadableStream<Uint8Array>})=>void;
 const late=boundedRangeBucket({get:()=>new Promise(resolve=>complete=resolve)},{reads:1,bytes:1,signal:lateControl.signal});const waiting=late.bucket.get('key');lateControl.abort();await assert.rejects(waiting,/deadline/);complete({size:1,body:new ReadableStream({cancel(){cancelled++;}})});await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,2);late.close();
});
test('bounded R2 close rejects pending work and cancels late bodies without a signal abort',async()=>{
 let cancelled=false;let complete!:(o:{size:number;body:ReadableStream<Uint8Array>})=>void;const b=boundedRangeBucket({get:()=>new Promise(resolve=>complete=resolve)},{reads:1,bytes:1,signal:new AbortController().signal});
 const pending=b.bucket.get('key');b.close();await assert.rejects(pending,/deadline/);complete({size:1,body:new ReadableStream({cancel(){cancelled=true;}})});await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,true);await assert.rejects(b.bucket.get('key'),/deadline/);
});


test('qualification cancels an oversized or aborted request body before storage access',async()=>{
 const f=fixture();const runtime={token,expires,pinset:f.pinset,bucket:f.bucket};let cancelled=false;
 const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(257));},cancel(){cancelled=true;}});
 const req=new Request('https://example.test/api/semantic-runtime-qualification',{method:'POST',headers:{authorization:`Bearer ${token}`},body:stream,duplex:'half'} as RequestInit);
 assert.equal((await semanticRuntimeQualification(req,runtime,f.set,f.pinset)).status,400);assert.equal(cancelled,true);assert.equal(f.reads(),0);
 const controller=new AbortController();cancelled=false;const blocked=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
 const slow=new Request('https://example.test/api/semantic-runtime-qualification',{method:'POST',headers:{authorization:`Bearer ${token}`},body:blocked,duplex:'half',signal:controller.signal} as RequestInit);
 const pending=semanticRuntimeQualification(slow,runtime,f.set,f.pinset);controller.abort();assert.equal((await pending).status,400);assert.equal(cancelled,true);assert.equal(f.reads(),0);
});

test('request cancellation cannot extend the deadline while its underlying cancel promise stalls',async()=>{
 const f=fixture();const signal=new AbortController();let cancelled=false;
 const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;return new Promise<void>(()=>{});}});
 const req=new Request('https://example.test/api/semantic-runtime-qualification',{method:'POST',headers:{authorization:`Bearer ${token}`},body,duplex:'half',signal:signal.signal}as RequestInit);
 const pending=semanticRuntimeQualification(req,{token,expires,pinset:f.pinset,bucket:f.bucket},f.set,f.pinset);signal.abort();
 const response=await pending;assert.equal(response.status,400);assert.equal(cancelled,true);assert.equal(f.reads(),0);
});
