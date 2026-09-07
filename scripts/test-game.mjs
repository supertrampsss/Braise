import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('work/tests', { recursive: true });
await build({ entryPoints: ['tests/game.test.ts'], outfile: 'work/tests/game.test.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
const result = spawnSync(process.execPath, ['--test', 'work/tests/game.test.mjs'], { stdio: 'inherit' });
await rm('work/tests/game.test.mjs');
process.exitCode = result.status ?? 1;
