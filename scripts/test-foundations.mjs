import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./run-site.mjs";

process.chdir(PROJECT_ROOT);
const names = ["foundations", "site-seo", "advertising", "embed", "semantic-corpus-v2", "semantic-shards", "semantic-canonical-gzip", "two-braises"];
const outdir = "work/tests-foundations";
await mkdir(outdir, { recursive: true });
const outputs = names.map(name => `${outdir}/${name}.test.mjs`);
try {
  await build({ entryPoints: names.map(name => `tests/${name}.test.ts`), outdir, outExtension: { ".js": ".mjs" }, bundle: true, platform: "node", format: "esm", target: "node22", external: ["react", "react/jsx-runtime", "react-dom/server", "lucide-react", "radix-ui"], alias: { "cloudflare:workers": "./tests/support/cloudflare-workers.ts" }, logLevel: "warning" });
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...outputs], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { await Promise.all(outputs.map(file => rm(file, { force: true }))); }
