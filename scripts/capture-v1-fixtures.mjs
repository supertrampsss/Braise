// Oracle pinned to the original source. Never regenerate from the current reader.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const baseline = JSON.parse(await readFile('docs/program/BASELINE.json', 'utf8'));
const root = 'work/v1-reference';
await mkdir(root + '/data', { recursive: true });
await mkdir('tests/fixtures', { recursive: true });
for (const [source, destination] of [
  ['lib/semantic.ts', 'semantic.ts'],
  ['lib/game-types.ts', 'game-types.ts'],
  ['data/semantic-fr.json', 'data/semantic-fr.json'],
]) {
  const bytes = execFileSync('git', ['show', baseline.source_commit + ':' + source], { maxBuffer: 64 * 1024 * 1024 });
  if (source.endsWith('.json') && createHash('sha256').update(bytes).digest('hex') !== baseline.corpus_sha256) throw new Error('V1 corpus fingerprint mismatch');
  await writeFile(root + '/' + destination, bytes);
}
await writeFile(root + '/capture.js', String.raw`
import { writeFileSync } from 'node:fs';
import { getPuzzle, evaluateWord, findWord, nextHint, exportDataset } from './semantic';
const dataset = exportDataset();
const snapshot = (mode, seed, now) => {
  const result = getPuzzle(mode, seed, new Date(now));
  return { mode, seed, now, ...result, answer: dataset.puzzles[result.targetIndex].word };
};
const now = '2026-09-07T12:00:00.000Z';
const daily = Array.from({ length: 122 }, (_, i) => snapshot('daily', '', new Date(Date.UTC(2026, 8, 6 + i, 12)).toISOString()));
const seeds = ['0', '1', '1234', '0001', '2147483647', '0000000000', '20260907'].flatMap(seed => ['free', 'challenge'].map(mode => snapshot(mode, seed, now)));
const boundaries = ['2026-09-07T21:59:59.000Z', '2026-09-07T22:00:00.000Z', '2026-03-28T23:01:00.000Z', '2026-10-24T22:01:00.000Z'].map(at => snapshot('daily', '', at));
const scores = dataset.puzzles.map((target, targetIndex) => ({ target: target.word, evaluations: [...new Set([target.word, 'ordinateur', 'océan', 'fromage', 'justice'])].map(word => evaluateWord(targetIndex, findWord(word))) }));
writeFileSync('tests/fixtures/v1-reference.json', JSON.stringify({ sourceCommit: '${baseline.source_commit}', corpusSha256: '${baseline.corpus_sha256}', daily, seeds, boundaries, scores }, null, 2) + '\n');
const guess = (target, word, order, hint = false) => ({ ...evaluateWord(target, findWord(word)), hint, order });
const startedAt = Date.parse(now);
const dailyGame = { guesses: ['justice', 'livre', 'enfant'].map((w, i) => guess(23, w, i + 1)), pins: ['livre', 'enfant'], hints: 0, startedAt };
const wonGame = { ...dailyGame, guesses: [...dailyGame.guesses, guess(23, 'ordinateur', 4)], solvedAt: startedAt + 300000 };
const used = ['justice', 'musique', 'sport', 'livre', 'enfant'];
const freeHint = nextHint(61, 0, used);
const freeGame = { guesses: [...used.map((w, i) => guess(61, w, i + 1)), { ...freeHint, hint: true, order: 6 }], pins: ['sport', 'livre', freeHint.word], hints: 1, startedAt };
const fixtures = [
  { name: 'daily-in-progress', puzzleId: 'daily-2026-09-07', game: dailyGame, profile: { wins: [], guesses: 3, sound: false } },
  { name: 'daily-won', puzzleId: 'daily-2026-09-07', game: wonGame, profile: { wins: [{ id: 'daily-2026-09-07', date: '2026-09-07', mode: 'daily', tries: 4, hints: 0 }], guesses: 4, sound: true } },
  { name: 'free-challenge-with-hint', puzzleId: 'free-1234', game: freeGame, profile: { wins: [], guesses: 5, sound: false }, freeSeed: '1234' },
].map(f => ({ ...f, synthetic: true, storage: { ['braise.v1.game.' + f.puzzleId]: JSON.stringify(f.game), 'braise.v1.profile': JSON.stringify(f.profile), ...(f.freeSeed ? { 'braise.v1.freeSeed': JSON.stringify(f.freeSeed) } : {}) } }));
writeFileSync('tests/fixtures/v1-saves.json', JSON.stringify({ source: 'Synthetic saves constructed from pinned V1 schema and real corpus scores; no user data', sourceCommit: '${baseline.source_commit}', fixtures }, null, 2) + '\n');
`);
await build({ entryPoints: [root + '/capture.js'], outfile: root + '/capture.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', alias: { '@/data/semantic-fr.json': './' + root + '/data/semantic-fr.json' }, logLevel: 'warning' });
execFileSync(process.execPath, [root + '/capture.mjs'], { stdio: 'inherit' });
console.log('Pinned V1 fixtures captured: 122 daily dates, 14 seeded cases, 4 time boundaries, 120 target score samples, 3 synthetic saves.');
