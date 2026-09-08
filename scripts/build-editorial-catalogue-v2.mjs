import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { acquireTargetCacheGuard, assertTargetCacheGuard, corpusEntries, loadActiveCorpus, releaseTargetCacheGuard, sha256, stableJson } from "./semantic-target-v2-common.mjs";

const HASH = /^[0-9a-f]{64}$/;
const PAGE_HEADER_BYTES = 64;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Arguments B2 invalides");
    values[argv[index].slice(2)] = argv[index + 1];
  }
  for (const key of ["corpus", "targets", "selection", "output"]) if (!values[key]) throw new Error(`--${key} est requis`);
  return values;
}

function flattenSelection(selection) {
  if (selection?.schemaVersion !== 1 || selection.status !== "lexical-agent-reviewed-neighbors-pending" || !Array.isArray(selection.reviews)) throw new Error("Sélection éditoriale invalide");
  const entries = [];
  for (const review of selection.reviews) {
    if (review.kind !== "agent" || typeof review.actor !== "string" || !review.actor || !Number.isFinite(Date.parse(review.reviewedAt)) || !review.groups || Array.isArray(review.groups)) throw new Error("Preuve de revue lexicale invalide");
    for (const [group, ids] of Object.entries(review.groups)) {
      const dot = group.lastIndexOf("."); const category = group.slice(0, dot); const ambiguity = group.slice(dot + 1);
      if (!category || !["low", "medium"].includes(ambiguity) || !Array.isArray(ids)) throw new Error(`Groupe éditorial invalide: ${group}`);
      for (const targetId of ids) entries.push({ targetId, category, ambiguity, review: { actor: review.actor, kind: review.kind, reviewedAt: review.reviewedAt, decision: "candidate" } });
    }
  }
  const ids = entries.map(entry => entry.targetId);
  if (ids.length < 400 || ids.some(id => !Number.isInteger(id) || id < 0) || new Set(ids).size !== ids.length) throw new Error("La sélection doit contenir au moins 400 identifiants uniques");
  const byId = new Map(entries.map(entry => [entry.targetId, entry]));
  for (const correction of selection.corrections ?? []) {
    const entry = byId.get(correction.targetId);
    if (!entry || correction.kind !== "agent" || !correction.actor || !Number.isFinite(Date.parse(correction.reviewedAt)) || !correction.reason || correction.category !== undefined && (typeof correction.category !== "string" || !correction.category) || correction.ambiguity !== undefined && !["low", "medium", "high"].includes(correction.ambiguity)) throw new Error(`Correction éditoriale invalide: ${correction.targetId}`);
    if (correction.category !== undefined) entry.category = correction.category;
    if (correction.ambiguity !== undefined) entry.ambiguity = correction.ambiguity;
    entry.corrections ??= []; entry.corrections.push({ actor: correction.actor, kind: correction.kind, reviewedAt: correction.reviewedAt, reason: correction.reason });
  }
  return entries;
}

