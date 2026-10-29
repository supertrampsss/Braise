import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalDirectoryWithoutLinks } from '../scripts/semantic-paths.mjs';
import { buildSemanticCorpus } from '../scripts/build-semantic-corpus-v2.mjs';
import { buildSemanticTarget } from '../scripts/build-semantic-target-v2.mjs';
import { evictSemanticTarget } from '../scripts/evict-semantic-target-v2.mjs';
import { gunzipSync } from 'node:zlib';
import { canonicalGzip } from '../scripts/canonical-gzip.mjs';
import { loadActiveCorpus, sha256, stableJson } from '../scripts/semantic-target-v2-common.mjs';
import { captureEditorialEvidence } from '../scripts/editorial-evidence-v2.mjs';
import { checkRuntimeArchive } from '../scripts/semantic-runtime-archive.mjs';
import { qualifySemanticBatch, parseBatchArgs } from '../scripts/qualify-semantic-batch-v2.mjs';

// Retry transient Windows deletion errors in fixtures only; persistent cleanup errors still fail.
const temporaryCleanup = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'braise-batch-'));
  const source = join(root, 'source.vec'), corpusDir = join(root, 'c'), targetsDir = join(root, 't'), archiveDir = join(root, 'a'), evidenceDir = join(root, 'e'), checkpointDir = join(root, 'p');
  await writeFile(source, '6 2\nalpha 1 0\nbêta 1 0\ngamma 0 1\ndelta 0 -1\nepsilon -1 0\nomega 1 1');
  await buildSemanticCorpus({ sourcePath: source, outputDir: corpusDir, segmentEntries: 2 });
  const corpus = await loadActiveCorpus(corpusDir);
  return { root, corpusDir, targetsDir, archiveDir, evidenceDir, checkpointDir, corpus, onProgress: () => {} };
}

test('canonical directories accept actual Windows spelling but reject ancestor junctions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'braise-path-'));
  try {
    await mkdir(join(root, 'actual', 'child'), { recursive: true });
    assert.equal(await canonicalDirectoryWithoutLinks(join(root, 'actual', 'child')), await realpath(join(root, 'actual', 'child')));
    if (process.platform === 'win32') assert.equal((await canonicalDirectoryWithoutLinks(join(root, 'ACTUAL', 'CHILD'))).toLowerCase(), (await realpath(join(root, 'actual', 'child'))).toLowerCase());
    await symlink(join(root, 'actual'), join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(canonicalDirectoryWithoutLinks(join(root, 'alias', 'child')), /symbolic links/);
  } finally { await rm(root, temporaryCleanup); }
});

test('bounded batches preserve every canonical page and evidence before eviction; restart revalidates', async () => {
  const f = await fixture();
  try {
    assert.equal((await qualifySemanticBatch({ ...f, targetIds: [0, 1, 2] })).completed, 3);
    for (const targetId of [0, 1, 2]) {
      const archive = await checkRuntimeArchive({ ...f, targetId });
      assert.equal(archive.objects.filter((o: { path: string }) => o.path.startsWith('pages/')).length, 2);
      assert.ok(archive.objects.some((o: { path: string }) => o.path === 'active.json'));
      assert.ok(archive.objects.every((o: { path: string }) => !/sqlite|scores\.tmp|lock/.test(o.path)));
      await assert.rejects(readFile(join(f.targetsDir, f.corpus.manifest.corpusId, 'targets', String(targetId).padStart(10, '0'), 'active.json')), /ENOENT/);
    }
    const before = await readFile(join(f.checkpointDir, '0000000000.json'));
    assert.equal((await qualifySemanticBatch({ ...f, targetIds: [0, 1, 2] })).completed, 3);
    assert.deepEqual(await readFile(join(f.checkpointDir, '0000000000.json')), before);
    const archive = await checkRuntimeArchive({ ...f, targetId: 0 });
    await writeFile(join(archive.root, archive.objects.find((o: { path: string }) => o.path.startsWith('pages/')).path), 'corrupt');
    await assert.rejects(qualifySemanticBatch({ ...f, targetIds: [0] }), /archive object mismatch/);
  } finally { await rm(f.root, temporaryCleanup); }
});

