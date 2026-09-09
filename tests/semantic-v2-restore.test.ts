import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadPinnedSource, parseRestoreArgs, restoreSemanticV2, verifyPinnedFile } from "../scripts/restore-semantic-v2.mjs";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

test("the restore plan uses isolated ignored staging paths and never enables a download implicitly", () => {
  const root = "/tmp/braise-restore-plan";
  assert.deepEqual(parseRestoreArgs([], root), {
    sourcePath: join(root, "work/source/wiki.fr.vec"),
    corpusDir: join(root, "work/semantic-v2-real"),
    targetsDir: join(root, "work/semantic-v2-targets-real"),
    evidenceDir: join(root, "data/editorial-v2-evidence"),
    cataloguePath: join(root, "data/editorial-v2-catalogue.json"),
    download: false,
    recoverDownloadLockOwner: null,
    recoverCorpusLockOwner: null,
  });
  assert.equal(parseRestoreArgs(["--download"], root).download, true);
  assert.throws(() => parseRestoreArgs(["--url", "https://example.test/source"], root), /Unsupported restore argument/);
});

test("a source is accepted only with exact size, hash and a regular non-symlink file", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-source-"));
  try {
    const bytes = Buffer.from("source exacte"); const path = join(root, "source.vec"); const link = join(root, "source-link.vec");
    const pin = { bytes: bytes.length, sha256: sha256(bytes) };
    await writeFile(path, bytes);
    assert.equal((await verifyPinnedFile(path, pin)).sha256, pin.sha256);
    await assert.rejects(verifyPinnedFile(path, { ...pin, bytes: bytes.length + 1 }), /size mismatch/);
    await assert.rejects(verifyPinnedFile(path, { ...pin, sha256: "0".repeat(64) }), /SHA-256 mismatch/);
    await symlink(path, link);
    await assert.rejects(verifyPinnedFile(link, pin), /non-symlink/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the pinned downloader resumes a partial file, validates it, installs atomically and is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-download-"));
  try {
    const source = Buffer.from("abcdefghijklmnopqrstuvwxyz"); const destination = join(root, "nested", "source.vec");
    const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    await mkdir(join(root, "nested"), { recursive: true });
    await writeFile(`${destination}.part`, source.subarray(0, 8));
    const calls: Array<{ range: string | undefined }> = [];
    const fetchImpl = async (_url: string, init?: { headers?: { Range?: string } }) => {
      const range = init?.headers?.Range; calls.push({ range });
      const offset = range ? Number(range.match(/bytes=(\d+)-/)?.[1]) : 0;
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(source.subarray(offset)); controller.close(); } }), { status: offset ? 206 : 200, headers: { "content-length": String(source.length - offset), ...(offset ? { "content-range": `bytes ${offset}-${source.length - 1}/${source.length}` } : {}) } });
    };
    const first = await downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch });
    assert.equal(first.downloaded, true); assert.ok("resumedAt" in first); assert.equal(first.resumedAt, 8); assert.deepEqual(calls, [{ range: "bytes=8-" }]);
    assert.deepEqual(await readFile(destination), source); await assert.rejects(stat(`${destination}.part`), /ENOENT/);
    const second = await downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch });
    assert.equal(second.downloaded, false); assert.equal(calls.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the downloader preserves an incomplete partial file and releases its lock for a later resume", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-interrupted-"));
  try {
    const source = Buffer.from("abcdefghij"); const destination = join(root, "source.vec");
    const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    const fetchImpl = async () => new Response(source.subarray(0, 4), { status: 200, headers: { "content-length": "4" } });
    await assert.rejects(downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch }), /incomplete/);
    assert.equal((await stat(`${destination}.part`)).size, 4);
    await assert.rejects(stat(`${destination}.download.lock`), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the downloader refuses a symbolic partial without touching its target", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-symlink-"));
  try {
    const victim = join(root, "victim"); const destination = join(root, "source.vec");
    await writeFile(victim, "à conserver"); await symlink(victim, `${destination}.part`);
    const source = Buffer.from("source"); const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    await assert.rejects(downloadPinnedSource(destination, { pin, fetchImpl: (async () => new Response(source)) as typeof fetch }), /non-symlink/);
    assert.equal(await readFile(victim, "utf8"), "à conserver");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the downloader rejects an oversized stream, cancels it and never exceeds the pin", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-overflow-"));
  try {
    const destination = join(root, "source.vec"); const expected = Buffer.from("12345"); let cancelled = false;
    const pin = { url: "https://pinned.test/source.vec", bytes: expected.length, sha256: sha256(expected) };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(Buffer.from("1234")); controller.enqueue(Buffer.from("5678")); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(downloadPinnedSource(destination, { pin, fetchImpl: (async () => new Response(stream, { status: 200 })) as typeof fetch }), /exceeds the expected size/);
    assert.equal(cancelled, true);
    assert.ok((await stat(`${destination}.part`)).size <= pin.bytes);
    await assert.rejects(stat(`${destination}.download.lock`), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a server ignoring Range replaces the partial instead of appending", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-range-ignored-"));
  try {
    const source = Buffer.from("abcdefghij"); const destination = join(root, "source.vec");
    const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    await writeFile(`${destination}.part`, "old");
    const fetchImpl = async (_url: string, init?: { headers?: { Range?: string } }) => {
      assert.equal(init?.headers?.Range, "bytes=3-");
      return new Response(source, { status: 200, headers: { "content-length": String(source.length) } });
    };
    const result = await downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch });
    assert.ok("resumedAt" in result);
    assert.equal(result.resumedAt, 0);
    assert.deepEqual(await readFile(destination), source);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an inconsistent resume response preserves the partial and releases the lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-range-invalid-"));
  try {
    const source = Buffer.from("abcdefghij"); const destination = join(root, "source.vec"); const partial = Buffer.from("abc");
    const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    await writeFile(`${destination}.part`, partial);
    const fetchImpl = async () => new Response(source.subarray(3), { status: 206, headers: { "content-range": `bytes 4-${source.length - 1}/${source.length}` } });
    await assert.rejects(downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch }), /resume range is inconsistent/);
    assert.deepEqual(await readFile(`${destination}.part`), partial);
    await assert.rejects(stat(`${destination}.download.lock`), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the downloader cannot be redirected through a partial-path swap during fetch", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-path-swap-"));
  try {
    const source = Buffer.from("abcdefghij"); const destination = join(root, "source.vec"); const partialPath = `${destination}.part`; const victim = join(root, "victim");
    const pin = { url: "https://pinned.test/source.vec", bytes: source.length, sha256: sha256(source) };
    await writeFile(partialPath, source.subarray(0, 3)); await writeFile(victim, "à conserver");
    const fetchImpl = async () => {
      await rm(partialPath); await symlink(victim, partialPath);
      return new Response(source.subarray(3), { status: 206, headers: { "content-range": `bytes 3-${source.length - 1}/${source.length}` } });
    };
    await assert.rejects(downloadPinnedSource(destination, { pin, fetchImpl: fetchImpl as typeof fetch }), /changed before atomic installation/);
    assert.equal(await readFile(victim, "utf8"), "à conserver");
    await assert.rejects(stat(destination), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the orchestrator refuses a renamed source before any build work", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-restore-name-"));
  try {
    await assert.rejects(restoreSemanticV2({
      sourcePath: join(root, "renamed.vec"), corpusDir: join(root, "corpus"), targetsDir: join(root, "targets"),
      evidenceDir: join(root, "evidence"), cataloguePath: join(root, "catalogue.json"),
    }), /filename must remain wiki\.fr\.vec/);
    await assert.rejects(stat(join(root, "corpus")), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