async function readPreparedTarget(targetsRoot, corpus, targetId, guard) {
  assertTargetCacheGuard(guard, join(targetsRoot, corpus.manifest.corpusId, "targets"));
  const targetDir = join(targetsRoot, corpus.manifest.corpusId, "targets", String(targetId).padStart(10, "0"));
  let activeBytes;
  try { activeBytes = await readFile(join(targetDir, "active.json")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  const active = JSON.parse(activeBytes.toString("utf8"));
  if (active.targetId !== targetId || active.corpusId !== corpus.manifest.corpusId || basename(active.manifest) !== active.manifest || !HASH.test(active.manifestSha256)) throw new Error(`Pointeur de cible invalide: ${targetId}`);
  const manifestBytes = await readFile(join(targetDir, active.manifest));
  if (sha256(manifestBytes) !== active.manifestSha256) throw new Error(`Empreinte de cible invalide: ${targetId}`);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.complete !== true || manifest.format !== "BRT2-pages" || manifest.target?.id !== targetId || manifest.corpus?.id !== corpus.manifest.corpusId || manifest.corpus.manifestSha256 !== corpus.manifestSha256 || manifest.corpus.semanticSha256 !== corpus.manifest.semanticSha256 || manifest.stats?.dictionarySize !== corpus.manifest.stats.accepted || !Array.isArray(manifest.orderPages) || manifest.orderPages.length < 1) throw new Error(`Contrat de cible invalide: ${targetId}`);
  const page = manifest.orderPages[0];
  if (basename(page.file) !== page.file || !HASH.test(page.objectSha256) || !HASH.test(page.rawSha256) || page.firstPosition !== 0 || page.count < 13) throw new Error(`Première page de voisinage invalide: ${targetId}`);
  const compressed = await readFile(join(targetDir, "pages", page.file));
  if (compressed.length !== page.compressedBytes || sha256(compressed) !== page.objectSha256) throw new Error(`Objet de voisinage invalide: ${targetId}`);
  const raw = gunzipSync(compressed, { maxOutputLength: 4 * 1024 * 1024 });
  if (raw.length !== page.rawBytes || sha256(raw) !== page.rawSha256 || raw.toString("ascii", 0, 4) !== "BSO2" || raw.readUInt32LE(8) !== targetId || raw.readUInt32LE(12) !== 0 || raw.readUInt32LE(16) !== page.count || raw.readUInt32LE(24) !== PAGE_HEADER_BYTES) throw new Error(`Page de voisinage invalide: ${targetId}`);
  const orderedIds = [];
  for (let index = 0; index < Math.min(page.count, 24); index++) orderedIds.push(raw.readUInt32LE(PAGE_HEADER_BYTES + index * 4));
  return { manifestSha256: active.manifestSha256, orderedIds };
}

export async function preparedTarget(targetsRoot, corpus, targetId) {
  targetsRoot = resolve(targetsRoot); const root = join(targetsRoot, corpus.manifest.corpusId, "targets"); const guard = acquireTargetCacheGuard(root, "shared");
  try { return await readPreparedTarget(targetsRoot, corpus, targetId, guard); }
  finally { releaseTargetCacheGuard(guard); }
}

export async function buildEditorialCatalogue({ corpusDir, targetsDir, selectionPath, outputPath }) {
  const corpus = await loadActiveCorpus(resolve(corpusDir));
  const selection = JSON.parse(await readFile(resolve(selectionPath), "utf8"));
  if (selection.corpusId !== corpus.manifest.corpusId || selection.corpusManifestSha256 !== corpus.manifestSha256 || selection.semanticSha256 !== corpus.manifest.semanticSha256) throw new Error("La sélection ne correspond pas au corpus actif");
  const selected = flattenSelection(selection);
  const prepared = new Map(); const requiredIds = new Set(selected.map(entry => entry.targetId)); const resolvedTargets = resolve(targetsDir); const targetRoot = join(resolvedTargets, corpus.manifest.corpusId, "targets"); const guard = acquireTargetCacheGuard(targetRoot, "shared");
  try { for (const entry of selected) { const target = await readPreparedTarget(resolvedTargets, corpus, entry.targetId, guard); if (target) { prepared.set(entry.targetId, target); for (const id of target.orderedIds) requiredIds.add(id); } } }
  finally { releaseTargetCacheGuard(guard); }
  const words = new Map();
  for await (const { entries } of corpusEntries(resolve(corpusDir), corpus.manifest)) for (const entry of entries) if (requiredIds.has(entry.id)) words.set(entry.id, entry.word);
  if ([...requiredIds].some(id => !words.has(id))) throw new Error("Un identifiant éditorial est absent du corpus");
  const decisions = new Map();
  for (const decision of selection.decisions ?? []) {
    if (!Number.isInteger(decision.targetId) || decisions.has(decision.targetId) || !["approved", "rejected"].includes(decision.decision) || decision.kind !== "agent" && decision.kind !== "human" || !decision.actor || !Number.isFinite(Date.parse(decision.reviewedAt)) || !decision.rationale || !Array.isArray(decision.hints)) throw new Error(`Décision éditoriale invalide: ${decision.targetId}`);
    decisions.set(decision.targetId, decision);
  }
  const entries = selected.map(entry => {
    const target = prepared.get(entry.targetId); const word = words.get(entry.targetId);
    const neighbors = target?.orderedIds.filter(id => id !== entry.targetId).slice(0, 12).map(id => ({ id, word: words.get(id) }));
    const decision = decisions.get(entry.targetId);
    if (decision && !target) throw new Error(`Décision sans colonne vérifiée: ${entry.targetId}`);
    if (decision?.decision === "approved") {
      const neighborWords = new Set(neighbors.map(item => item.word));
      if (decision.hints.length !== 3 || new Set(decision.hints).size !== 3 || decision.hints.some(hint => hint === word || !neighborWords.has(hint))) throw new Error(`Indices éditoriaux invalides: ${entry.targetId}`);
      return { ...entry, word, lexicalStatus: "agent-reviewed", numericalStatus: "verified-staging-column", neighborhood: { status: "reviewed-approved", neighbors, targetManifestSha256: target.manifestSha256 }, hints: { status: "reviewed", words: decision.hints }, approval: `approved-${decision.kind}`, approvalReview: { actor: decision.actor, kind: decision.kind, reviewedAt: decision.reviewedAt, rationale: decision.rationale } };
    }
    if (decision?.decision === "rejected") return { ...entry, word, lexicalStatus: "agent-reviewed", numericalStatus: "verified-staging-column", neighborhood: { status: "reviewed-rejected", neighbors, targetManifestSha256: target.manifestSha256 }, hints: { status: "not-reviewed", words: [] }, approval: "rejected", approvalReview: { actor: decision.actor, kind: decision.kind, reviewedAt: decision.reviewedAt, rationale: decision.rationale } };
    return { ...entry, word, lexicalStatus: "agent-reviewed", numericalStatus: target ? "verified-staging-column" : "not-prepared", neighborhood: target ? { status: "evidence-ready-agent-review-pending", neighbors, targetManifestSha256: target.manifestSha256 } : { status: "not-measured", neighbors: [] }, hints: { status: "not-reviewed", words: [] }, approval: "pending" };
  });
  const payload = { schemaVersion: 1, id: "fr-v2-editorial-catalogue-1", corpus: { id: corpus.manifest.corpusId, manifestSha256: corpus.manifestSha256, semanticSha256: corpus.manifest.semanticSha256, dictionarySize: corpus.manifest.stats.accepted }, status: "inactive-editorial-workbench", counts: { selected: entries.length, lexicalReviewed: entries.filter(entry => entry.lexicalStatus === "agent-reviewed").length, neighborhoodEvidenceReady: entries.filter(entry => entry.neighborhood.status === "evidence-ready-agent-review-pending" || entry.neighborhood.status === "reviewed-approved").length, approved: entries.filter(entry => entry.approval.startsWith("approved")).length }, entries };
  const bytes = Buffer.from(JSON.stringify(payload, null, 2) + "\n");
  await writeFile(resolve(outputPath), bytes);
  return { ...payload.counts, catalogueSha256: sha256(Buffer.from(stableJson(payload))) };
}

if (process.argv[1] && basename(process.argv[1]) === "build-editorial-catalogue-v2.mjs") {
  const args = parseArgs(process.argv.slice(2));
  buildEditorialCatalogue({ corpusDir: args.corpus, targetsDir: args.targets, selectionPath: args.selection, outputPath: args.output }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
