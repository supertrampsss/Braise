import { mkdir, readFile, lstat } from 'node:fs/promises';
import { basename, join, resolve, relative, sep, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { buildSemanticTargets } from './build-semantic-target-v2.mjs';
import { captureEditorialEvidenceBatch, verifyEditorialEvidence } from './editorial-evidence-v2.mjs';
import { evictSemanticTarget } from './evict-semantic-target-v2.mjs';
import { checkRuntimeArchive } from './semantic-runtime-archive.mjs';
import { verifySemanticTarget } from './verify-semantic-target-v2.mjs';
import { canonicalDirectoryWithoutLinks } from './semantic-paths.mjs';
import { acquireTargetCacheGuard, releaseTargetCacheGuard, loadActiveCorpus, installImmutable, sha256 } from './semantic-target-v2-common.mjs';

async function exists(path) { try { const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe batch pointer'); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } }

/** Bounded groups of eight, default-quota staging; archives never grant editorial approval. */
export async function qualifySemanticBatch({ corpusDir, targetsDir, evidenceDir, archiveDir, checkpointDir, targetIds, onProgress = result => console.log(JSON.stringify(result)) }) {
  if (!Array.isArray(targetIds) || targetIds.length < 1 || targetIds.length > 400 || new Set(targetIds).size !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0 || id > 0xffffffff)) throw new Error('Supply 1–400 distinct unsigned target IDs');
  targetIds = [...targetIds];
  const corpus = await loadActiveCorpus(resolve(corpusDir));
  if (targetIds.some(id => id >= corpus.manifest.stats.accepted)) throw new Error('Batch target is outside the corpus');
  await mkdir(checkpointDir, { recursive: true });
  const checkpointRoot = await canonicalDirectoryWithoutLinks(checkpointDir);
  const stagingRoot = join(resolve(targetsDir), corpus.manifest.corpusId, 'targets');
  await mkdir(stagingRoot, { recursive: true });
  const canonicalStaging = await canonicalDirectoryWithoutLinks(stagingRoot);
  const relativeCheckpoint = relative(canonicalStaging, checkpointRoot);
  if (!relativeCheckpoint || !relativeCheckpoint.startsWith(`..${sep}`) && relativeCheckpoint !== '..' && !isAbsolute(relativeCheckpoint)) throw new Error('Batch checkpoints must be outside target staging');
  const batchGuard = acquireTargetCacheGuard(resolve(checkpointDir), 'exclusive');
  const results = [];
  try {
    for (let offset = 0; offset < targetIds.length; offset += 8) {
      const group = targetIds.slice(offset, offset + 8); const pending = []; const buildIds = [];
      const groupResults = new Map();
      for (const targetId of group) {
        const started = performance.now(); const name = String(targetId).padStart(10, '0');
        const receiptPath = join(checkpointDir, `${name}.json`);
        const active = await exists(join(targetsDir, corpus.manifest.corpusId, 'targets', name, 'active.json'));
        const archivedPointer = await exists(join(archiveDir, corpus.manifest.corpusId, 'targets', name, 'archive.json'));
        const completed = await exists(receiptPath);
        if (!active && archivedPointer) {
          // Restart always recomputes both runtime and editorial numerical proofs;
          // neither a persisted receipt nor an archive hash is an attestation.
          const archived = await checkRuntimeArchive({ archiveDir, corpus, targetId });
          const verified = await verifySemanticTarget({ corpusDir, outputDir: archiveDir, targetId });
          await verifyEditorialEvidence({ corpusDir, evidenceDir, targetId, expectedSha256: archived.evidenceSha256 });
          if (verified.manifestSha256 !== archived.targetManifestSha256) throw new Error('Archived numerical verification identity mismatch');
          const result = { targetId, corpusId: corpus.manifest.corpusId, corpusManifestSha256: corpus.manifestSha256, evidenceSha256: archived.evidenceSha256, targetManifestSha256: archived.targetManifestSha256, inventorySha256: archived.inventorySha256 };
          if (completed) {
            const previous = JSON.parse(await readFile(receiptPath, 'utf8'));
            if (JSON.stringify(previous) !== JSON.stringify(result)) throw new Error('Batch checkpoint differs from the independently verified archive');
          }
          await evictSemanticTarget({ corpusDir, outputDir: targetsDir, targetId });
          await installImmutable(receiptPath, `${JSON.stringify(result)}\n`);
          groupResults.set(targetId, result);
          onProgress({ targetId, phase: 'resumed-independent-verification', elapsedMs: Math.round(performance.now() - started) });
        } else {
          if (completed) throw new Error('Completed batch checkpoint has a live or missing archive; inspect instead of overwriting');
          pending.push(targetId); if (!active) buildIds.push(targetId);
        }
      }
      if (buildIds.length) {
        const started = performance.now();
        const built = await buildSemanticTargets({ corpusDir, outputDir: targetsDir, targetIds: buildIds });
        onProgress({ phase: 'group-built-independently-verified', targetIds: buildIds, preparationMs: built.preparationMs, preparation: built.preparation, finalizations: built.finalizations, verificationMs: built.verificationMs, elapsedMs: Math.round(performance.now() - started) });
      }
      if (pending.length) {
        const started = performance.now();
        const captured = await captureEditorialEvidenceBatch({ corpusDir, targetsDir, evidenceDir, archiveDir, targetIds: pending });
        onProgress({ phase: 'group-runtime-and-editorial-verified-archived-evicted', targetIds: pending, verificationMs: captured.verificationMs, evidenceVerificationMs: captured.evidenceVerificationMs, archiveMs: captured.archiveMs, evictionMs: captured.evictionMs, elapsedMs: Math.round(performance.now() - started) });
        for (const capture of captured.results) {
          const targetId = capture.targetId;
          const result = { targetId, corpusId: corpus.manifest.corpusId, corpusManifestSha256: corpus.manifestSha256, evidenceSha256: capture.evidenceSha256, targetManifestSha256: capture.runtimeArchive.targetManifestSha256, inventorySha256: capture.runtimeArchive.inventorySha256 };
          // Install only after the complete archive group and official eviction.
          await installImmutable(join(checkpointDir, `${String(targetId).padStart(10, '0')}.json`), `${JSON.stringify(result)}\n`);
          groupResults.set(targetId, result);
          onProgress({ ...result, phase: 'archived-and-evicted', archiveMs: capture.archiveMs });
        }
      }
      results.push(...group.map(id => groupResults.get(id)));
    }
    return { corpusId: corpus.manifest.corpusId, completed: results.length, identitiesSha256: sha256(JSON.stringify(results)) };
  } finally { releaseTargetCacheGuard(batchGuard); }
}

export function parseBatchArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--corpus', '--targets', '--evidence', '--archive', '--checkpoints', '--target-ids'].includes(argv[i]) || !argv[i + 1] || Object.hasOwn(values, argv[i])) throw new Error('Invalid batch arguments');
    values[argv[i]] = argv[i + 1];
  }
  if (Object.keys(values).length !== 6 || !/^\d+(,\d+)*$/.test(values['--target-ids'])) throw new Error('Required: --corpus DIR --targets DIR --evidence DIR --archive DIR --checkpoints DIR --target-ids ID,ID');
  return { corpusDir: values['--corpus'], targetsDir: values['--targets'], evidenceDir: values['--evidence'], archiveDir: values['--archive'], checkpointDir: values['--checkpoints'], targetIds: values['--target-ids'].split(',').map(Number) };
}
if (process.argv[1] && basename(process.argv[1]) === 'qualify-semantic-batch-v2.mjs' && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) qualifySemanticBatch(parseBatchArgs(process.argv.slice(2))).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