test('archive failure and callback corruption never delete the independently verified target', async () => {
  const f = await fixture();
  try {
    await buildSemanticTarget({ corpusDir: f.corpusDir, outputDir: f.targetsDir, targetId: 0 });
    const dir = join(f.targetsDir, f.corpus.manifest.corpusId, 'targets', '0000000000');
    const activeBytes = await readFile(join(dir, 'active.json')); const active = JSON.parse(activeBytes.toString());
    const manifest = JSON.parse(await readFile(join(dir, active.manifest), 'utf8'));
    await mkdir(f.archiveDir); await writeFile(join(f.archiveDir, f.corpus.manifest.corpusId), 'blocked');
    await assert.rejects(captureEditorialEvidence({ ...f, targetId: 0, evictAfterArchive: true }), /EEXIST|ENOTDIR/);
    assert.deepEqual(await readFile(join(dir, 'active.json')), activeBytes);
    const pagePath = join(dir, 'pages', manifest.valuePages[0].file); const bytes = await readFile(pagePath);
    await assert.rejects(evictSemanticTarget({ corpusDir: f.corpusDir, outputDir: f.targetsDir, targetId: 0, beforeEviction: async () => { await writeFile(pagePath, 'corrupt'); return { verified: true }; } }), /changed before eviction/);
    assert.deepEqual(await readFile(join(dir, 'active.json')), activeBytes);
    await writeFile(pagePath, bytes);
    await assert.rejects(evictSemanticTarget({ corpusDir: f.corpusDir, outputDir: f.targetsDir, targetId: 0, beforeEviction: async () => { throw new Error('archive interrupted'); } }), /archive interrupted/);
    assert.deepEqual(await readFile(join(dir, 'active.json')), activeBytes);
    assert.ok((await readdir(dir)).includes('active.json'));
  } finally { await rm(f.root, temporaryCleanup); }
});

test('batch CLI rejects ambiguous arguments and does not expose quota overrides', () => {
  assert.throws(() => parseBatchArgs(['--max-cached-targets', '64']), /Invalid/);
  assert.throws(() => parseBatchArgs(['--corpus', 'one', '--corpus', 'two']), /Invalid/);
});

test('runtime archive remains immutable across a later failed capture and rejects staging destinations', async () => {
  const f = await fixture();
  try {
    await qualifySemanticBatch({ ...f, targetIds: [0] });
    const previous = await checkRuntimeArchive({ ...f, targetId: 0 });
    const inventoryBytes = await readFile(join(previous.root, `inventory-${previous.inventorySha256}.json`));
    await buildSemanticTarget({ corpusDir: f.corpusDir, outputDir: f.targetsDir, targetId: 1 });
    await writeFile(join(f.archiveDir, f.corpus.manifest.corpusId, 'targets', '0000000001'), 'blocked');
    await assert.rejects(captureEditorialEvidence({ ...f, targetId: 1, evictAfterArchive: true }), /EEXIST|ENOTDIR/);
    assert.deepEqual(await readFile(join(previous.root, `inventory-${previous.inventorySha256}.json`)), inventoryBytes);
    assert.equal((await checkRuntimeArchive({ ...f, targetId: 0 })).inventorySha256, previous.inventorySha256);
    await assert.rejects(captureEditorialEvidence({ ...f, archiveDir: join(f.targetsDir, f.corpus.manifest.corpusId, 'targets', 'archive'), targetId: 1, evictAfterArchive: true }), /separate from target staging/);
    await assert.rejects(qualifySemanticBatch({ ...f, checkpointDir: join(f.targetsDir, f.corpus.manifest.corpusId, 'targets', 'checkpoints'), targetIds: [1] }), /outside target staging/);
  } finally { await rm(f.root, temporaryCleanup); }
});

