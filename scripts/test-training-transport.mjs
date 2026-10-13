import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
const names = ['training-screen-transport', 'training-worker-client', 'training-offline', 'offline', 'training-components', 'game-core-review', 'game-review-fixes', 'game-feedback', 'compatibility', 'server-store', 'final-format-components'];
await build({ entryPoints: names.map(name => `tests/${name}.test.ts`), outdir: 'work/training-transport-tests', outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['react-test-renderer', 'react', 'react/jsx-runtime', 'react-dom', 'react-dom/server', 'lucide-react'], alias: { 'cloudflare:workers': './tests/support/cloudflare-workers.ts' }, logLevel: 'warning' });
process.exitCode = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...names.map(name => `work/training-transport-tests/${name}.test.mjs`)], { stdio: 'inherit' }).status ?? 1;
