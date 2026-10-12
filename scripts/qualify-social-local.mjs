import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('work/social-qualification',{recursive:true});
await build({entryPoints:['scripts/qualify-social-local.ts'],outfile:'work/social-qualification/run.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'}});
process.exitCode=spawnSync(process.execPath,['work/social-qualification/run.mjs'],{stdio:'inherit'}).status??1;
