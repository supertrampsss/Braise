import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

// First prepare the pinned reader with: node scripts/capture-v1-fixtures.mjs
const baseline = JSON.parse(await readFile('docs/program/BASELINE.json', 'utf8'));
await stat('work/v1-reference/semantic.ts');
await writeFile('work/v1-reference/measure-candidate-entry.ts', `export * from '../../lib/semantic'; export { setSemanticObjectLoaderForTests } from '../../lib/semantic-storage';\n`);
const results = {};
for (const [name, entry, alias] of [
  ['baseline', 'work/v1-reference/semantic.ts', { '@/data/semantic-fr.json': './work/v1-reference/data/semantic-fr.json' }],
  ['candidate', 'work/v1-reference/measure-candidate-entry.ts', { 'cloudflare:workers': './tests/support/cloudflare-workers.ts' }],
]) {
  const outfile = 'work/v1-reference/measure-' + name + '.mjs';
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', alias, logLevel: 'warning' });
  const script = `
    global.gc();
    const before = process.memoryUsage();
    const start = performance.now();
    const game = await import(${JSON.stringify(pathToFileURL(resolve(outfile)).href)});
    const importMs = performance.now() - start;
    if (game.setSemanticObjectLoaderForTests) {
      const { readFile } = await import('node:fs/promises');
      game.setSemanticObjectLoaderForTests(async key => {
        try { const value = await readFile('public/' + key); return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
        catch { return null; }
      });
    }
    global.gc();
    const afterImport = process.memoryUsage();
    const scenario = performance.now();
    for (let target = 0; target < 120; target++) {
      await game.evaluateWord(target, game.findWord('justice'));
      await game.nextHint(target, 0, ['justice', 'musique', 'sport', 'livre', 'enfant']);
      game.getPuzzle('daily', '', new Date(Date.UTC(2026, 8, 7 + target, 12)));
    }
    const scenarioMs = performance.now() - scenario;
    global.gc();
    console.log(JSON.stringify({ runtime: process.version, platform: process.platform, before, afterImport, afterScenario: process.memoryUsage(), maxRssKiB: process.resourceUsage().maxRSS, importMs, scenarioMs }));
  `;
  results[name] = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', script], { encoding: 'utf8' }));
}
const sourceFiles = ['lib/semantic.ts', 'lib/semantic-storage.ts', 'lib/calendar.ts', 'lib/legacy-puzzles.ts', 'lib/game-contracts.ts', 'data/legacy-v1.json', 'data/semantic-v1-index.json'];
const fingerprints = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const corpus = await readFile('data/semantic-fr.json');
const report = {
  measuredAt: new Date().toISOString(),
  baselineCommit: baseline.source_commit,
  scenario: 'Separate Node processes: forced GC; cold import; all 120 targets with one justice evaluation, one hint and one daily lookup each; forced GC again. No network, no concurrency.',
  limitation: 'Node measurements are a reproducible local comparison, not Cloudflare Worker memory qualification. The candidate reads packaged immutable shards because no deployed R2 binding is available. Worker peak below 100 MiB and real R2 remain unverified.',
  corpus: { bytes: corpus.length, gzipBytes: gzipSync(corpus).length, sha256: createHash('sha256').update(corpus).digest('hex') },
  candidateSourceSha256: fingerprints,
  results,
};
await writeFile('docs/program/B1A-MEASUREMENTS.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ baselineMaxRssKiB: results.baseline.maxRssKiB, candidateMaxRssKiB: results.candidate.maxRssKiB, corpusBytes: corpus.length, workerQualified: false }));
