import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticIndex } from "../scripts/build-semantic-index-v2.mjs";
import { lookupSemanticWord, wordHash } from "../scripts/semantic-index-v2-common.mjs";
import { verifySemanticIndex } from "../scripts/verify-semantic-index-v2.mjs";

async function workspace() { const root = await mkdtemp(join(tmpdir(), "braise-index-v2-")); return { root, source: join(root, "source.vec"), corpus: join(root, "corpus"), index: join(root, "index") }; }

test("the exact paged index finds every canonical BRV2 identity without V1 folding", async () => {
  const paths = await workspace();
  try {
    const long = "a".repeat(17_000); const words = ["cote", "côte", "côté", "œuvre", "oeuvre", "l'homme", "école", long]; const rows = words.map((word, index) => `${word} ${index + 1} 1`).join("\n"); await writeFile(paths.source, `${words.length} 2\n${rows}`);
    await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 2, maxLineBytes: 32 * 1024 }); const manifest = await buildSemanticIndex({ corpusDir: paths.corpus, outputDir: paths.index }); assert.equal(manifest.stats.dictionarySize, words.length);
    for (let id = 0; id < words.length; id++) assert.equal(await lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: words[id] }), id);
    assert.equal(await lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: " ÉCOLE " }), 6); assert.equal(await lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: "e\u0301cole" }), 6); assert.equal(await lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: "l’homme" }), 5); assert.equal(await lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: "æuvre" }), null);
    assert.equal((await verifySemanticIndex({ corpusDir: paths.corpus, outputDir: paths.index })).dictionarySize, words.length);
  } finally { await rm(paths.root, { recursive: true, force: true }); }
});

test("the active index is adopted only after verification and detects immutable leaf corruption", async () => {
  const paths = await workspace();
  try {
    await writeFile(paths.source, "3 2\nalpha 1 0\nbêta 0 1\nomega -1 0"); await buildSemanticCorpus({ sourcePath: paths.source, outputDir: paths.corpus, segmentEntries: 1 }); const manifest = await buildSemanticIndex({ corpusDir: paths.corpus, outputDir: paths.index });
    const corpusActive = JSON.parse(await readFile(join(paths.corpus, "active.json"), "utf8"));
    const corpusManifest = JSON.parse(await readFile(join(paths.corpus, corpusActive.manifest), "utf8"));
    const indexDir = join(paths.index, corpusManifest.corpusId, "presence"); const alphaHash = wordHash(Buffer.from("alpha"));
    const prefixReference = manifest.prefixPages.find((page: { firstByte: number }) => page.firstByte === alphaHash[0]); assert.ok(prefixReference);
    const prefix = JSON.parse(await readFile(join(indexDir, "prefixes", prefixReference.file), "utf8"));
    const leaf = prefix.leaves.find((item: { secondByte: number }) => item.secondByte === alphaHash[1]); assert.ok(leaf);
    const leafPath = join(indexDir, "leaves", leaf.file); const bytes = await readFile(leafPath); bytes[Math.floor(bytes.length / 2)] ^= 1; await writeFile(leafPath, bytes);
    await assert.rejects(verifySemanticIndex({ corpusDir: paths.corpus, outputDir: paths.index }), /hash mismatch|decompress/i); await assert.rejects(lookupSemanticWord({ corpusDir: paths.corpus, outputDir: paths.index, word: "alpha" }), /hash mismatch|decompress/i);
  } finally { await rm(paths.root, { recursive: true, force: true }); }
});
