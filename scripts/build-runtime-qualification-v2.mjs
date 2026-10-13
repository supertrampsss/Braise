import { readFile, writeFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { loadActiveCorpus, sha256, stableJson } from './semantic-target-v2-common.mjs';
import { loadEditorialEvidence } from './editorial-evidence-v2.mjs';

const HASH = /^[a-f0-9]{64}$/;
const MAX_TARGETS = 768; // Presence shards plus target shards must fit the existing root budget.
const fail = () => { throw new Error('Qualification catalogue/evidence/pack mismatch'); };

// This compiler never calculates expected scores with the production reader.
// Payloads come from the official content-addressed BEE loader in the entry point.
// It constructs test cases, not a numerical verification receipt or activation.
export function compileRuntimeQualification({ catalogue, pack, baseline, evidence }) {
  if (!catalogue || !['ready', 'inactive-editorial-workbench'].includes(catalogue.status) ||
      !Array.isArray(catalogue.entries) || catalogue.entries.length > 2048 ||
      !pack?.pins || !Array.isArray(pack.targetPacks) || !Array.isArray(baseline?.cases) ||
      baseline.cases.length !== 10 || baseline.schemaVersion !== 1) fail();
  const approved = catalogue.entries.filter(entry => ['approved-agent', 'approved-human'].includes(entry.approval));
  const ids = approved.map(entry => entry.targetId);
  if (!ids.length || ids.length > MAX_TARGETS || new Set(ids).size !== ids.length ||
      catalogue.counts.approved !== ids.length || Object.keys(pack.pins.targets).length !== ids.length ||
      pack.targetPacks.length !== ids.length || new Set(pack.targetPacks.map(p => p.targetId)).size !== ids.length ||
      !pack.rootReference || !HASH.test(pack.rootReference.sha256) || !Number.isSafeInteger(pack.rootReference.bytes) || pack.rootReference.bytes < 1 || pack.rootReference.bytes > 256 * 1024 ||
      catalogue.corpus.id !== pack.pins.corpusId || catalogue.corpus.manifestSha256 !== pack.pins.manifestSha256 || catalogue.corpus.semanticSha256 !== pack.pins.semanticSha256 || catalogue.corpus.dictionarySize !== pack.pins.dictionarySize ||
      baseline.pins.corpusId !== pack.pins.corpusId || baseline.pins.manifestSha256 !== pack.pins.manifestSha256 || baseline.pins.semanticSha256 !== pack.pins.semanticSha256 || baseline.pins.index.sha256 !== pack.pins.index.sha256) fail();
  const cases = structuredClone(baseline.cases);
  for (const [id, ref] of Object.entries(baseline.pins.targets)) {
    if (pack.pins.targets[id]?.key !== ref.key || pack.pins.targets[id]?.sha256 !== ref.sha256) fail();
  }
  const provenance = [];
  for (const entry of approved) {
    const proof = evidence.get(entry.targetId);
    const ref = pack.pins.targets[String(entry.targetId)];
    const targetPack = pack.targetPacks.find(p => p.targetId === entry.targetId);
    if (!Number.isSafeInteger(entry.targetId) || entry.targetId < 0 || entry.targetId >= pack.pins.dictionarySize ||
        !proof || !HASH.test(proof.sha256) || proof.sha256 !== entry.neighborhood?.evidenceSha256 || proof.sha256 !== entry.approvalReview?.evidenceSha256 ||
        proof.payload?.target.id !== entry.targetId || proof.payload.target.word !== entry.word ||
        proof.payload.corpus.manifestSha256 !== pack.pins.manifestSha256 || proof.payload.corpus.semanticSha256 !== pack.pins.semanticSha256 ||
        ref?.sha256 !== proof.payload.targetManifest.sha256 || ref.sha256 !== entry.neighborhood.targetManifestSha256 || targetPack?.targetManifestSha256 !== ref.sha256 ||
        !Number.isSafeInteger(targetPack.bytes) || targetPack.bytes < 1 || targetPack.bytes >= 8 * 1024 * 1024 ||
        !Array.isArray(entry.hints?.words) || entry.hints.words.length !== 3 || new Set(entry.hints.words).size !== 3) fail();
    const hints = entry.hints.words.map(word => proof.payload.neighborhood.entries.find(n => n.word === word));
    if (hints.some(hint => !hint || !Number.isSafeInteger(hint.id) || hint.id < 0 || hint.id >= pack.pins.dictionarySize || hint.id === entry.targetId || !Number.isInteger(hint.score) || hint.score < -10000 || hint.score > 10000 || !Number.isInteger(hint.rank) || hint.rank < 1 || hint.rank > pack.pins.dictionarySize)) fail();
    const hint = hints[0];
    const caseId = `editorial-${sha256(Buffer.from(`runtime-case:${proof.sha256}`)).slice(0,20)}`;
    cases.push({ caseId, kind: 'evaluate', targetId: entry.targetId, wordId: hint.id, expected: { temperature: Math.min(hint.score / 100, 99.9), rank: hint.rank, found: false } });
    provenance.push({ caseId, targetId: entry.targetId, wordId: hint.id, quantizedScore: hint.score, rank: hint.rank, evidenceSha256: proof.sha256, targetManifestSha256: ref.sha256 });
  }
  if (new Set(cases.map(item => item.caseId)).size !== cases.length || cases.some(item => !/^[a-z0-9-]{1,48}$/.test(item.caseId) || ['evaluate', 'corrupt-range'].includes(item.kind) && !pack.pins.targets[String(item.targetId)])) fail();
  return { set: { schemaVersion: 1, rootReference: pack.rootReference, pins: pack.pins, cases }, provenance };
}

async function json(path, maximum) {
  if ((await stat(path)).size > maximum) throw new Error('Qualification input exceeds bound');
  const bytes = await readFile(path);
  if (bytes.length > maximum) throw new Error('Qualification input exceeds bound');
  return JSON.parse(bytes);
}
export async function buildRuntimeQualification(options) {
  const catalogue = await json(options.cataloguePath, 16 * 1024 * 1024);
  if (sha256(Buffer.from(stableJson(catalogue))) !== options.catalogueSha256 || catalogue.counts?.approved < 400) fail();
  const pack = await json(options.packPath, 2 * 1024 * 1024);
  const baseline = await json(options.baselinePath, 256 * 1024);
  if (sha256(Buffer.from(JSON.stringify(baseline))) !== options.baselineSha256) fail();
  const corpus = await loadActiveCorpus(options.corpusDir);
  if (corpus.manifestSha256 !== catalogue.corpus.manifestSha256) fail();
  const evidence = new Map();
  for (const entry of catalogue.entries.filter(entry => ['approved-agent', 'approved-human'].includes(entry.approval))) {
    const loaded = await loadEditorialEvidence({ corpus, evidenceDir: options.evidenceDir, targetId: entry.targetId, expectedSha256: entry.neighborhood.evidenceSha256 });
    const { target, corpus: identity, neighborhood } = loaded.payload;
    evidence.set(entry.targetId, { sha256: loaded.sha256, payload: { target, corpus: identity, neighborhood, targetManifest: { sha256: loaded.payload.targetManifest.sha256 } } });
  }
  const { set, provenance } = compileRuntimeQualification({ catalogue, pack, baseline, evidence });
  const pinset = sha256(Buffer.from(JSON.stringify(set)));
  await writeFile(options.outputSetPath, JSON.stringify(set, null, 2) + '\n');
  await writeFile(options.outputPinPath, `// Server-only compiled qualification authority; disabled without exact temporary capability.\nexport const RUNTIME_QUALIFICATION_PIN = '${pinset}';\n`);
  const audit = { schemaVersion: 1, scope: 'BEE-derived expected values, not hosted execution or numerical attestation', catalogueSha256: options.catalogueSha256, baselineSha256: options.baselineSha256, pinset, rootReference: pack.rootReference, approvedTargets: provenance.length, cases: set.cases.length, provenance };
  await writeFile(options.auditPath, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
  return audit;
}
if (process.argv[1] && basename(process.argv[1]) === 'build-runtime-qualification-v2.mjs') {
  buildRuntimeQualification(await json(process.argv[2], 65536)).then(({ pinset, cases, approvedTargets }) => console.log(JSON.stringify({ pinset, cases, approvedTargets }))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
