import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const publicRoot = "public/semantic/fr-fasttext-30000-v1";
const script = resolve("scripts/build-semantic-shards.mjs");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const run = (cwd: string) => spawnSync(process.execPath, [script, "--verify"], { cwd, encoding: "utf8", timeout: 60000 });
test("production shard verification preserves every frozen V1 byte and the Git diff", async () => {
  const files = ["data/semantic-v1-index.json", `${publicRoot}/manifest.json`, `${publicRoot}/source.json`, ...(await readdir(`${publicRoot}/targets`)).map(name => `${publicRoot}/targets/${name}`)];
  const before = await Promise.all(files.map(async file => hash(await readFile(file))));
  const diff = () => spawnSync("git", ["diff", "--name-only", "--", "data/semantic-v1-index.json", publicRoot], { encoding: "utf8" }).stdout;
  const beforeDiff = diff(); const result = run(process.cwd());
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /verified-frozen/);
  assert.deepEqual(await Promise.all(files.map(async file => hash(await readFile(file)))), before);
  assert.equal(diff(), beforeDiff);
});
test("verification rejects corrupt object and index without regeneration or mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "braiz-frozen-shards-"));
  try {
    await mkdir(join(root, "docs/program"), { recursive: true }); await mkdir(join(root, "data"), { recursive: true });
    await cp("docs/program/BASELINE.json", join(root, "docs/program/BASELINE.json"));
    for (const name of ["semantic-fr.json", "semantic-v1-index.json"]) await cp(`data/${name}`, join(root, `data/${name}`));
    await cp(publicRoot, join(root, publicRoot), { recursive: true });
    const path = join(root, publicRoot, "targets", (await readdir(join(root, publicRoot, "targets")))[0]);
    const bytes = await readFile(path); bytes[9] ^= 1; await writeFile(path, bytes);
    const corrupted = run(root); assert.equal(corrupted.status, 1); assert.match(corrupted.stderr, /Frozen V1 object mismatch/);
    assert.deepEqual(await readFile(path), bytes);
    const indexPath = join(root, "data/semantic-v1-index.json"); const index = await readFile(indexPath); const changed = Buffer.concat([index, Buffer.from(" ")]); await writeFile(indexPath, changed);
    const badIndex = run(root); assert.equal(badIndex.status, 1); assert.match(badIndex.stderr, /Frozen V1 index hash mismatch/);
    assert.deepEqual(await readFile(indexPath), changed);
  } finally { await rm(root, { recursive: true, force: true }); }
});
