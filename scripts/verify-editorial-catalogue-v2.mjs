import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { corpusEntries, loadActiveCorpus } from "./semantic-target-v2-common.mjs";
import { verifySemanticTarget } from "./verify-semantic-target-v2.mjs";
import { preparedTarget } from "./build-editorial-catalogue-v2.mjs";

const HASH = /^[0-9a-f]{64}$/;
const WORD = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;

export async function verifyEditorialCatalogue({ corpusDir, targetsDir, cataloguePath }) {
  corpusDir = resolve(corpusDir); targetsDir = resolve(targetsDir);
  const corpus = await loadActiveCorpus(corpusDir); const catalogue = JSON.parse(await readFile(resolve(cataloguePath), "utf8"));
  if (catalogue.schemaVersion !== 1 || catalogue.status !== "inactive-editorial-workbench" || catalogue.corpus?.id !== corpus.manifest.corpusId || catalogue.corpus.manifestSha256 !== corpus.manifestSha256 || catalogue.corpus.semanticSha256 !== corpus.manifest.semanticSha256 || catalogue.corpus.dictionarySize !== corpus.manifest.stats.accepted || !Array.isArray(catalogue.entries) || catalogue.entries.length < 400) throw new Error("Contrat du catalogue B2 invalide");
  const ids = new Set(); const words = new Set(); const expectedWords = new Map(); const needed = new Set(); const neededHintWords = new Set(); let lexicalReviewed = 0; let evidenceReady = 0; let approved = 0;
  const rememberWord = (id, word) => { const prior = expectedWords.get(id); if (prior !== undefined && prior !== word) throw new Error(`Identité mot/id contradictoire: ${id}`); expectedWords.set(id, word); needed.add(id); };
  for (const entry of catalogue.entries) {
    if (!Number.isInteger(entry.targetId) || entry.targetId < 0 || entry.targetId >= corpus.manifest.stats.accepted || typeof entry.word !== "string" || !WORD.test(entry.word) || ids.has(entry.targetId) || words.has(entry.word) || !entry.review?.actor || !["agent", "human"].includes(entry.review.kind) || entry.review.decision !== "candidate" || !Number.isFinite(Date.parse(entry.review.reviewedAt)) || !["low", "medium", "high"].includes(entry.ambiguity) || !entry.category || !["agent-reviewed", "human-reviewed"].includes(entry.lexicalStatus) || entry.lexicalStatus !== `${entry.review.kind}-reviewed` || !["not-prepared", "verified-staging-column"].includes(entry.numericalStatus) || !Array.isArray(entry.neighborhood?.neighbors) || !Array.isArray(entry.hints?.words) || !["pending", "approved-agent", "approved-human", "rejected"].includes(entry.approval)) throw new Error(`Entrée éditoriale invalide: ${entry.targetId}`);
    ids.add(entry.targetId); words.add(entry.word); rememberWord(entry.targetId, entry.word); lexicalReviewed++;
    const neighborIds = new Set(); const neighborWords = new Set();
    for (const neighbor of entry.neighborhood.neighbors) { if (!Number.isInteger(neighbor.id) || neighbor.id < 0 || neighbor.id >= corpus.manifest.stats.accepted || typeof neighbor.word !== "string" || !WORD.test(neighbor.word) || neighbor.id === entry.targetId || neighbor.word === entry.word || neighborIds.has(neighbor.id) || neighborWords.has(neighbor.word)) throw new Error(`Voisin invalide: ${entry.targetId}`); neighborIds.add(neighbor.id); neighborWords.add(neighbor.word); rememberWord(neighbor.id, neighbor.word); }
    if (entry.hints.words.some(word => typeof word !== "string" || !WORD.test(word)) || new Set(entry.hints.words).size !== entry.hints.words.length) throw new Error(`Indice invalide: ${entry.targetId}`);
    for (const word of entry.hints.words) neededHintWords.add(word);
    if (entry.neighborhood.status === "evidence-ready-agent-review-pending" || entry.neighborhood.status === "reviewed-approved") evidenceReady++;
    if (entry.numericalStatus === "verified-staging-column") {
      if (!HASH.test(entry.neighborhood.targetManifestSha256)) throw new Error(`Preuve numérique absente: ${entry.targetId}`);
      const verified = await verifySemanticTarget({ corpusDir, outputDir: targetsDir, targetId: entry.targetId });
      if (verified.manifestSha256 !== entry.neighborhood.targetManifestSha256) throw new Error(`Preuve numérique divergente: ${entry.targetId}`);
      const prepared = await preparedTarget(targetsDir, corpus, entry.targetId);
      const expectedNeighbors = prepared.orderedIds.filter(id => id !== entry.targetId).slice(0, 12);
      if (JSON.stringify([...neighborIds]) !== JSON.stringify(expectedNeighbors)) throw new Error(`Ordre de voisinage divergent: ${entry.targetId}`);
    } else if (entry.neighborhood.neighbors.length || entry.neighborhood.targetManifestSha256) throw new Error(`Voisinage sans colonne vérifiée: ${entry.targetId}`);
    if (entry.approval.startsWith("approved")) {
      const approvalKind = entry.approval === "approved-human" ? "human" : "agent";
      if (entry.numericalStatus !== "verified-staging-column" || entry.neighborhood.status !== "reviewed-approved" || entry.neighborhood.neighbors.length < 6 || entry.hints.status !== "reviewed" || new Set(entry.hints.words).size < 3 || entry.hints.words.includes(entry.word) || entry.approvalReview?.kind !== approvalKind || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt))) throw new Error(`Approbation non prouvée: ${entry.targetId}`);
      approved++;
    } else if (entry.approval === "rejected") {
      if (entry.neighborhood.status !== "reviewed-rejected" || entry.numericalStatus !== "verified-staging-column" || entry.hints.status !== "not-reviewed" || entry.hints.words.length || !entry.approvalReview || !["agent", "human"].includes(entry.approvalReview.kind) || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt))) throw new Error(`Rejet non prouvé: ${entry.targetId}`);
    } else if (entry.approvalReview !== undefined) throw new Error(`Revue inattendue: ${entry.targetId}`);
  }
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) for (const entry of entries) {
    if (needed.has(entry.id)) { if (expectedWords.get(entry.id) !== entry.word) throw new Error(`Identité mot/id divergente: ${entry.id}`); needed.delete(entry.id); }
    neededHintWords.delete(entry.word);
  }
  if (needed.size || neededHintWords.size) throw new Error("Le catalogue référence des identifiants ou indices absents");
  if (catalogue.counts?.selected !== catalogue.entries.length || catalogue.counts.lexicalReviewed !== lexicalReviewed || catalogue.counts.neighborhoodEvidenceReady !== evidenceReady || catalogue.counts.approved !== approved || catalogue.status === "ready" && approved < 400) throw new Error("Compteurs éditoriaux invalides");
  return { corpusId: corpus.manifest.corpusId, selected: catalogue.entries.length, lexicalReviewed, evidenceReady, approved };
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Arguments B2 invalides"); values[argv[index].slice(2)] = argv[index + 1]; }
  for (const key of ["corpus", "targets", "catalogue"]) if (!values[key]) throw new Error(`--${key} est requis`); return values;
}
if (process.argv[1] && basename(process.argv[1]) === "verify-editorial-catalogue-v2.mjs") { const args = parseArgs(process.argv.slice(2)); verifyEditorialCatalogue({ corpusDir: args.corpus, targetsDir: args.targets, cataloguePath: args.catalogue }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; }); }
