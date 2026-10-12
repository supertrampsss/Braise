import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('work/studio-qualification',{recursive:true});
await build({entryPoints:['scripts/qualify-studio-local.ts'],outfile:'work/studio-qualification/run.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'}});
process.exitCode=spawnSync(process.execPath,['work/studio-qualification/run.mjs'],{stdio:'inherit'}).status??1;
