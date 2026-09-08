import { readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { loadActiveCorpus, corpusEntries } from "./semantic-target-v2-common.mjs";

const [corpusArgument, objectsArgument] = process.argv.slice(2);
if (!corpusArgument || !objectsArgument) throw new Error("Usage: node scripts/qualify-semantic-v2-reader.mjs CORPUS OBJECTS");
const corpusDir = resolve(corpusArgument), objectsDir = resolve(objectsArgument);
const started = Date.now();
const corpus = await loadActiveCorpus(corpusDir);
const { manifest, manifestSha256 } = corpus;
const index = JSON.parse(await readFile(join(objectsDir, manifest.corpusId, "presence/active.json"), "utf8"));
const targets = {};
for (const id of [0, manifest.stats.accepted - 1]) {
  const base = `${manifest.corpusId}/targets/${String(id).padStart(10, "0")}/`;
  const active = JSON.parse(await readFile(join(objectsDir, base, "active.json"), "utf8"));
  targets[id] = { key: base + active.manifest, sha256: active.manifestSha256 };
}
const pins = { corpusId: manifest.corpusId, manifestSha256, semanticSha256: manifest.semanticSha256, dictionarySize: manifest.stats.accepted, index: { key: `${manifest.corpusId}/presence/${index.manifest}`, sha256: index.manifestSha256 }, targets };
const compiled = await build({ entryPoints: ["lib/semantic-v2-reader.ts"], bundle: true, write: false, platform: "node", format: "esm", target: "node22" });
const { SemanticV2Reader } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
let loads = 0, loadedBytes = 0;
const reader = new SemanticV2Reader(pins, async (key, maximum) => {
  const path = join(objectsDir, key); const info = await stat(path);
  if (info.size > maximum) throw new Error("Bounded transport rejected oversized object");
  const bytes = await readFile(path); loads++; loadedBytes += bytes.length; return bytes;
});
const selected = new Set([0, 65536, Math.floor(manifest.stats.accepted / 2), manifest.stats.accepted - 1]);
const evidence = [];
for await (const { entries } of corpusEntries(corpusDir, manifest)) {
  for (const entry of entries) {
    if (!selected.has(entry.id)) continue;
    const result = await reader.lookup(entry.word);
    if (result?.id !== entry.id || result.word !== entry.word) throw new Error(`Runtime lookup mismatch at ${entry.id}`);
    const values = [];
    for (const target of Object.keys(targets).map(Number)) {
      const evaluation = await reader.evaluate(target, entry.id);
      if (evaluation.found !== (target === entry.id)) throw new Error("Runtime identity mismatch");
      values.push({ target, ...evaluation });
    }
    evidence.push({ id: entry.id, word: entry.word, values });
  }
}
if (evidence.length !== selected.size) throw new Error("Qualification samples missing");
console.log(JSON.stringify({ scope: "real-corpus-local-transport-not-hosted-R2", pins, samples: evidence, loads, loadedBytes, elapsedMs: Date.now() - started, maxRssKiB: process.resourceUsage().maxRSS }, null, 2));