test('full-entropy short verifier SQLite filename supports the reproduced 261-character path', async () => {
  const f = await fixture();
  try {
    const tail = join(f.corpus.manifest.corpusId, 'targets', '0000000000', '.verify-target-00000000-0000-0000-0000-000000000000.sqlite');
    const prefixLength = 261 - tail.length - 1;
    const outputDir = join(f.root, 'p'.repeat(prefixLength - f.root.length - 1));
    assert.equal(join(outputDir, tail).length, 261);
    await buildSemanticTarget({ corpusDir: f.corpusDir, outputDir, targetId: 0 });
    assert.equal((await evictSemanticTarget({ corpusDir: f.corpusDir, outputDir, targetId: 0 })).evicted, true);
  } finally { await rm(f.root, temporaryCleanup); }
});

test('self-consistent forged archive hashes and checkpoint never replace independent numerical verification', async () => {
  const f = await fixture();
  try {
    await qualifySemanticBatch({ ...f, targetIds: [0] });
    const archive = await checkRuntimeArchive({ ...f, targetId: 0 });
    const active = JSON.parse(await readFile(join(archive.root, 'active.json'), 'utf8'));
    const oldManifest = active.manifest;
    const manifest = JSON.parse(await readFile(join(archive.root, oldManifest), 'utf8'));
    const page = manifest.valuePages[0]; const oldPage = page.file;
    const raw = gunzipSync(await readFile(join(archive.root, 'pages', oldPage)));
    raw.writeInt16LE(raw.readInt16LE(66) - 1, 66);
    const compressed = canonicalGzip(raw); page.rawSha256 = sha256(raw); page.objectSha256 = sha256(compressed); page.compressedBytes = compressed.length;
    page.file = oldPage.replace(/[a-f0-9]{16}\.brt\.gz$/, `${page.objectSha256.slice(0, 16)}.brt.gz`);
    await writeFile(join(archive.root, 'pages', page.file), compressed);
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    active.manifestSha256 = sha256(manifestBytes); active.manifest = `manifest-${manifest.configHash.slice(0, 16)}-${active.manifestSha256.slice(0, 16)}.json`;
    await writeFile(join(archive.root, active.manifest), manifestBytes);
    await writeFile(join(archive.root, 'active.json'), `${JSON.stringify(active, null, 2)}\n`);
    const evidence = JSON.parse(await readFile(join(archive.root, 'evidence.json'), 'utf8'));
    evidence.targetManifest = { sha256: active.manifestSha256, utf8: manifestBytes.toString() };
    await writeFile(join(archive.root, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    const inventory = JSON.parse(await readFile(join(archive.root, `inventory-${archive.inventorySha256}.json`), 'utf8'));
    inventory.targetManifestSha256 = active.manifestSha256; inventory.evidenceSha256 = sha256(Buffer.from(stableJson(evidence)));
    for (const object of inventory.objects) {
      if (object.path === oldManifest) object.path = active.manifest;
      if (object.path === `pages/${oldPage}`) object.path = `pages/${page.file}`;
      const bytes = await readFile(join(archive.root, object.path)); object.bytes = bytes.length; object.sha256 = sha256(bytes);
    }
    const inventoryBytes = Buffer.from(`${JSON.stringify(inventory, null, 2)}\n`); const inventorySha256 = sha256(inventoryBytes);
    await writeFile(join(archive.root, `inventory-${inventorySha256}.json`), inventoryBytes);
    await writeFile(join(archive.root, 'archive.json'), JSON.stringify({ file: `inventory-${inventorySha256}.json`, sha256: inventorySha256 }));
    const checkpoint = JSON.parse(await readFile(join(f.checkpointDir, '0000000000.json'), 'utf8'));
    Object.assign(checkpoint, { inventorySha256, targetManifestSha256: active.manifestSha256, evidenceSha256: inventory.evidenceSha256 });
    await writeFile(join(f.checkpointDir, '0000000000.json'), JSON.stringify(checkpoint));
    assert.equal((await checkRuntimeArchive({ ...f, targetId: 0 })).inventorySha256, inventorySha256);
    await assert.rejects(qualifySemanticBatch({ ...f, targetIds: [0] }), /Target score mismatch/);
  } finally { await rm(f.root, temporaryCleanup); }
});
