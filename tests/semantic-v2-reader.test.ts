import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSemanticCorpus } from "../scripts/build-semantic-corpus-v2.mjs";
import { buildSemanticIndex } from "../scripts/build-semantic-index-v2.mjs";
import { buildSemanticTarget } from "../scripts/build-semantic-target-v2.mjs";
import { SemanticV2Reader, type V2Pins } from "../lib/semantic-v2-reader";

test("transport-independent V2 reader uses exact words and actual paged scores", async () => {
  const root = await mkdtemp(join(tmpdir(), "braise-reader-"));
  try {
    const source = join(root, "source.vec"), corpus = join(root, "corpus"), output = join(root, "objects");
    await writeFile(source, "5 2\ncote 1 0\ncôte 0 1\nl'homme -1 0\nœuvre 1 1\ncopie 1 0\n");
    const manifest = await buildSemanticCorpus({ sourcePath: source, outputDir: corpus });
    await buildSemanticIndex({ corpusDir: corpus, outputDir: output });
    await buildSemanticTarget({ corpusDir: corpus, outputDir: output, targetId: 0 });
    const active = JSON.parse(await readFile(join(corpus, "active.json"), "utf8"));
    const index = JSON.parse(await readFile(join(output, manifest.corpusId, "presence/active.json"), "utf8"));
    const target = JSON.parse(await readFile(join(output, manifest.corpusId, "targets/0000000000/active.json"), "utf8"));
    const pins: V2Pins = { corpusId: manifest.corpusId, manifestSha256: active.manifestSha256, semanticSha256: manifest.semanticSha256, dictionarySize: 5, index: { key: `${manifest.corpusId}/presence/${index.manifest}`, sha256: index.manifestSha256 }, targets: { "0": { key: `${manifest.corpusId}/targets/0000000000/${target.manifest}`, sha256: target.manifestSha256 } } };
    const reader = new SemanticV2Reader(pins, async (key, maximum) => { const bytes = await readFile(join(output, key)); assert.ok(bytes.length <= maximum); return bytes; });
    assert.deepEqual(await reader.lookup(" CÔTE "), { word: "côte", id: 1 });
    assert.deepEqual(await reader.lookup("l’homme"), { word: "l'homme", id: 2 });
    assert.equal(await reader.lookup("oeuvre"), null);
    assert.deepEqual(await reader.evaluate(0, 0), { temperature: 100, rank: 1, found: true });
    assert.deepEqual(await reader.evaluate(0, 1), { temperature: 0, rank: 4, found: false });
    assert.deepEqual(await reader.evaluate(0, 2), { temperature: -100, rank: 5, found: false });
    assert.deepEqual(await reader.evaluate(0, 4), { temperature: 99.9, rank: 1, found: false });
    await assert.rejects(reader.evaluate(1, 0), /not-prepared/);
    await assert.rejects(reader.evaluate(0, 5), /range/);
    await assert.rejects(reader.lookup("a".repeat(65537)), /input-too-long/);
    const aliases: Uint8Array[] = [];
    const owned = new SemanticV2Reader(pins, async key => { const bytes = await readFile(join(output, key)); aliases.push(bytes); return bytes; });
    assert.equal((await owned.lookup("cote"))?.id, 0);
    for (const bytes of aliases) bytes.fill(0);
    assert.equal((await owned.lookup("cote"))?.id, 0);
    const corrupt = new SemanticV2Reader(pins, async key => { const bytes = await readFile(join(output, key)); bytes[0] ^= 1; return bytes; });
    await assert.rejects(corrupt.lookup("cote"), /integrity/);
    let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
    const bounded = new SemanticV2Reader(pins, async key => { await gate; return readFile(join(output, key)); });
    const waiting = [0, 1, 2, 3].map(() => bounded.lookup("cote"));
    await assert.rejects(bounded.lookup("cote"), /busy/); release(); await Promise.all(waiting);
  } finally { await rm(root, { recursive: true, force: true }); }
});
