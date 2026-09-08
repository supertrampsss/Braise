import { loadActiveCorpus, corpusEntries } from "./semantic-target-v2-common.mjs";
const [corpusDir, limitArgument = "4000"] = process.argv.slice(2);
const limit = Number(limitArgument);
if (!corpusDir || !Number.isInteger(limit) || limit < 1 || limit > 20000) throw new Error("Usage: node scripts/export-semantic-candidates.mjs CORPUS [LIMIT<=20000]");
const { manifest, manifestSha256 } = await loadActiveCorpus(corpusDir);
const candidates = [];
for await (const { entries } of corpusEntries(corpusDir, manifest)) {
  for (const entry of entries) {
    if (entry.word.length >= 4 && entry.word.length <= 20 && !entry.word.includes("'") && !entry.word.includes("-")) candidates.push({ id: entry.id, word: entry.word });
    if (candidates.length === limit) break;
  }
  if (candidates.length === limit) break;
}
console.log(JSON.stringify({ corpusId: manifest.corpusId, manifestSha256, status: "candidates-not-editorially-approved", candidates }, null, 2));
