import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
const names = ['personal-statistics', 'calendar-reminder', 'profile-panel', 'profile-storage', 'weekly-ritual', 'game-review-fixes', 'game-core-review', 'game-feedback', 'game', 'compatibility', 'archive', 'collections', 'expeditions', 'flame-presentation'];
await build({ entryPoints: names.map(name => `tests/${name}.test.ts`), outdir: 'work/personal-review-tests', bundle: true, platform: 'node', format: 'esm', target: 'node22', alias: { 'cloudflare:workers': './tests/support/cloudflare-workers.ts' }, external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server', 'lucide-react'], outExtension: { '.js': '.mjs' } });
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...names.map(name => `work/personal-review-tests/${name}.test.mjs`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
