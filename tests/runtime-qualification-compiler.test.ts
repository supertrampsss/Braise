import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeQualification } from '../scripts/build-runtime-qualification-v2.mjs';

function fixture() {
  const corpus = { id: 'test-corpus', manifestSha256: 'a'.repeat(64), semanticSha256: 'b'.repeat(64), dictionarySize: 100 };
  const targets = { '0': { key: 'test/0/manifest.json', sha256: 'c'.repeat(64) }, '1': { key: 'test/1/manifest.json', sha256: 'd'.repeat(64) } };
  const pins = { corpusId: corpus.id, manifestSha256: corpus.manifestSha256, semanticSha256: corpus.semanticSha256, dictionarySize: 100, index: { key: 'test/index.json', sha256: 'e'.repeat(64) }, targets };
  const entries = [0, 1].map(targetId => ({ targetId, word: `target${targetId}`, approval: 'approved-agent', hints: { words: ['alpha', 'beta', 'gamma'] }, neighborhood: { evidenceSha256: String(targetId + 1).repeat(64), targetManifestSha256: targets[String(targetId) as '0' | '1'].sha256 }, approvalReview: { evidenceSha256: String(targetId + 1).repeat(64) } }));
  const evidence = new Map(entries.map(entry => [entry.targetId, { sha256: entry.neighborhood.evidenceSha256, payload: { corpus, target: { id: entry.targetId, word: entry.word }, targetManifest: { sha256: entry.neighborhood.targetManifestSha256 }, neighborhood: { entries: ['alpha', 'beta', 'gamma'].map((word, i) => ({ id: i + 2, word, score: entry.targetId === 0 ? -1234 + i : 10000, rank: 4 - i })) } } }]));
  const pack = { pins, rootReference: { sha256: 'f'.repeat(64), bytes: 1000 }, targetPacks: entries.map(entry => ({ targetId: entry.targetId, bytes: 1024, targetManifestSha256: entry.neighborhood.targetManifestSha256 })) };
  const baseline = { schemaVersion: 1, pins: structuredClone(pins), cases: Array.from({ length: 10 }, (_, i) => ({ caseId: `baseline-${i}`, kind: 'lookup', word: 'alpha', expected: null })) };
  return { catalogue: { status: 'inactive-editorial-workbench', corpus, entries, counts: { approved: 2 } }, pack, evidence, baseline };
}
test('compiler covers each approved identity with BEE score/rank and preserves the baseline', () => {
  const input = fixture(); const original = structuredClone(input.baseline);
  const { set, provenance } = compileRuntimeQualification(input);
  assert.equal(set.cases.length, 12); assert.deepEqual(set.cases.slice(0, 10), original.cases);
  assert.deepEqual(set.cases[10], { caseId: 'editorial-'+createHash('sha256').update('runtime-case:'+'1'.repeat(64)).digest('hex').slice(0,20), kind: 'evaluate', targetId: 0, wordId: 2, expected: { temperature: -12.34, rank: 4, found: false } });
  assert.deepEqual(set.cases[11].expected, { temperature: 99.9, rank: 4, found: false });
  assert.equal(provenance[0].quantizedScore, -1234); assert.deepEqual(input.baseline, original);
});
test('compiler rejects missing or duplicated identities and inconsistent counts', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.evidence.delete(1); },
    (f: ReturnType<typeof fixture>) => { f.catalogue.entries.push(f.catalogue.entries[0]); },
    (f: ReturnType<typeof fixture>) => { f.catalogue.counts.approved = 1; },
    (f: ReturnType<typeof fixture>) => { f.pack.targetPacks[1].targetId = 0; },
  ]) { const f = fixture(); mutate(f); assert.throws(() => compileRuntimeQualification(f), /mismatch/); }
});
test('compiler refuses changed evidence, archive pin, baseline pin and absent approved hints', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.evidence.get(0)!.sha256 = '9'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.pack.targetPacks[0].targetManifestSha256 = '9'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.baseline.pins.targets['0'].sha256 = '9'.repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.catalogue.entries[0].hints.words[0] = 'absent'; },
    (f: ReturnType<typeof fixture>) => { f.evidence.get(0)!.payload.neighborhood.entries[0].rank = 101; },
  ]) { const f = fixture(); mutate(f); assert.throws(() => compileRuntimeQualification(f), /mismatch/); }
});
test('compiler enforces root, target-package and case namespace bounds', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.pack.rootReference.bytes = 256 * 1024 + 1; },
    (f: ReturnType<typeof fixture>) => { f.pack.targetPacks[0].bytes = 8 * 1024 * 1024; },
    (f: ReturnType<typeof fixture>) => { f.baseline.cases[0].caseId = 'editorial-'+createHash('sha256').update('runtime-case:'+'1'.repeat(64)).digest('hex').slice(0,20); },
    (f: ReturnType<typeof fixture>) => { f.baseline.cases[0].caseId = '../arbitrary'; },
  ]) { const f = fixture(); mutate(f); assert.throws(() => compileRuntimeQualification(f), /mismatch/); }
});
