import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const names=['game-integration','release-polish','studio-variants-components','profile-panel','game-feedback','device-sync','flame-presentation','game-review-fixes','semantic-target-v2','semantic-shards'];
await mkdir('work/tests-task8b',{recursive:true});
await build({entryPoints:names.map(n=>'tests/'+n+'.test.ts'),outdir:'work/tests-task8b',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',external:['react-test-renderer','react','react/jsx-runtime','react-dom','react-dom/server','lucide-react'],alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'},logLevel:'warning'});
process.exitCode=spawnSync(process.execPath,['--test','--test-concurrency=1',...names.map(n=>'work/tests-task8b/'+n+'.test.mjs')],{stdio:'inherit'}).status??1;
