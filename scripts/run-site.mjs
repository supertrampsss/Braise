import { spawn } from "node:child_process";
import { constants } from "node:os";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function durationMs(value, fallback) {
  if (!value) return fallback;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(value);
  if (!match || Number(match[1]) <= 0) throw new Error("Invalid timeout; use a positive duration such as 3m or 180s");
  return Number(match[1]) * ({ ms: 1, s: 1000, m: 60000 }[match[2] ?? "s"]);
}
/** @param {NodeJS.ProcessEnv} env @returns {Promise<NodeJS.ProcessEnv>} */
export async function siteEnvironment(env = process.env) {
  const runtime = resolve(env.SITES_RUNTIME_ROOT ?? resolve(PROJECT_ROOT, ".sites-runtime"));
  for (const folder of ["npm-cache", "xdg-config", "tmp", "wrangler/logs"]) await mkdir(resolve(runtime, folder), { recursive: true });
  // Retain the actual home and application secrets. Only tool state is project-local.
  return { ...env, SITES_ENV_READY: "1", SITES_PROJECT_ROOT: PROJECT_ROOT, XDG_CONFIG_HOME: resolve(runtime, "xdg-config"), TMPDIR: resolve(runtime, "tmp"), TEMP: resolve(runtime, "tmp"), TMP: resolve(runtime, "tmp"), WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: resolve(runtime, "wrangler/logs"), MINIFLARE_REGISTRY_PATH: resolve(runtime, "wrangler/registry"), npm_config_cache: resolve(runtime, "npm-cache"), npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" };
}
/** No shell interpolation. Preserve failures and stop the complete child tree on timeout. */
export function runProcess(command, args, { cwd = PROJECT_ROOT, env = process.env, timeoutMs = 0, killAfterMs = 10000, stdio = "inherit" } = {}) {
  return new Promise(resolveResult => {
    const child = spawn(command, args, { cwd, env, stdio, detached: process.platform !== "win32", windowsHide: true });
    let timedOut = false; let timer; let forceTimer;
    const stop = signal => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => child.kill(signal));
      } else { try { process.kill(-child.pid, signal); } catch { child.kill(signal); } }
    };
    const signalHandler = signal => stop(signal);
    const onTerm = () => signalHandler("SIGTERM"); const onInt = () => signalHandler("SIGINT");
    process.on("SIGTERM", onTerm); process.on("SIGINT", onInt);
    // A root process may exit on TERM while a descendant ignores it. Keep escalation alive.
    const cleanup = () => { clearTimeout(timer); if (!timedOut) clearTimeout(forceTimer); process.off("SIGTERM", onTerm); process.off("SIGINT", onInt); };
    child.once("error", error => { cleanup(); console.error(`Unable to run child process: ${error.code ?? "spawn failed"}`); resolveResult(69); });
    child.once("close", (code, signal) => { cleanup(); resolveResult(timedOut ? 124 : code ?? 128 + (constants.signals[signal] ?? 1)); });
    if (timeoutMs > 0) timer = setTimeout(() => { timedOut = true; stop("SIGTERM"); forceTimer = setTimeout(() => stop("SIGKILL"), killAfterMs); }, timeoutMs);
  });
}
export async function runTool(name, args = [], options = {}) {
  const paths = { vite: "vite/bin/vite.js", vinext: "vinext/dist/cli.js", tsc: "typescript/bin/tsc", eslint: "eslint/bin/eslint.js", drizzle: "drizzle-kit/bin.cjs" };
  if (!(name in paths)) throw new Error("Unknown tool");
  return runProcess(process.execPath, [resolve(PROJECT_ROOT, "node_modules", paths[name]), ...args], { env: await siteEnvironment(), ...options });
}
async function install() {
  // The official Sites image keeps its locked tarball preflight/cache-seed/telemetry path.
  if (process.platform !== "win32") return runProcess("bash", [resolve(PROJECT_ROOT, "scripts/install-ci.sh")]);
  const env = await siteEnvironment(); const guard = resolve(PROJECT_ROOT, ".sites-runtime/install-node.lock");
  try { await mkdir(guard); } catch (error) { if (error.code === "EEXIST") { console.error("A dependency install owns the local guard; verify its process before recovery."); return 75; } throw error; }
  try {
    await writeFile(resolve(guard, "owner.json"), JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !/[\\/]npm-cli\.js$/.test(npmCli)) { console.error("Run installation with npm run install:ci so its exact npm runtime is available."); return 69; }
    const code = await runProcess(process.execPath, [npmCli, "ci", "--cache", env.npm_config_cache], { env: { ...env, NPM_CONFIG_MAXSOCKETS: "1", NPM_CONFIG_FETCH_RETRIES: "0", NPM_CONFIG_FETCH_TIMEOUT: "30000" }, timeoutMs: durationMs(process.env.SITES_INSTALL_TIMEOUT, 480000), killAfterMs: durationMs(process.env.SITES_INSTALL_KILL_AFTER, 15000) });
    if (code === 0) {
      const lock = await readFile(resolve(PROJECT_ROOT, "package-lock.json"));
      await readFile(resolve(PROJECT_ROOT, "node_modules/vinext/dist/cli.js"));
      await writeFile(resolve(PROJECT_ROOT, "node_modules/.sites-install.json"), JSON.stringify({ lockfile_sha256: createHash("sha256").update(lock).digest("hex"), node: process.version, platform: `${process.platform}-${process.arch}` }));
    }
    return code;
  } finally { await rm(guard, { recursive: true, force: true }); }
}
export async function runSite(command, args = []) {
  switch (command) {
    case "dev": return runTool("vite", args);
    case "start": return runTool("vinext", ["start", ...args]);
    case "typecheck": return runTool("tsc", ["--noEmit", ...args]);
    case "lint": return runTool("eslint", [".", "--ignore-pattern", "dist", "--ignore-pattern", ".next", ...args]);
    case "db:generate": return runTool("drizzle", ["generate", ...args]);
    case "install:ci": return install();
    case "check": {
      const code = await runSite("typecheck");
      return code === 0 ? runProcess(process.execPath, [resolve(PROJECT_ROOT, "scripts/test-game.mjs")], { env: await siteEnvironment() }) : code;
    }
    default: console.error("Usage: node scripts/run-site.mjs dev|start|typecheck|lint|db:generate|install:ci|check"); return 64;
  }
}
if (process.argv[1] && basename(process.argv[1]) === "run-site.mjs" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSite(process.argv[2], process.argv.slice(3)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
