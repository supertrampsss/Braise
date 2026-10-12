import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { durationMs, PROJECT_ROOT, runProcess, runTool, siteEnvironment } from "./run-site.mjs";
export async function buildVerified(args = []) {
  const timeoutMs = durationMs(process.env.SITES_BUILD_TIMEOUT, 180000);
  const killAfterMs = durationMs(process.env.SITES_BUILD_KILL_AFTER, 10000);
  const shards = await runProcess(process.execPath, [resolve(PROJECT_ROOT, "scripts/build-semantic-shards.mjs"), "--verify"], { env: await siteEnvironment(), timeoutMs, killAfterMs });
  if (shards !== 0) return shards;
  return runTool("vinext", ["build", ...args], { timeoutMs, killAfterMs });
}
if (process.argv[1] && basename(process.argv[1]) === "build-verified.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildVerified(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
