import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const names=['social-sync-components','device-sync','social-sync','server-store','profile-storage','game','game-core-review','game-review-fixes','compatibility','profile-panel','weekly-ritual','foundations'];
await mkdir('work/tests-task4',{recursive:true});await build({entryPoints:names.map(n=>'tests/'+n+'.test.ts'),outdir:'work/tests-task4',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',external:['react-test-renderer','react','react/jsx-runtime','react-dom','react-dom/server','lucide-react'],alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'},logLevel:'warning'});
process.exitCode=spawnSync(process.execPath,['--test','--test-concurrency=1',...names.map(n=>'work/tests-task4/'+n+'.test.mjs')],{stdio:'inherit'}).status??1;
