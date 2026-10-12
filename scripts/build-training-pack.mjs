// Build a finite, public, noncompetitive pack. V1 inputs are read-only.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";

const verify = process.argv.includes("--verify");
if (process.argv.slice(2).some(arg => arg !== "--verify")) throw new Error("Usage: node scripts/build-training-pack.mjs [--verify]");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value));
const baseline = JSON.parse(await readFile("docs/program/BASELINE.json", "utf8"));
const indexBytes = await readFile("data/semantic-v1-index.json");
if (hash(indexBytes) !== "6f7135f02473c70f0b13fbd62709fc23a1b2ca45294b7c2cdaef29a2c691f137") throw new Error("Frozen index mismatch");
const index = JSON.parse(indexBytes);
const source = await readFile("data/semantic-fr.json");
if (hash(source) !== baseline.corpus_sha256) throw new Error("Frozen V1 corpus mismatch");

// Independent executable oracle: the original V1 implementation at the pinned
// Git revision, not this producer's segment decoder or current semantic reader.
await mkdir("work/training-reference", { recursive: true });
const referenceSource = execFileSync("git", ["show", `${baseline.source_commit}:lib/semantic.ts`], { maxBuffer: 1024 * 1024 });
await writeFile("work/training-reference/semantic.ts", referenceSource);
await writeFile("work/training-reference/game-types.ts", execFileSync("git", ["show", `${baseline.source_commit}:lib/game-types.ts`], { maxBuffer: 1024 * 1024 }));
await build({ entryPoints: ["work/training-reference/semantic.ts"], outfile: "work/training-reference/oracle.mjs", bundle: true, platform: "node", format: "esm", alias: { "@/data/semantic-fr.json": resolve("data/semantic-fr.json") }, logLevel: "warning" });
const reference = await import(pathToFileURL(resolve("work/training-reference/oracle.mjs")).href);
const id = "training-v1-editorial-1";
// Editorial review 2026-10-12: concrete object -> polysemous place -> abstract
// disposition. These are explained guidance levels, NOT measured difficulty.
const reviewed = [
  { word: "pomme", level: "Facile", definition: "Un objet concret du quotidien ; les indices passent d’une famille à un détail distinctif.", hints: ["Cherchez du côté de l’alimentation.", "C’est un fruit qui pousse sur un arbre.", "On la récolte sur un pommier ; elle peut être verte, jaune ou rouge."] },
  { word: "port", level: "Standard", definition: "Un mot qui a plusieurs sens ; les indices resserrent progressivement vers un lieu.", hints: ["Pensez aux déplacements et aux échanges.", "On cherche ici un lieu, au bord de l’eau.", "Les bateaux y accostent pour charger ou débarquer."] },
  { word: "curiosité", level: "Exploration", definition: "Une disposition abstraite ; cherchez une idée plutôt qu’un objet.", hints: ["Cherchez une disposition de l’esprit.", "Elle pousse à poser des questions et à découvrir.", "C’est le désir de savoir, parfois qualifié d’indiscret."] },
];
const additions = "fruit arbre rouge vert jaune bateau navire eau voyage mer océan plage marin commerce transport question savoir connaissance découverte apprendre recherche science intérêt désir esprit objet aliment manger jardin fleur forêt livre école ville maison animal chat chien montagne soleil lune musique justice fromage ordinateur enfant famille voiture vélo avion train histoire couleur table chaise fenêtre porte terre ciel vent feu froid chaud temps travail argent liberté joie tristesse colère attention patience surprise banane orange poire pêche prune cerise abricot raisin citron ananas mangue fraise melon pastèque pommier récolte quai embarquer débarquer navigation lac fleuve canal maritime cargo voilier ferry industrie enquête comprendre intelligence observer explorer étrange secret mystère réponse pensée imagination".split(" ");
const vocabulary = [...new Set([...baseline.v1_target_order, ...additions])].filter(word => index.words.includes(word)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const puzzles = [];
let comparisons = 0;
for (const [ordinal, entry] of reviewed.entries()) {
  const targetIndex = index.puzzles.findIndex(p => p.word === entry.word);
  const segment = index.segments[targetIndex];
  const compressed = await readFile(`public/${segment.key}`);
  if (hash(compressed) !== segment.objectSha256) throw new Error("Frozen segment checksum mismatch");
  const bytes = gunzipSync(compressed);
  if (hash(bytes) !== segment.rawSha256) throw new Error("Frozen decoded segment checksum mismatch");
  const scores = vocabulary.map(word => {
    const position = index.words.indexOf(word);
    const found = word === entry.word;
    const score = { word, temperature: found ? 100 : Math.min(99.9, Math.round(bytes.readInt16LE(bytes.readUInt32LE(20) + position * 2) / 10) / 10), rank: found ? 1 : bytes.readUInt16LE(bytes.readUInt32LE(24) + position * 2), found };
    const actual = reference.evaluateWord(targetIndex, reference.findWord(word));
    if (JSON.stringify(score) !== JSON.stringify(actual)) throw new Error(`Independent V1 mismatch: ${entry.word}/${word}`);
    comparisons++;
    return score;
  });
  puzzles.push({ id: `${id}-${ordinal + 1}`, level: entry.level, definition: entry.definition, hints: entry.hints, scores });
}
const pack = json({ schema: 1, id, sourceCommit: baseline.source_commit, corpusSha256: baseline.corpus_sha256, rankScope: baseline.dictionary_size, vocabulary, puzzles });
const packHash = hash(pack);
const packPath = `/training/pack-${packHash}.json`;
async function output(path, bytes) {
  if (verify) { if (!(await readFile(path)).equals(Buffer.from(bytes))) throw new Error(`Nonreproducible training asset: ${path}`); }
  else await writeFile(path, bytes);
}
await mkdir("public/training", { recursive: true });
await output(`public${packPath}`, pack);
await output("public/training/pack-info.json", json({ schema: 1, id, path: packPath, bytes: pack.length, sha256: packHash, wordCount: vocabulary.length, sourceCommit: baseline.source_commit, corpusSha256: baseline.corpus_sha256 }));
const bundle = await build({ entryPoints: ["scripts/training-shell.tsx"], outfile: "work/training-reference/shell.js", bundle: true, platform: "browser", format: "esm", target: "es2022", minify: true, write: false, metafile: true, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning" });
if (Object.keys(bundle.metafile.inputs).some(path => /(?:^|\/)data\//.test(path) || /lib\/semantic/.test(path))) throw new Error("Full semantic data or server reader leaked into client shell");
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).contents;
const jsPath = `/training/shell-${hash(js)}.js`;
const cssPath = `/training/style-${hash(css)}.css`;
const html = Buffer.from(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#191919"><title>Entraînement guidé · BRAIZ</title><link rel="stylesheet" href="${cssPath}"></head><body style="margin:0"><div id="training-root"></div><noscript>Activez JavaScript pour jouer à ce pack d’entraînement.</noscript><script type="module" src="${jsPath}"></script></body></html>`);
const shellPath = `/training/screen-${hash(html)}.html`;
const assets = [[packPath, pack], [jsPath, js], [cssPath, css], [shellPath, html]].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) }));
for (const [path, bytes] of [[jsPath, js], [cssPath, css], [shellPath, html]]) await output(`public${path}`, bytes);
const manifest = { schema: 1, packSha256: packHash, wordCount: vocabulary.length, puzzleCount: 3, shellPath, assets, totalBytes: 0 };
// Include the manifest itself in the exact uncompressed download byte count.
for (let i = 0; i < 5; i++) manifest.totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0) + json(manifest).length;
const manifestBytes = json(manifest);
const manifestPath = `/training/manifest-${hash(manifestBytes)}.json`;
await output(`public${manifestPath}`, manifestBytes);
await output("public/training/manifest.json", manifestBytes);
const worker = await readFile("public/sw.js", "utf8");
const pin = `// BEGIN TRAINING PIN\nconst TRAINING_PIN = ${JSON.stringify({ path: manifestPath, sha256: hash(manifestBytes), bytes: manifestBytes.length, packSha256: packHash, totalBytes: manifest.totalBytes, wordCount: vocabulary.length, puzzleCount: 3 })};\n// END TRAINING PIN`.replaceAll("\n", worker.includes("\r\n") ? "\r\n" : "\n");
if (!/\/\/ BEGIN TRAINING PIN[\s\S]*?\/\/ END TRAINING PIN/.test(worker)) throw new Error("Missing worker training pin");
await output("public/sw.js", worker.replace(/\/\/ BEGIN TRAINING PIN[\s\S]*?\/\/ END TRAINING PIN/, pin));
console.log(JSON.stringify({ mode: verify ? "verified" : "generated", comparisons, sourceCommit: baseline.source_commit, oracleSourceSha256: hash(referenceSource), packSha256: packHash, words: vocabulary.length, puzzles: 3, packBytes: pack.length, totalOfflineBytes: manifest.totalBytes, manifestPath }));
