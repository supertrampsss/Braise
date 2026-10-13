import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const names=['game-integration','game-feedback','game-review-fixes','game-core-review','profile-panel','profile-storage','device-sync','weekly-ritual','weekly-ritual-ui','flame-presentation','social-sync-components','studio-variants-components','embed','training-components','offline','collections','expeditions','archive'];
await mkdir('work/tests-task8a',{recursive:true});
await build({entryPoints:names.map(n=>'tests/'+n+'.test.ts'),outdir:'work/tests-task8a',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',external:['react-test-renderer','react','react/jsx-runtime','react-dom','react-dom/server','lucide-react'],alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'},logLevel:'warning'});
process.exitCode=spawnSync(process.execPath,['--test','--test-concurrency=1',...names.map(n=>'work/tests-task8a/'+n+'.test.mjs')],{stdio:'inherit'}).status??1;
