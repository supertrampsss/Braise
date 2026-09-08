// Server-only B2 contracts. Catalogue membership never implies a prepared score column.
export type EditorialDecision = "pending" | "approved-agent" | "approved-human" | "rejected";
export type EditorialReviewFact = { targetId: number; decision: "approved" | "rejected"; hints: string[]; actor: string; kind: "agent" | "human"; reviewedAt: string; rationale: string; evidenceSha256: string; supersedesEvidenceSha256?: string };
export type EditorialEntry = {
  targetId: number;
  word: string;
  category: string;
  ambiguity: "low" | "medium" | "high";
  review: { actor: string; kind: "agent" | "human"; reviewedAt: string; decision: "candidate" };
  corrections?: Array<{ actor: string; kind: "agent" | "human"; reviewedAt: string; reason: string }>;
  lexicalStatus: "agent-reviewed" | "human-reviewed";
  numericalStatus: "not-prepared" | "verified-staging-column" | "verified-archived-evidence";
  neighborhood: { status: "not-measured" | "evidence-ready-agent-review-pending" | "reviewed-approved" | "reviewed-rejected"; neighbors: Array<{ id: number; word: string }>; targetManifestSha256?: string; evidenceSha256?: string; supersedesEvidenceSha256?: string };
  hints: { status: "not-reviewed" | "reviewed"; words: string[] };
  approval: EditorialDecision;
  approvalReview?: { actor: string; kind: "agent" | "human"; reviewedAt: string; rationale: string; evidenceSha256: string; supersedesEvidenceSha256?: string };
  approvalHistory?: EditorialReviewFact[];
};

export type EditorialCatalogue = {
  schemaVersion: 1;
  id: string;
  corpus: { id: string; manifestSha256: string; semanticSha256: string; dictionarySize: number };
  status: "inactive-editorial-workbench" | "ready";
  counts: { selected: number; lexicalReviewed: number; neighborhoodEvidenceReady: number; approved: number };
  entries: EditorialEntry[];
};

