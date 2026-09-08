import { lstat, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { acquireTargetCacheGuard, corpusEntries, loadActiveCorpus, releaseTargetCacheGuard } from "./semantic-target-v2-common.mjs";
import { loadEditorialEvidence, verifyEditorialEvidence } from "./editorial-evidence-v2.mjs";
import { verifySemanticTargetUnderGuard } from "./verify-semantic-target-v2.mjs";

const HASH = /^[0-9a-f]{64}$/;
const WORD = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;

export async function verifyEditorialCatalogue({ corpusDir, targetsDir, evidenceDir, cataloguePath }) {
  corpusDir = resolve(corpusDir); targetsDir = resolve(targetsDir); evidenceDir = resolve(evidenceDir);
  const corpus = await loadActiveCorpus(corpusDir); const catalogue = JSON.parse(await readFile(resolve(cataloguePath), "utf8"));
  if (catalogue.schemaVersion !== 1 || catalogue.status !== "inactive-editorial-workbench" || catalogue.corpus?.id !== corpus.manifest.corpusId || catalogue.corpus.manifestSha256 !== corpus.manifestSha256 || catalogue.corpus.semanticSha256 !== corpus.manifest.semanticSha256 || catalogue.corpus.dictionarySize !== corpus.manifest.stats.accepted || !Array.isArray(catalogue.entries) || catalogue.entries.length < 400) throw new Error("Contrat du catalogue B2 invalide");
  const ids = new Set(); const words = new Set(); const expectedWords = new Map(); const needed = new Set(); let lexicalReviewed = 0; let evidenceReady = 0; let approved = 0;
  const rememberWord = (id, word) => { const prior = expectedWords.get(id); if (prior !== undefined && prior !== word) throw new Error(`Identité mot/id contradictoire: ${id}`); expectedWords.set(id, word); needed.add(id); };
  const evidencedEntries = [];
  for (const entry of catalogue.entries) {
    if (!Number.isInteger(entry.targetId) || entry.targetId < 0 || entry.targetId >= corpus.manifest.stats.accepted || typeof entry.word !== "string" || !WORD.test(entry.word) || ids.has(entry.targetId) || words.has(entry.word) || !entry.review?.actor || !["agent", "human"].includes(entry.review.kind) || entry.review.decision !== "candidate" || !Number.isFinite(Date.parse(entry.review.reviewedAt)) || !["low", "medium", "high"].includes(entry.ambiguity) || !entry.category || !["agent-reviewed", "human-reviewed"].includes(entry.lexicalStatus) || entry.lexicalStatus !== `${entry.review.kind}-reviewed` || !["not-prepared", "verified-staging-column", "verified-archived-evidence"].includes(entry.numericalStatus) || !Array.isArray(entry.neighborhood?.neighbors) || !Array.isArray(entry.hints?.words) || !["pending", "approved-agent", "approved-human", "rejected"].includes(entry.approval)) throw new Error(`Entrée éditoriale invalide: ${entry.targetId}`);
    ids.add(entry.targetId); words.add(entry.word); rememberWord(entry.targetId, entry.word); lexicalReviewed++;
    const neighborIds = new Set(); const neighborWords = new Set();
    for (const neighbor of entry.neighborhood.neighbors) { if (!Number.isInteger(neighbor.id) || neighbor.id < 0 || neighbor.id >= corpus.manifest.stats.accepted || typeof neighbor.word !== "string" || !WORD.test(neighbor.word) || neighbor.id === entry.targetId || neighbor.word === entry.word || neighborIds.has(neighbor.id) || neighborWords.has(neighbor.word)) throw new Error(`Voisin invalide: ${entry.targetId}`); neighborIds.add(neighbor.id); neighborWords.add(neighbor.word); rememberWord(neighbor.id, neighbor.word); }
    if (entry.hints.words.some(word => typeof word !== "string" || !WORD.test(word)) || new Set(entry.hints.words).size !== entry.hints.words.length) throw new Error(`Indice invalide: ${entry.targetId}`);
    let evidencePayload = null;
    if (entry.neighborhood.status === "evidence-ready-agent-review-pending" || entry.neighborhood.status === "reviewed-approved") evidenceReady++;
    if (entry.numericalStatus === "not-prepared") {
      if (entry.neighborhood.status !== "not-measured" || entry.neighborhood.neighbors.length || entry.neighborhood.targetManifestSha256 || entry.neighborhood.evidenceSha256 || entry.hints.status !== "not-reviewed" || entry.hints.words.length || entry.approval !== "pending" || entry.approvalReview !== undefined || entry.approvalHistory !== undefined) throw new Error(`État non préparé incohérent: ${entry.targetId}`);
    } else {
      if (!HASH.test(entry.neighborhood.targetManifestSha256) || !HASH.test(entry.neighborhood.evidenceSha256)) throw new Error(`Preuve numérique absente: ${entry.targetId}`);
      const evidence = await loadEditorialEvidence({ corpus, evidenceDir, targetId: entry.targetId, expectedSha256: entry.neighborhood.evidenceSha256 });
      evidencePayload = evidence.payload;
      if (evidence.payload.targetManifest.sha256 !== entry.neighborhood.targetManifestSha256 || (evidence.payload.supersedesEvidenceSha256 ?? null) !== (entry.neighborhood.supersedesEvidenceSha256 ?? null) || JSON.stringify(evidence.payload.neighborhood.entries.map(item => item.id)) !== JSON.stringify([...neighborIds])) throw new Error(`Preuve éditoriale divergente: ${entry.targetId}`);
      evidencedEntries.push(entry);
    }
    if (entry.approval.startsWith("approved")) {
      const approvalKind = entry.approval === "approved-human" ? "human" : "agent";
      if (entry.numericalStatus === "not-prepared" || entry.neighborhood.status !== "reviewed-approved" || entry.neighborhood.neighbors.length < 6 || entry.hints.status !== "reviewed" || entry.hints.words.length !== 3 || entry.hints.words.some(word => word === entry.word || !neighborWords.has(word)) || entry.approvalReview?.kind !== approvalKind || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt)) || entry.approvalReview.evidenceSha256 !== entry.neighborhood.evidenceSha256 || entry.approvalReview.supersedesEvidenceSha256 !== undefined && !HASH.test(entry.approvalReview.supersedesEvidenceSha256)) throw new Error(`Approbation non prouvée: ${entry.targetId}`);
      approved++;
    } else if (entry.approval === "rejected") {
      if (entry.neighborhood.status !== "reviewed-rejected" || entry.numericalStatus === "not-prepared" || entry.hints.status !== "not-reviewed" || entry.hints.words.length || !entry.approvalReview || !["agent", "human"].includes(entry.approvalReview.kind) || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt)) || entry.approvalReview.evidenceSha256 !== entry.neighborhood.evidenceSha256 || entry.approvalReview.supersedesEvidenceSha256 !== undefined && !HASH.test(entry.approvalReview.supersedesEvidenceSha256)) throw new Error(`Rejet non prouvé: ${entry.targetId}`);
    } else if (entry.approvalReview !== undefined || entry.numericalStatus !== "not-prepared" && (entry.neighborhood.status !== "evidence-ready-agent-review-pending" || entry.hints.status !== "not-reviewed" || entry.hints.words.length)) throw new Error(`État éditorial en attente incohérent: ${entry.targetId}`);
    if (entry.approvalHistory !== undefined) {
      if (!Array.isArray(entry.approvalHistory) || entry.approvalHistory.length < 2) throw new Error(`Historique éditorial invalide: ${entry.targetId}`);
      const hashes = new Set();
      for (let historyIndex = 0; historyIndex < entry.approvalHistory.length; historyIndex++) {
        const fact = entry.approvalHistory[historyIndex]; const previous = entry.approvalHistory[historyIndex - 1];
        if (!fact || fact.targetId !== entry.targetId || !["approved", "rejected"].includes(fact.decision) || !["agent", "human"].includes(fact.kind) || !fact.actor || !Number.isFinite(Date.parse(fact.reviewedAt)) || !fact.rationale || !Array.isArray(fact.hints) || fact.hints.some(word => typeof word !== "string" || !WORD.test(word)) || new Set(fact.hints).size !== fact.hints.length || fact.decision === "approved" && fact.hints.length !== 3 || fact.decision === "rejected" && fact.hints.length || !HASH.test(fact.evidenceSha256) || hashes.has(fact.evidenceSha256) || !previous && fact.supersedesEvidenceSha256 !== undefined || previous && (fact.supersedesEvidenceSha256 !== previous.evidenceSha256 || Date.parse(fact.reviewedAt) < Date.parse(previous.reviewedAt))) throw new Error(`Historique éditorial invalide: ${entry.targetId}`);
        await loadEditorialEvidence({ corpus, evidenceDir, targetId: entry.targetId, expectedSha256: fact.evidenceSha256 }); hashes.add(fact.evidenceSha256);
      }
      const current = entry.approvalHistory.at(-1);
      if (!entry.approvalReview || current.evidenceSha256 !== entry.approvalReview.evidenceSha256 || current.supersedesEvidenceSha256 !== entry.approvalReview.supersedesEvidenceSha256 || current.actor !== entry.approvalReview.actor || current.kind !== entry.approvalReview.kind || current.reviewedAt !== entry.approvalReview.reviewedAt || current.rationale !== entry.approvalReview.rationale || current.decision !== (entry.approval.startsWith("approved") ? "approved" : "rejected") || JSON.stringify(current.hints) !== JSON.stringify(entry.hints.words) || evidencePayload?.supersedesEvidenceSha256 !== current.supersedesEvidenceSha256) throw new Error(`Historique éditorial divergent: ${entry.targetId}`);
    } else if (entry.approvalReview?.supersedesEvidenceSha256 !== undefined || entry.approval !== "pending" && evidencePayload?.supersedesEvidenceSha256) throw new Error(`Historique éditorial absent: ${entry.targetId}`);
  }
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) for (const entry of entries) {
    if (needed.has(entry.id)) { if (expectedWords.get(entry.id) !== entry.word) throw new Error(`Identité mot/id divergente: ${entry.id}`); needed.delete(entry.id); }
  }
  if (needed.size) throw new Error("Le catalogue référence des identifiants absents");
  for (const entry of evidencedEntries) await verifyEditorialEvidence({ corpusDir, evidenceDir, targetId: entry.targetId, expectedSha256: entry.neighborhood.evidenceSha256 });
  const targetRoot = join(targetsDir, corpus.manifest.corpusId, "targets"); const guard = acquireTargetCacheGuard(targetRoot, "shared");
  try {
    for (const entry of evidencedEntries) {
      const targetDir = join(targetRoot, String(entry.targetId).padStart(10, "0")); let live = true;
      try {
        const info = await lstat(targetDir);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Dossier de colonne actif non sûr: ${entry.targetId}`);
      } catch (error) { if (error?.code === "ENOENT") live = false; else throw error; }
      if (live) {
        const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir: targetsDir, targetId: entry.targetId }, guard);
        if (verified.manifestSha256 !== entry.neighborhood.targetManifestSha256) throw new Error(`Colonne active divergente: ${entry.targetId}`);
      }
      if (live !== (entry.numericalStatus === "verified-staging-column")) throw new Error(`Disponibilité de colonne inexacte: ${entry.targetId}`);
    }
  } finally { releaseTargetCacheGuard(guard); }
  if (catalogue.counts?.selected !== catalogue.entries.length || catalogue.counts.lexicalReviewed !== lexicalReviewed || catalogue.counts.neighborhoodEvidenceReady !== evidenceReady || catalogue.counts.approved !== approved || catalogue.status === "ready" && approved < 400) throw new Error("Compteurs éditoriaux invalides");
  return { corpusId: corpus.manifest.corpusId, selected: catalogue.entries.length, lexicalReviewed, evidenceReady, approved };
}

function parseArgs(argv) {
  const values = {}; for (let index = 0; index < argv.length; index += 2) { if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Arguments B2 invalides"); values[argv[index].slice(2)] = argv[index + 1]; }
  for (const key of ["corpus", "targets", "evidence", "catalogue"]) if (!values[key]) throw new Error(`--${key} est requis`); return values;
}
if (process.argv[1] && basename(process.argv[1]) === "verify-editorial-catalogue-v2.mjs") { const args = parseArgs(process.argv.slice(2)); verifyEditorialCatalogue({ corpusDir: args.corpus, targetsDir: args.targets, evidenceDir: args.evidence, cataloguePath: args.catalogue }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; }); }
