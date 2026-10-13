import { semanticTransferAuthorized } from './semantic-transfer-auth';
import { boundedRangeBucket } from './semantic-v2-bounded-r2';
import { pinnedRangeR2Loader, type RangeBucket, type RangeBlob } from './semantic-v2-range-r2';
import { SemanticV2Reader, type V2Pins } from './semantic-v2-reader';
export type RuntimeQualificationCase =
 | { caseId: string; kind: 'lookup'; word: string; expected: { id: number; word: string } | null }
 | { caseId: string; kind: 'evaluate'; targetId: number; wordId: number; expected: { temperature: number; rank: number; found: boolean } }
 | { caseId: string; kind: 'range'; key: string; bytes: number; sha256: string }
 | { caseId: string; kind: 'wrong-pin'; word: string }
 | { caseId: string; kind: 'corrupt-range'; targetId: number; wordId: number };
export type RuntimeQualificationSet = { schemaVersion: 1; rootReference: RangeBlob; pins: V2Pins; cases: RuntimeQualificationCase[] };
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(v => v.toString(16).padStart(2,'0')).join('');
async function readCase(request: Request, signal: AbortSignal) {
  if (!request.body) throw Error('body');
  const reader = request.body.getReader(); const bytes = new Uint8Array(256); let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) { if (signal.aborted) throw Error('deadline'); const { done, value } = await reader.read(); if (done) break; if (size + value.length > bytes.length) throw Error('body'); bytes.set(value,size); size += value.length; }
    if (signal.aborted) throw Error('deadline');
    const value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size)));
    if (!value || Object.keys(value).length !== 1 || typeof value.caseId !== 'string' || !/^[a-z0-9-]{1,48}$/.test(value.caseId)) throw Error('case');
    return value.caseId as string;
  } finally { signal.removeEventListener('abort',abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
// The route injects ONLY its compiled set. No client-controlled words, paths,
// target IDs, pins, deadlines or budgets cross this interface.
export async function semanticRuntimeQualification(request: Request, runtime: { token?: string; expires?: string; pinset?: string; bucket?: RangeBucket }, set: RuntimeQualificationSet, setSha256: string) {
  if (request.method !== 'POST' || new URL(request.url).search || !/^[a-f0-9]{64}$/.test(setSha256) || runtime.pinset !== setSha256 || !await semanticTransferAuthorized(request,runtime)) return new Response(null,{status:404,headers});
  if (await digest(new TextEncoder().encode(JSON.stringify(set))) !== setSha256 || !runtime.bucket) return new Response(null,{status:503,headers});
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),30000);
  const cancelRequest = () => controller.abort(); request.signal.addEventListener('abort',cancelRequest,{once:true}); if (request.signal.aborted) controller.abort();
  let caseId: string;
  try { caseId = await readCase(request,controller.signal); }
  catch { clearTimeout(timer); controller.abort(); request.signal.removeEventListener('abort',cancelRequest); return new Response(null,{status:400,headers}); }
  const item = set.cases.find(c=>c.caseId===caseId);
  if (!item) { clearTimeout(timer); controller.abort(); request.signal.removeEventListener('abort',cancelRequest); return new Response(null,{status:404,headers}); }
  const network = boundedRangeBucket(runtime.bucket,{reads:16,bytes:8*1024*1024,signal:controller.signal,corruptRange:item.kind==='corrupt-range'});
  try {
    const load = pinnedRangeR2Loader(network.bucket,set.rootReference); const pins = structuredClone(set.pins);
    if (item.kind==='wrong-pin') pins.index.sha256 = pins.index.sha256==='0'.repeat(64)?'1'.repeat(64):'0'.repeat(64);
    const reader = new SemanticV2Reader(pins,load); let result: unknown;
    if (item.kind==='lookup') { result=await reader.lookup(item.word); if (JSON.stringify(result)!==JSON.stringify(item.expected)) throw Error('mismatch'); }
    else if(item.kind==='evaluate') { result=await reader.evaluate(item.targetId,item.wordId); if(JSON.stringify(result)!==JSON.stringify(item.expected)) throw Error('mismatch'); }
    else if(item.kind==='range') { const bytes=await load(item.key,item.bytes);const sha256=await digest(bytes);if(bytes.length!==item.bytes||sha256!==item.sha256)throw Error('mismatch');result={sha256,bytes:bytes.length}; }
    else {
      let expectedFailure=false;
      try { if(item.kind==='wrong-pin') await reader.lookup(item.word); else await reader.evaluate(item.targetId,item.wordId); }
      catch(error) { expectedFailure=error instanceof Error && error.message===(item.kind==='wrong-pin'?'v2-object-integrity':'v2-range-file-integrity'); }
      if(!expectedFailure)throw Error('missing expected integrity refusal'); result={refused:true};
    }
    if(controller.signal.aborted)throw Error('deadline');
    const resultSha256=await digest(new TextEncoder().encode(JSON.stringify(result)));
    return Response.json({caseId,pass:true,pinset:setSha256,resultSha256,...network.counters},{headers});
  } catch { return Response.json({caseId,pass:false,...network.counters},{status:503,headers}); }
  finally { clearTimeout(timer);controller.abort();network.close();request.signal.removeEventListener('abort',cancelRequest); }
}
