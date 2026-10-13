import {build} from 'esbuild';import {spawnSync} from 'node:child_process';
const names=['game-integration','expeditions','game-feedback','game-review-fixes','release-status'];
await build({entryPoints:names.map(n=>'tests/'+n+'.test.ts'),outdir:'work/tests-task8b-fix',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',external:['react-test-renderer','react','react/jsx-runtime','react-dom','react-dom/server','lucide-react'],alias:{'cloudflare:workers':'./tests/support/cloudflare-workers.ts'},logLevel:'warning'});
const args=process.argv.includes('--red')?['--test','--test-name-pattern=completed chapter','work/tests-task8b-fix/game-integration.test.mjs']:['--test','--test-concurrency=1',...names.map(n=>'work/tests-task8b-fix/'+n+'.test.mjs')];
process.exitCode=spawnSync(process.execPath,args,{stdio:'inherit'}).status??1;
