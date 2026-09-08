import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { buildSemanticCorpus, CorpusBuildInterrupted } from "../scripts/build-semantic-corpus-v2.mjs";
import { verifySemanticCorpus } from "../scripts/verify-semantic-corpus-v2.mjs";

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "braise-corpus-v2-"));
  return { root, source: join(root, "source.vec"), output: join(root, "staging") };
}
function letters(value: number) {
  let result = ""; let current = value + 1;
  while (current > 0) { current--; result = String.fromCharCode(97 + current % 26) + result; current = Math.floor(current / 26); }
  return result;
}
async function remove(root: string) { await rm(root, { recursive: true, force: true }); }
const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

test("the ingestion reaches EOF beyond 50,000 rows and the independent verifier covers every admitted entry", async () => {
  const paths = await workspace();
  try {
    const rows = 50_001;
    const body = Array.from({ length: rows }, (_, index) => `mot${letters(index)} 1 0`).join("\n");
    await writeFile(paths.source, `${rows} 2\r\n${body}`);
    const manifest = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 4_096 });
    assert.equal(manifest.stats.rowsRead, rows);
    assert.equal(manifest.stats.accepted, rows);
    assert.equal(manifest.stats.segmentCount, Math.ceil(rows / 4_096));
    const result = await verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output });
    assert.equal(result.accepted, rows);
    assert.equal(result.rowsRead, rows);
    assert.equal(result.semanticSha256, manifest.semanticSha256);
    const lastSegment = manifest.segments.at(-1)!;
    const compressed = await readFile(join(paths.output, "segments", lastSegment.file));
    assert.ok(compressed.length > 0, "the final line without a newline must be persisted");
  } finally { await remove(paths.root); }
});

test("every source row is admitted or receives one exact exclusion reason", async () => {
  const paths = await workspace();
  try {
    const chunks = [
      Buffer.from("10 2\r\nÉCOLE 3 4\r\ne\u0301cole 0 1\r\nl’homme 1 1\r\n1mot 1 0\r\ncourt 1\r\ninfini NaN 0\r\nzero 0 0\r\nmalformed\r\n"),
      Buffer.from([0xc3, 0x28]),
      Buffer.from(" 1 0\r\nmotlong " + "1 ".repeat(30)),
    ];
    await writeFile(paths.source, Buffer.concat(chunks));
    const manifest = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 1, maxLineBytes: 32 });
    assert.equal(manifest.stats.accepted, 2);
    assert.deepEqual(manifest.stats.excluded, { malformed: 1, invalid_utf8: 1, line_too_long: 1, non_lexical: 1, dimension_mismatch: 1, non_finite: 1, zero_norm: 1, duplicate: 1 });
    assert.equal(manifest.stats.accepted + Object.values(manifest.stats.excluded).reduce((sum: number, value) => sum + Number(value), 0), 10);
    const result = await verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output });
    assert.equal(result.accepted, 2);
  } finally { await remove(paths.root); }
});

test("stream boundaries and extreme finite vectors remain exact and normalized", async t => {
  await t.test("UTF-8 split between read buffers", async () => {
    const paths = await workspace();
    try {
      const word = `${"a".repeat(16_379)}é`;
      await writeFile(paths.source, `1 2\n${word} 2e-162 0`);
      const manifest = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, maxLineBytes: Buffer.byteLength(`${word} 2e-162 0`) });
      assert.equal(manifest.stats.accepted, 1);
      await verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output });
    } finally { await remove(paths.root); }
  });
  await t.test("CRLF split between read buffers and exact line limit", async () => {
    const paths = await workspace();
    try {
      const word = "a".repeat(16_375);
      const line = `${word} 1 0`;
      await writeFile(paths.source, `2 2\n${line}\r\nomega 0 1`);
      const manifest = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, maxLineBytes: Buffer.byteLength(line) });
      assert.equal(manifest.stats.accepted, 2);
      await verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output });
    } finally { await remove(paths.root); }
  });
});

