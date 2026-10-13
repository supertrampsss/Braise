import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import authorityJson from '../data/editorial-v2-runtime.json';
import { DAILY_V2_QUALIFICATION_PIN } from '../lib/daily-v2-pin';
import { openDailyV2, type DailyV2Authority } from '../lib/daily-v2.server';
import { resolveClassicGame } from '../lib/classic-game.server';
import type { RangeBucket } from '../lib/semantic-v2-range-r2';
import { env } from 'cloudflare:workers';
import { GET, POST } from '../app/api/game/route';
import { dailyV2Ref } from '../lib/daily-v2-contract';
const hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const authority=authorityJson as DailyV2Authority;
const missing:RangeBucket={async get(){return null;}};
function fixture() {
  const a=structuredClone(authority),targetId=a.calendar.assignments[0].targetId,target=a.entries.find(e=>e.targetId===targetId)!;
  const count=65536,raw=Buffer.alloc(64+count*6),contract='a'.repeat(64);raw.write('BSV2');raw.writeUInt16LE(2,4);raw.writeUInt16LE(3,6);raw.writeUInt32LE(targetId,8);raw.writeUInt32LE(0,12);raw.writeUInt32LE(count,16);raw.writeUInt32LE(a.pins.dictionarySize,20);raw.writeUInt32LE(64,24);raw.writeUInt32LE(64+count*2,28);raw.writeUInt32LE(raw.length,32);Buffer.from(a.pins.manifestSha256.slice(0,32),'hex').copy(raw,40);Buffer.from(contract.slice(0,16),'hex').copy(raw,56);
  for(let id=0;id<count;id++)raw.writeUInt32LE(1000,64+count*2+id*4);
  target.hints.forEach((hint,i)=>{assert(hint.id<count);raw.writeInt16LE(1200+i*100,hint.id*2+64);raw.writeUInt32LE(100-i,64+count*2+hint.id*4);});
  const compressed=gzipSync(raw);const valuePages=[];for(let firstId=0;firstId<a.pins.dictionarySize;firstId+=count)valuePages.push({firstId,count:Math.min(count,a.pins.dictionarySize-firstId),file:'value.gz',rawBytes:raw.length,compressedBytes:compressed.length,rawSha256:hash(raw),objectSha256:hash(compressed)});
  const manifest=Buffer.from(JSON.stringify({complete:true,format:'BRT2-pages',corpus:{id:a.pins.corpusId,manifestSha256:a.pins.manifestSha256,semanticSha256:a.pins.semanticSha256,dictionarySize:a.pins.dictionarySize},target:{id:targetId},stats:{dictionarySize:a.pins.dictionarySize},config:{contractHash:contract},valuePages}));
  const prefix=`${a.pins.corpusId}/targets/${String(targetId).padStart(10,'0')}/`,bytes=Buffer.concat([manifest,compressed]);const chunk={sha256:hash(bytes),bytes:bytes.length};
  const shard=Buffer.from(JSON.stringify({schemaVersion:1,format:'BRT2-range-shard',archive:{bytes:bytes.length,chunks:[chunk]},files:[{key:prefix+'manifest.json',offset:0,bytes:manifest.length,sha256:hash(manifest)},{key:prefix+'pages/value.gz',offset:manifest.length,bytes:compressed.length,sha256:hash(compressed)}]}));
  const root=Buffer.from(JSON.stringify({schemaVersion:1,format:'BRT2-range-root',shards:[{prefix,bytes:shard.length,sha256:hash(shard)}]}));
  a.rootReference={bytes:root.length,sha256:hash(root)};a.pins.targets[String(targetId)]={key:prefix+'manifest.json',sha256:hash(manifest)};
  const blobs=new Map([root,shard,bytes].map(b=>[hash(b),b]));let reads=0;
  const bucket:RangeBucket={async get(key,options){reads++;const b=blobs.get(key.split('/').at(-1)!);if(!b)return null;const part=options?b.subarray(options.range.offset,options.range.offset+options.range.length):b;return{size:b.length,range:options?.range,body:new Blob([part]).stream()};}};
  return{authority:a,pin:hash(JSON.stringify(a)),bucket,reads:()=>reads,target};
}
test('qualified future authority preserves V1 boundary and fails closed outside its immutable calendar',async()=>{
  const before=await resolveClassicGame('daily','',undefined,new Date('2027-01-04T22:59:59Z'),{},undefined,'classic-v1');assert.equal(before.publicPuzzle.ref.rulesVersion,'classic-v1');before.close();
  await assert.rejects(resolveClassicGame('daily','',undefined,new Date('2027-01-04T23:00:00Z'),{},undefined,'classic-v2'),/unavailable/);
  for(const date of ['2027-01-05','2028-01-04']) await assert.rejects(openDailyV2(authority,DAILY_V2_QUALIFICATION_PIN,{qualificationPin:DAILY_V2_QUALIFICATION_PIN,bucket:missing},date,'daily',new Date(date+'T12:00:00Z')),/unavailable/);
  for(const [date,context,now] of [['2027-01-05','archive','2027-01-05'],['2028-01-05','daily','2028-01-05'],['2027-01-06','archive','2027-01-05']] as const)await assert.rejects(openDailyV2(authority,DAILY_V2_QUALIFICATION_PIN,{qualificationPin:DAILY_V2_QUALIFICATION_PIN,bucket:missing},date,context,new Date(now+'T12:00:00Z')),/unavailable/);
  const changed=structuredClone(authority);changed.calendar.assignments[0].targetId++;await assert.rejects(openDailyV2(changed,DAILY_V2_QUALIFICATION_PIN,{qualificationPin:DAILY_V2_QUALIFICATION_PIN,bucket:missing},'2027-01-05','daily',new Date('2027-01-05T12:00:00Z')),/unavailable/);
});
test('the future runtime verifies its model but exposes no manually selected hints',async()=>{
  const f=fixture();const service=await openDailyV2(f.authority,f.pin,{qualificationPin:f.pin,bucket:f.bucket},'2027-01-05','daily',new Date('2027-01-05T12:00:00Z'));
  try {assert.equal(Object.hasOwn(service,'hint'),false);assert.equal(f.reads(),4);}finally{service.close();}
});
test('actual GET/POST route returns bounded JSON refusals for unset gate, future date, missing storage and after end',async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2027-01-05T12:00:00Z')});const values=env as unknown as Record<string,unknown>;
  try {delete values.BRAIZ_DAILY_V2_QUALIFICATION_PIN;let response=await GET(new Request('https://braiz.io/api/game?edition=classic-v2'));assert.equal(response.status,503);assert.match(response.headers.get('content-type')!,/json/);
    values.BRAIZ_DAILY_V2_QUALIFICATION_PIN=DAILY_V2_QUALIFICATION_PIN;values.SEMANTIC_DATA=missing;
    response=await GET(new Request('https://braiz.io/api/game?edition=classic-v2'));assert.equal(response.status,503);const puzzle={id:'daily-v2-2027-01-05',ref:dailyV2Ref('2027-01-05','daily')};
    response=await GET(new Request('https://braiz.io/api/game?mode=archive&date=2027-01-06'));assert.equal(response.status,400);
    const post=(extra:Record<string,unknown>)=>POST(new Request('https://braiz.io/api/game?edition=classic-v2',{method:'POST',body:JSON.stringify({mode:'daily',puzzleId:puzzle.id,action:'guess',word:'arbre',...extra})}));
    response=await post({puzzleRef:puzzle.ref});assert.equal(response.status,503);assert.match(response.headers.get('content-type')!,/json/);
    t.mock.timers.setTime(new Date('2028-01-05T12:00:00Z').getTime());assert.equal((await GET(new Request('https://braiz.io/api/game?edition=classic-v2'))).status,503);
  }finally{delete values.BRAIZ_DAILY_V2_QUALIFICATION_PIN;delete values.SEMANTIC_DATA;t.mock.timers.reset();}
});