const HASH = /^[0-9a-f]{64}$/;
const WORD = /^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:[-'][a-zàâäçéèêëîïôöùûüÿœæ]+)*$/u;

export function isV2TargetEligible(targetId: number, dictionarySize: number) {
  return Number.isInteger(targetId) && targetId >= 0 && targetId < dictionarySize;
}

export function validateEditorialCatalogue(value: unknown, minimum = 400): EditorialCatalogue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid-editorial-catalogue");
  const catalogue = value as EditorialCatalogue;
  if (catalogue.schemaVersion !== 1 || typeof catalogue.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(catalogue.id) || !catalogue.corpus || typeof catalogue.corpus.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(catalogue.corpus.id) || typeof catalogue.corpus.manifestSha256 !== "string" || !HASH.test(catalogue.corpus.manifestSha256) || typeof catalogue.corpus.semanticSha256 !== "string" || !HASH.test(catalogue.corpus.semanticSha256) || !Number.isInteger(catalogue.corpus.dictionarySize) || catalogue.corpus.dictionarySize < minimum || !["inactive-editorial-workbench", "ready"].includes(catalogue.status) || !Array.isArray(catalogue.entries) || catalogue.entries.length < minimum) throw new Error("invalid-editorial-catalogue");
  const ids = new Set<number>(); const words = new Set<string>(); let lexicalReviewed = 0; let evidenceReady = 0; let approved = 0;
  for (const entry of catalogue.entries) {
    if (!isV2TargetEligible(entry.targetId, catalogue.corpus.dictionarySize) || typeof entry.word !== "string" || !WORD.test(entry.word) || words.has(entry.word) || ids.has(entry.targetId) || typeof entry.category !== "string" || !entry.category || !["low", "medium", "high"].includes(entry.ambiguity) || !entry.review || !["agent", "human"].includes(entry.review.kind) || typeof entry.review.actor !== "string" || !entry.review.actor || typeof entry.review.reviewedAt !== "string" || !Number.isFinite(Date.parse(entry.review.reviewedAt)) || entry.review.decision !== "candidate" || entry.corrections !== undefined && (!Array.isArray(entry.corrections) || entry.corrections.some(item => !item.actor || !["agent", "human"].includes(item.kind) || !Number.isFinite(Date.parse(item.reviewedAt)) || !item.reason)) || !["agent-reviewed", "human-reviewed"].includes(entry.lexicalStatus) || entry.lexicalStatus !== `${entry.review.kind}-reviewed` || !["not-prepared", "verified-staging-column", "verified-archived-evidence"].includes(entry.numericalStatus) || !entry.neighborhood || !["not-measured", "evidence-ready-agent-review-pending", "reviewed-approved", "reviewed-rejected"].includes(entry.neighborhood.status) || !Array.isArray(entry.neighborhood.neighbors) || !entry.hints || !["not-reviewed", "reviewed"].includes(entry.hints.status) || !Array.isArray(entry.hints.words) || !["pending", "approved-agent", "approved-human", "rejected"].includes(entry.approval)) throw new Error("invalid-editorial-entry");
    const neighborIds = new Set<number>(); const neighborWords = new Set<string>();
    for (const neighbor of entry.neighborhood.neighbors) {
      if (!neighbor || !isV2TargetEligible(neighbor.id, catalogue.corpus.dictionarySize) || neighbor.id === entry.targetId || typeof neighbor.word !== "string" || !WORD.test(neighbor.word) || neighbor.word === entry.word || neighborIds.has(neighbor.id) || neighborWords.has(neighbor.word)) throw new Error("invalid-editorial-neighbor");
      neighborIds.add(neighbor.id); neighborWords.add(neighbor.word);
    }
    if (entry.hints.words.some(word => typeof word !== "string" || !WORD.test(word)) || new Set(entry.hints.words).size !== entry.hints.words.length) throw new Error("invalid-editorial-hint");
    if (entry.approvalHistory !== undefined) {
      if (!Array.isArray(entry.approvalHistory) || entry.approvalHistory.length < 2) throw new Error("invalid-editorial-review-history");
      const evidenceHashes = new Set<string>();
      for (let reviewIndex = 0; reviewIndex < entry.approvalHistory.length; reviewIndex++) {
        const fact = entry.approvalHistory[reviewIndex]; const previous = entry.approvalHistory[reviewIndex - 1];
        if (!fact || fact.targetId !== entry.targetId || !["approved", "rejected"].includes(fact.decision) || !["agent", "human"].includes(fact.kind) || !fact.actor || !Number.isFinite(Date.parse(fact.reviewedAt)) || !fact.rationale || !Array.isArray(fact.hints) || fact.hints.some(word => typeof word !== "string" || !WORD.test(word)) || new Set(fact.hints).size !== fact.hints.length || fact.decision === "approved" && fact.hints.length !== 3 || fact.decision === "rejected" && fact.hints.length !== 0 || !HASH.test(fact.evidenceSha256) || evidenceHashes.has(fact.evidenceSha256) ||
            !previous && fact.supersedesEvidenceSha256 !== undefined || previous && (fact.supersedesEvidenceSha256 !== previous.evidenceSha256 || Date.parse(fact.reviewedAt) < Date.parse(previous.reviewedAt))) throw new Error("invalid-editorial-review-history");
        evidenceHashes.add(fact.evidenceSha256);
      }
      const current = entry.approvalHistory.at(-1)!;
      if (!entry.approvalReview || current.evidenceSha256 !== entry.approvalReview.evidenceSha256 || current.supersedesEvidenceSha256 !== entry.approvalReview.supersedesEvidenceSha256 || current.actor !== entry.approvalReview.actor || current.kind !== entry.approvalReview.kind || current.reviewedAt !== entry.approvalReview.reviewedAt || current.rationale !== entry.approvalReview.rationale || current.decision !== (entry.approval.startsWith("approved") ? "approved" : "rejected") || JSON.stringify(current.hints) !== JSON.stringify(entry.hints.words)) throw new Error("invalid-editorial-review-history");
    } else if (entry.approvalReview?.supersedesEvidenceSha256 !== undefined || entry.approval !== "pending" && entry.neighborhood.supersedesEvidenceSha256 !== undefined) throw new Error("missing-editorial-review-history");
    ids.add(entry.targetId); words.add(entry.word); lexicalReviewed++;
    if (entry.neighborhood.status.startsWith("evidence-ready") || entry.neighborhood.status === "reviewed-approved") evidenceReady++;
    const hasEvidence = entry.numericalStatus !== "not-prepared";
    if (!hasEvidence && (entry.neighborhood.status !== "not-measured" || entry.neighborhood.neighbors.length || entry.neighborhood.targetManifestSha256 || entry.neighborhood.evidenceSha256 || entry.hints.status !== "not-reviewed" || entry.hints.words.length || entry.approval !== "pending" || entry.approvalReview !== undefined || entry.approvalHistory !== undefined)) throw new Error("invalid-unprepared-editorial-state");
    if (hasEvidence && (!HASH.test(entry.neighborhood.targetManifestSha256 ?? "") || !HASH.test(entry.neighborhood.evidenceSha256 ?? "") || entry.neighborhood.supersedesEvidenceSha256 !== undefined && !HASH.test(entry.neighborhood.supersedesEvidenceSha256) || entry.neighborhood.neighbors.length < Math.min(6, catalogue.corpus.dictionarySize - 1))) throw new Error("invalid-editorial-evidence-state");
    if (entry.approval !== "pending" && entry.neighborhood.supersedesEvidenceSha256 !== undefined && entry.approvalReview?.supersedesEvidenceSha256 !== entry.neighborhood.supersedesEvidenceSha256) throw new Error("invalid-editorial-evidence-history");
    if (entry.approval.startsWith("approved")) {
      const hintWords = new Set(entry.hints.words);
      const approvalKind = entry.approval === "approved-human" ? "human" : "agent";
      if (!hasEvidence || entry.neighborhood.status !== "reviewed-approved" || neighborWords.size !== entry.neighborhood.neighbors.length || neighborWords.has(entry.word) || entry.hints.status !== "reviewed" || hintWords.size !== 3 || [...hintWords].some(word => word === entry.word || !neighborWords.has(word)) || entry.approvalReview?.kind !== approvalKind || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt)) || entry.approvalReview.evidenceSha256 !== entry.neighborhood.evidenceSha256 || entry.approvalReview.supersedesEvidenceSha256 !== undefined && !HASH.test(entry.approvalReview.supersedesEvidenceSha256)) throw new Error("unproven-editorial-approval");
      approved++;
    } else if (entry.approval === "rejected") {
      if (!hasEvidence || entry.neighborhood.status !== "reviewed-rejected" || entry.hints.status !== "not-reviewed" || entry.hints.words.length !== 0 || !entry.approvalReview || !["agent", "human"].includes(entry.approvalReview.kind) || !entry.approvalReview.actor || !entry.approvalReview.rationale || !Number.isFinite(Date.parse(entry.approvalReview.reviewedAt)) || entry.approvalReview.evidenceSha256 !== entry.neighborhood.evidenceSha256 || entry.approvalReview.supersedesEvidenceSha256 !== undefined && !HASH.test(entry.approvalReview.supersedesEvidenceSha256)) throw new Error("unproven-editorial-rejection");
    } else if (entry.approvalReview !== undefined || hasEvidence && (entry.neighborhood.status !== "evidence-ready-agent-review-pending" || entry.hints.status !== "not-reviewed" || entry.hints.words.length)) throw new Error("unexpected-editorial-review");
  }
  if (!catalogue.counts || catalogue.counts.selected !== catalogue.entries.length || catalogue.counts.lexicalReviewed !== lexicalReviewed || catalogue.counts.neighborhoodEvidenceReady !== evidenceReady || catalogue.counts.approved !== approved || (catalogue.status === "ready" && approved < minimum)) throw new Error("invalid-editorial-counts");
  return catalogue;
}

export function approvedEditorialTargets(catalogue: EditorialCatalogue) {
  return catalogue.entries.filter(entry => entry.approval === "approved-agent" || entry.approval === "approved-human").map(entry => entry.targetId);
}