test("truncated and overlong source inventories fail without an active corpus", async t => {
  for (const [name, contents] of [["truncated", "2 2\nmot 1 0"], ["extra", "1 2\nmot 1 0\nplus 0 1"]] as const) {
    await t.test(name, async () => {
      const paths = await workspace();
      try {
        await writeFile(paths.source, contents);
        await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output }), /row count|more rows/i);
        await assert.rejects(readFile(join(paths.output, "active.json")), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
      } finally { await remove(paths.root); }
    });
  }
});

test("checkpoint and orphan-segment resumes equal a clean build exactly", async t => {
  const sourceText = "7 2\nalpha 1 0\nbêta 0 1\ngamma 1 1\ndelta -1 1\nepsilon 2 1\nzêta 1 2\nomega -1 -1";
  for (const stop of ["checkpoint", "segment-write"] as const) {
    await t.test(stop, async () => {
      const resumed = await workspace(); const clean = await workspace();
      try {
        await writeFile(resumed.source, sourceText); await writeFile(clean.source, sourceText);
        const interruption = stop === "checkpoint" ? { testStopAfterSegments: 1 } : { testStopAfterSegmentWrite: 1 };
        await assert.rejects(buildSemanticCorpus({ sourcePath: resumed.source, outputDir: resumed.output, segmentEntries: 2, ...interruption }), (error: unknown) => error instanceof CorpusBuildInterrupted);
        await assert.rejects(readFile(join(resumed.output, "active.json")), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
        const resumedManifest = await buildSemanticCorpus({ sourcePath: resumed.source, outputDir: resumed.output, segmentEntries: 2 });
        const cleanManifest = await buildSemanticCorpus({ sourcePath: clean.source, outputDir: clean.output, segmentEntries: 2 });
        assert.equal(resumedManifest.semanticSha256, cleanManifest.semanticSha256);
        assert.deepEqual(resumedManifest.stats, cleanManifest.stats);
        assert.deepEqual(resumedManifest.segments.map((segment: { objectSha256: string }) => segment.objectSha256), cleanManifest.segments.map((segment: { objectSha256: string }) => segment.objectSha256));
        await verifySemanticCorpus({ sourcePath: resumed.source, outputDir: resumed.output });
        const repeated = await buildSemanticCorpus({ sourcePath: resumed.source, outputDir: resumed.output, segmentEntries: 2 });
        assert.equal(repeated.semanticSha256, resumedManifest.semanticSha256, "a completed build is idempotent");
      } finally { await remove(resumed.root); await remove(clean.root); }
    });
  }
});

test("resume refuses changed configuration, changed source and corrupted durable segments", async t => {
  const sourceText = "5 2\nalpha 1 0\nbêta 0 1\ngamma 1 1\ndelta -1 1\nomega -1 -1";
  await t.test("configuration", async () => {
    const paths = await workspace();
    try {
      await writeFile(paths.source, sourceText);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2, testStopAfterSegments: 1 }), CorpusBuildInterrupted);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 3 }), /configuration/);
    } finally { await remove(paths.root); }
  });
  await t.test("source with identical byte length", async () => {
    const paths = await workspace();
    try {
      await writeFile(paths.source, sourceText);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2, testStopAfterSegments: 1 }), CorpusBuildInterrupted);
      await writeFile(paths.source, sourceText.replace("alpha 1 0", "alpha 0 1"));
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2 }), /source or configuration/i);
    } finally { await remove(paths.root); }
  });
  await t.test("segment corruption", async () => {
    const paths = await workspace();
    try {
      await writeFile(paths.source, sourceText);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2, testStopAfterSegments: 1 }), CorpusBuildInterrupted);
      const checkpoint = JSON.parse(await readFile(join(paths.output, "checkpoint.json"), "utf8"));
      const segmentPath = join(paths.output, "segments", checkpoint.segments[0].file);
      const bytes = await readFile(segmentPath); bytes[Math.floor(bytes.length / 2)] ^= 1; await writeFile(segmentPath, bytes);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2 }), /corrupt/);
    } finally { await remove(paths.root); }
  });
  await t.test("bounded decompression", async () => {
    const paths = await workspace();
    try {
      await writeFile(paths.source, sourceText);
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2, maxSegmentRawBytes: 256, testStopAfterSegments: 1 }), CorpusBuildInterrupted);
      const checkpointPath = join(paths.output, "checkpoint.json"); const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
      const segment = checkpoint.segments[0]; const bomb = gzipSync(Buffer.alloc(257));
      segment.compressedBytes = bomb.length; segment.objectSha256 = sha256(bomb); segment.rawBytes = 256;
      await writeFile(join(paths.output, "segments", segment.file), bomb); await writeFile(checkpointPath, JSON.stringify(checkpoint));
      await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 2, maxSegmentRawBytes: 256 }), /safely decompress/);
    } finally { await remove(paths.root); }
  });
});

