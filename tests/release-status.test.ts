import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const parse=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
test('the release matrix preserves each of the 44 literal criteria with existing evidence and explicit remaining gates',()=>{
 const backlog=parse('docs/superpowers/specs/backlog-approved.json') as Array<{id:string;validation:string}>;
 const status=parse('docs/review/implementation-status.json');assert.equal(status.items.length,44);assert.equal(new Set(status.items.map((x:{id:string})=>x.id)).size,44);
 assert.notEqual(status.final44AcceptanceGate,'PASS');assert.equal(status.globalGates.hosted416Cases,'controller_pending');assert.equal(status.globalGates.publicationAndHostedUI,'controller_pending');
 for(const criterion of backlog){const item=status.items.find((x:{id:string})=>x.id===criterion.id);assert.ok(item);assert.equal(item.validation,criterion.validation);assert.ok(item.status.startsWith('source_'));assert.ok(item.limitations.length);assert.ok(item.files.length);assert.ok(item.proofs.length);
  for(const path of [...item.files,...item.proofs]){assert.doesNotMatch(path,/^\.superpowers\//);assert.doesNotMatch(path,/^work\//,'matrix evidence must survive scratch cleanup');assert.ok(readFileSync(path).length,path);}
 }
 assert.ok(status.items.find((x:{id:string})=>x.id==='D26').limitations.join(' ').includes('Lecteur d’écran natif'));
 assert.ok(status.items.find((x:{id:string})=>x.id==='A10').limitations.join(' ').includes('non exécutées'));
});
test('durable reports and receipts exactly match their declared archive hashes and original path provenance',()=>{
 const archive=parse('docs/review/qualification-2026-10-13/manifest.json');assert.ok(Date.parse(archive.priorReportCutoff));assert.ok(archive.entries.length>40);
 for(const entry of archive.entries){assert.ok(entry.originalPath);assert.ok(entry.archivedPath.startsWith('docs/review/qualification-2026-10-13/'));const bytes=readFileSync(entry.archivedPath);assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.originalPath);assert.ok(Date.parse(entry.capturedAt));}
});
test('nuage conservative high annotation is documented without silently rewriting its genuine historical reason',()=>{
 const selection=parse('data/editorial-v2-selection.json');const matches:Array<{ambiguity:string;reason:string}>=[];
 const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}const row=value as Record<string,unknown>;if(row.targetId===9455&&row.ambiguity==='high'&&typeof row.reason==='string')matches.push(row as {ambiguity:string;reason:string});Object.values(row).forEach(walk);};walk(selection);
 assert.equal(matches.length,1);assert.match(matches[0].reason,/ambiguïté moyenne/);
 const audit=readFileSync('docs/review/qualification-2026-10-13/editorial-conservative-ambiguity-note.md','utf8');assert.ok(audit.includes(matches[0].reason));assert.match(audit,/l’autorité conservatrice retenue/);assert.match(audit,/inchangés/);
});
