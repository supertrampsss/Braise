import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { canonicalGzip } from "../scripts/canonical-gzip.mjs";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticIndex } from "../scripts/build-semantic-index-v2.mjs";
import { buildSemanticTarget } from "../scripts/build-semantic-target-v2.mjs";
import { verifySemanticCorpus } from "../scripts/verify-semantic-corpus-v2.mjs";
import { verifySemanticIndex } from "../scripts/verify-semantic-index-v2.mjs";
import { verifySemanticTarget } from "../scripts/verify-semantic-target-v2.mjs";
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
test("canonical gzip reproduces the actual frozen V1 compressed oracle exactly", async () => {
  const frozen = await readFile("public/semantic/fr-fasttext-30000-v1/targets/000-f8d397a33fcb.brz");
  const raw = gunzipSync(frozen); const canonical = canonicalGzip(raw);
  assert.equal(canonical[9], 3); assert.deepEqual(canonical, frozen); assert.equal(sha256(canonical), sha256(frozen));
});
test("V2 corpus, index and target compress canonically and retain independent verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "braiz-canonical-gzip-"));
  try {
    const sourcePath = join(root, "source.vec"); const corpusDir = join(root, "corpus"); const outputDir = join(root, "targets");
    await writeFile(sourcePath, "3 2\nalpha 1 0\nbêta 0 1\nomega -1 -1");
    const manifest = await buildSemanticCorpus({ sourcePath, outputDir: corpusDir });
    const object = await readFile(join(corpusDir, "segments", manifest.segments[0].file));
    assert.deepEqual([...object.subarray(0, 10)], [31, 139, 8, 0, 0, 0, 0, 0, 2, 3]);
    assert.equal(sha256(object), manifest.segments[0].objectSha256);
    await verifySemanticCorpus({ sourcePath, outputDir: corpusDir });
    await mkdir(outputDir, { recursive: true });
    await buildSemanticIndex({ corpusDir, outputDir });
    await verifySemanticIndex({ corpusDir, outputDir });
    await buildSemanticTarget({ corpusDir, outputDir, targetId: 0 });
    await verifySemanticTarget({ corpusDir, outputDir, targetId: 0 });
    async function inspect(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await inspect(path);
        else if (entry.name.endsWith(".gz")) {
          const bytes = await readFile(path); assert.equal(bytes[9], 3, path);
          assert.deepEqual(canonicalGzip(gunzipSync(bytes)), bytes, path);
        }
      }
    }
    await inspect(outputDir);
  } finally { await rm(root, { recursive: true, force: true }); }
});