test("the independent verifier rejects a same-size source substitution and concurrent build lock", async () => {
  const paths = await workspace();
  try {
    const source = "2 2\nalpha 1 0\nomega 0 1";
    await writeFile(paths.source, source);
    await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 1 });
    await writeFile(paths.source, source.replace("alpha 1 0", "alpha 0 1"));
    await assert.rejects(verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output }), /Source does not match/);
    const locked = await workspace();
    try {
      await writeFile(locked.source, source); await mkdir(locked.output, { recursive: true }); await writeFile(join(locked.output, ".build.lock"), "owned");
      await assert.rejects(buildSemanticCorpus({ sourcePath: locked.source, outputDir: locked.output }), /build lock|corpus build/i);
    } finally { await remove(locked.root); }
  } finally { await remove(paths.root); }
});

test("a completed relaunch revalidates every segment before reporting success", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, "3 2\nalpha 1 0\nbêta 0 1\nomega -1 -1");
    const manifest = await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 1 });
    const segmentPath = join(paths.output, "segments", manifest.segments[1].file); const bytes = await readFile(segmentPath);
    bytes[Math.floor(bytes.length / 2)] ^= 1; await writeFile(segmentPath, bytes);
    await assert.rejects(buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, segmentEntries: 1 }), /hash mismatch|corrupt/i);
  } finally { await remove(paths.root); }
});

test("an explicit owner check recovers a lock left by a killed build process", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, "2 2\nalpha 1 0\nomega 0 1");
    const child = spawn(process.execPath, ["scripts/build-semantic-corpus-v2.mjs", "--source", paths.source, "--output", paths.output], { cwd: process.cwd(), env: { ...process.env, BRAISE_TEST_HOLD_AFTER_LOCK_MS: "30000" }, stdio: "ignore" });
    const lockPath = join(paths.output, ".build.lock"); let lock: { owner: string } | null = null;
    for (let attempt = 0; attempt < 100 && !lock; attempt++) {
      try { lock = JSON.parse(await readFile(lockPath, "utf8")); }
      catch { await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    assert.ok(lock?.owner, "child must persist its lock identity before interruption");
    child.kill("SIGKILL"); await new Promise<void>(resolve => child.once("close", () => resolve()));
    const recoveries = await Promise.allSettled([
      buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, recoverLockOwner: lock.owner, testHoldAfterLockMs: 100 }),
      buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.output, recoverLockOwner: lock.owner }),
    ]);
    assert.equal(recoveries.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(recoveries.filter(result => result.status === "rejected" && /build or recovery/.test(String(result.reason))).length, 1);
    const completed = recoveries.find((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")!;
    assert.equal(completed.value.stats.accepted, 2);
    await verifySemanticCorpus({ sourcePath: paths.source, outputDir: paths.output });
  } finally { await remove(paths.root); }
});
