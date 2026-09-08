import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
  SCORE_BUCKETS, SCORE_CONTRACT, SCORE_MAX, SCORE_MIN, acquireTargetCacheGuard,
  corpusEntries, durableWrite, installImmutable, loadActiveCorpus, releaseTargetCacheGuard,
  scoreIndex, sha256, stableJson, vectorNorm,
} from "./semantic-target-v2-common.mjs";
import { validateSemanticTargetManifestContract, verifySemanticTargetUnderGuard } from "./verify-semantic-target-v2.mjs";

const HASH = /^[0-9a-f]{64}$/;
const EVIDENCE_FORMAT = "BEE2-editorial-neighborhood";
const INDEX_FORMAT = "BEI2-editorial-evidence-index";
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const LEGACY_NEIGHBOR_COUNT = 12;
const EXTENDED_NEIGHBOR_COUNT = 64;

function neighborCountForSchema(schemaVersion, dictionarySize) {
  const configured = schemaVersion === 1 ? LEGACY_NEIGHBOR_COUNT : schemaVersion === 2 ? EXTENDED_NEIGHBOR_COUNT : null;
  if (configured === null) throw new Error("Editorial evidence schema version is unsupported");
  return Math.min(configured, dictionarySize - 1);
}

async function boundedJson(path, maximum, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > maximum) throw new Error(`${label} is unsafe or exceeds its size limit`);
  let value;
  try { value = JSON.parse((await readFile(path)).toString("utf8")); }
  catch { throw new Error(`${label} is not valid JSON`); }
  return value;
}

function corpusPin(corpus) {
  return {
    id: corpus.manifest.corpusId,
    manifestSha256: corpus.manifestSha256,
    semanticSha256: corpus.manifest.semanticSha256,
    dictionarySize: corpus.manifest.stats.accepted,
    dimensions: corpus.manifest.config.dimensions,
  };
}

function sameCorpus(left, right) {
  return left?.id === right.id && left.manifestSha256 === right.manifestSha256 &&
    left.semanticSha256 === right.semanticSha256 && left.dictionarySize === right.dictionarySize &&
    left.dimensions === right.dimensions;
}

async function canonicalDestination(path) {
  let cursor = resolve(path); const missing = [];
  while (true) {
    try { return resolve(await realpath(cursor), ...missing); }
    catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      missing.unshift(basename(cursor)); cursor = parent;
    }
  }
}

function independentScore(vector, targetVector, dimensions, targetNorm, sameIdentity) {
  if (sameIdentity) return SCORE_MAX;
  let dot = 0; let squared = 0;
  for (let index = 0; index < dimensions; index++) {
    const value = vector.readFloatLE(index * 4); const target = targetVector.readFloatLE(index * 4);
    if (!Number.isFinite(value) || !Number.isFinite(target)) throw new Error("Non-finite vector in editorial evidence verification");
    dot += value * target; squared += value * value;
  }
  const denominator = Math.sqrt(squared) * targetNorm;
  if (!(denominator > 0) || !Number.isFinite(denominator)) throw new Error("Invalid editorial cosine denominator");
  const scaled = Math.max(-1, Math.min(1, dot / denominator)) * SCORE_MAX;
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, rounded));
}

function insertTop(top, row, limit) {
  let index = 0;
  while (index < top.length && (top[index].score > row.score || top[index].score === row.score && top[index].id < row.id)) index++;
  top.splice(index, 0, row);
  if (top.length > limit) top.pop();
}

function validateEvidencePayload(payload, expectedCorpus = null) {
  const neighborCount = payload?.corpus && Number.isSafeInteger(payload.corpus.dictionarySize)
    ? neighborCountForSchema(payload.schemaVersion, payload.corpus.dictionarySize) : -1;
  if (!payload || ![1, 2].includes(payload.schemaVersion) || payload.format !== EVIDENCE_FORMAT ||
      !payload.corpus || !HASH.test(payload.corpus.manifestSha256) || !HASH.test(payload.corpus.semanticSha256) ||
      !Number.isSafeInteger(payload.corpus.dictionarySize) || payload.corpus.dictionarySize < 2 ||
      !Number.isInteger(payload.corpus.dimensions) || payload.corpus.dimensions < 1 || payload.corpus.dimensions > 4096 ||
      expectedCorpus && !sameCorpus(payload.corpus, expectedCorpus) ||
      !payload.target || !Number.isInteger(payload.target.id) || payload.target.id < 0 || payload.target.id >= payload.corpus.dictionarySize ||
      typeof payload.target.word !== "string" || !payload.target.word || !HASH.test(payload.target.wordSha256) ||
      sha256(Buffer.from(payload.target.word)) !== payload.target.wordSha256 ||
      !HASH.test(payload.scoreContractSha256) || payload.scoreContractSha256 !== sha256(Buffer.from(stableJson(SCORE_CONTRACT))) ||
      !payload.targetManifest || !HASH.test(payload.targetManifest.sha256) || typeof payload.targetManifest.utf8 !== "string" ||
      Buffer.byteLength(payload.targetManifest.utf8) > MAX_EVIDENCE_BYTES ||
      sha256(Buffer.from(payload.targetManifest.utf8)) !== payload.targetManifest.sha256 ||
      !payload.verification || !["automated-exhaustive", "automated-exhaustive-corpus-extension"].includes(payload.verification.kind) ||
      payload.verification.verifierContract !== "verify-semantic-target-v2@2" ||
      payload.schemaVersion === 1 && payload.verification.kind !== "automated-exhaustive" ||
      payload.schemaVersion === 1 && payload.verification.neighborhoodVerifierContract !== undefined ||
      payload.schemaVersion === 2 && payload.verification.neighborhoodVerifierContract !== "editorial-evidence-v2@2" ||
      payload.verification.kind === "automated-exhaustive-corpus-extension" && payload.schemaVersion !== 2 ||
      payload.verification.dictionarySize !== payload.corpus.dictionarySize ||
      !Number.isInteger(payload.verification.valuePages) || payload.verification.valuePages < 1 ||
      !Number.isInteger(payload.verification.orderPages) || payload.verification.orderPages < 1 ||
      !HASH.test(payload.verification.histogramSha256) ||
      !Array.isArray(payload.verification.checks) ||
      stableJson(payload.verification.checks) !== stableJson(["scores", "histogram", "competition-ranks", "stable-order"]) ||
      !payload.neighborhood || payload.neighborhood.order !== SCORE_CONTRACT.stableOrder ||
      payload.neighborhood.targetExcludedByIdentity !== true || !Array.isArray(payload.neighborhood.entries) ||
      payload.neighborhood.entries.length !== neighborCount ||
      payload.schemaVersion === 1 && payload.supersedesEvidenceSha256 !== undefined ||
      payload.schemaVersion === 2 && payload.supersedesEvidenceSha256 !== null && !HASH.test(payload.supersedesEvidenceSha256) ||
      payload.verification?.kind === "automated-exhaustive-corpus-extension" && !HASH.test(payload.supersedesEvidenceSha256 ?? "")) {
    throw new Error("Editorial evidence contract is invalid");
  }
  let manifest;
  try { manifest = JSON.parse(payload.targetManifest.utf8); } catch { throw new Error("Archived target manifest is invalid JSON"); }
  const pinnedCorpus = { manifest: { corpusId: payload.corpus.id, semanticSha256: payload.corpus.semanticSha256, stats: { accepted: payload.corpus.dictionarySize }, config: { dimensions: payload.corpus.dimensions } }, manifestSha256: payload.corpus.manifestSha256 };
  try { validateSemanticTargetManifestContract({ manifest, corpus: pinnedCorpus, targetId: payload.target.id }); }
  catch { throw new Error("Archived target manifest contract is invalid"); }
  if (manifest.target.wordSha256 !== payload.target.wordSha256 || manifest.config.contractHash !== payload.scoreContractSha256 ||
      manifest.stats.valuePages !== payload.verification.valuePages || manifest.stats.orderPages !== payload.verification.orderPages ||
      sha256(Buffer.from(stableJson(manifest.histogram))) !== payload.verification.histogramSha256) {
    throw new Error("Archived target manifest does not match editorial evidence");
  }
  const ids = new Set(); const words = new Set();
  for (const entry of payload.neighborhood.entries) {
    if (!entry || !Number.isInteger(entry.id) || entry.id < 0 || entry.id >= payload.corpus.dictionarySize || entry.id === payload.target.id ||
        typeof entry.word !== "string" || !entry.word || ids.has(entry.id) || words.has(entry.word) ||
        !Number.isInteger(entry.score) || entry.score < SCORE_MIN || entry.score > SCORE_MAX ||
        !Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > payload.corpus.dictionarySize) throw new Error("Editorial evidence neighbor is invalid");
    ids.add(entry.id); words.add(entry.word);
  }
  return payload;
}

export async function loadEditorialEvidenceIndex(evidenceDir, corpus) {
  evidenceDir = resolve(evidenceDir);
  let index;
  try { index = await boundedJson(join(evidenceDir, "index.json"), MAX_INDEX_BYTES, "Editorial evidence index"); }
  catch (error) {
    if (error?.code === "ENOENT") return { schemaVersion: 2, format: INDEX_FORMAT, corpus: corpusPin(corpus), entries: [] };
    throw error;
  }
  const expected = corpusPin(corpus);
  if (![1, 2].includes(index.schemaVersion) || index.format !== INDEX_FORMAT || !sameCorpus(index.corpus, expected) || !Array.isArray(index.entries)) throw new Error("Editorial evidence index contract is invalid");
  const ids = new Set(); const files = new Set(); const hashes = new Set();
  const validateReference = (reference, targetId) => {
    if (!reference || basename(reference.file) !== reference.file || !/^evidence-\d{10}-[0-9a-f]{64}\.json$/.test(reference.file) ||
        !reference.file.startsWith(`evidence-${String(targetId).padStart(10, "0")}-`) || !HASH.test(reference.sha256) ||
        !reference.file.endsWith(`-${reference.sha256}.json`) || !Number.isFinite(Date.parse(reference.capturedAt)) ||
        files.has(reference.file) || hashes.has(reference.sha256)) throw new Error("Editorial evidence index reference is invalid");
    files.add(reference.file); hashes.add(reference.sha256);
  };
  for (const entry of index.entries) {
    if (!Number.isInteger(entry.targetId) || entry.targetId < 0 || entry.targetId >= expected.dictionarySize || ids.has(entry.targetId) ||
        index.schemaVersion === 1 && entry.revisions !== undefined || index.schemaVersion === 2 && entry.revisions !== undefined && !Array.isArray(entry.revisions)) throw new Error("Editorial evidence index entry is invalid");
    ids.add(entry.targetId);
    validateReference(entry, entry.targetId);
    for (const revision of entry.revisions ?? []) validateReference(revision, entry.targetId);
  }
  return index;
}

/** @param {{corpus:any,evidenceDir:string,targetId:number,expectedSha256?:string|null}} options */
export async function loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256 = null }) {
  if (expectedSha256 !== null && (typeof expectedSha256 !== "string" || !HASH.test(expectedSha256))) throw new Error("Editorial evidence expected hash is invalid");
  const index = await loadEditorialEvidenceIndex(evidenceDir, corpus);
  const head = index.entries.find(entry => entry.targetId === targetId);
  const references = head ? [head, ...(head.revisions ?? [])] : [];
  const reference = expectedSha256 !== null ? references.find(item => item.sha256 === expectedSha256) : head;
  if (!reference) throw new Error(`Editorial evidence is missing or changed: ${targetId}`);
  const loaded = [];
  for (const item of references) {
    const payload = validateEvidencePayload(await boundedJson(join(resolve(evidenceDir), item.file), MAX_EVIDENCE_BYTES, "Editorial evidence"), corpusPin(corpus));
    const digest = sha256(Buffer.from(stableJson(payload)));
    if (digest !== item.sha256 || !item.file.endsWith(`-${digest}.json`)) throw new Error(`Editorial evidence hash mismatch: ${targetId}`);
    if (payload.target.id !== targetId) throw new Error(`Editorial evidence target mismatch: ${targetId}`);
    loaded.push({ payload, sha256: digest, reference: item });
  }
  for (let indexPosition = 0; indexPosition < loaded.length; indexPosition++) {
    const child = loaded[indexPosition]; const parent = loaded[indexPosition + 1] ?? null;
    if (child.payload.schemaVersion === 1 && parent || child.payload.schemaVersion === 2 && child.payload.supersedesEvidenceSha256 !== (parent?.sha256 ?? null)) throw new Error(`Editorial evidence revision chain is invalid: ${targetId}`);
    if (parent && (child.payload.targetManifest.sha256 !== parent.payload.targetManifest.sha256 ||
        child.payload.verification.histogramSha256 !== parent.payload.verification.histogramSha256 ||
        stableJson(child.payload.neighborhood.entries.slice(0, parent.payload.neighborhood.entries.length)) !== stableJson(parent.payload.neighborhood.entries))) {
      throw new Error(`Editorial evidence revision does not preserve its parent: ${targetId}`);
    }
  }
  const selected = loaded.find(item => item.sha256 === reference.sha256);
  if (!selected) throw new Error(`Editorial evidence is missing or changed: ${targetId}`);
  return selected;
}

/** @param {{corpusDir:string,evidenceDir:string,targetId:number,expectedSha256?:string|null}} options */
export async function verifyEditorialEvidence({ corpusDir, evidenceDir, targetId, expectedSha256 = null }) {
  corpusDir = resolve(corpusDir);
  const corpus = await loadActiveCorpus(corpusDir);
  const loaded = await loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256 });
  const verified = await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, loaded.payload);
  return { ...verified, evidenceSha256: loaded.sha256 };
}

async function scoreEvidencePayloadAgainstCorpus(corpusDir, corpus, payload) {
  const targetId = payload.target.id;
  let target = null;
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) {
    if (targetId >= entries[0].id && targetId <= entries.at(-1).id) {
      const entry = entries[targetId - entries[0].id];
      target = { id: entry.id, word: entry.word, vector: Buffer.from(entry.vector) };
    }
  }
  if (!target || target.word !== payload.target.word || sha256(Buffer.from(target.word)) !== payload.target.wordSha256) throw new Error("Editorial evidence target identity differs from the corpus");
  const neighborCount = neighborCountForSchema(payload.schemaVersion, payload.corpus.dictionarySize);
  const histogram = new Array(SCORE_BUCKETS).fill(0); const top = []; const targetNorm = vectorNorm(target.vector, corpus.manifest.config.dimensions); let seen = 0;
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) for (const entry of entries) {
    const score = independentScore(entry.vector, target.vector, corpus.manifest.config.dimensions, targetNorm, entry.id === targetId);
    histogram[scoreIndex(score)]++; seen++;
    if (entry.id !== targetId) insertTop(top, { id: entry.id, word: entry.word, score }, neighborCount);
  }
  if (seen !== corpus.manifest.stats.accepted) throw new Error("Editorial evidence exhaustive coverage mismatch");
  const higher = new Uint32Array(SCORE_BUCKETS); let above = 0;
  for (let index = SCORE_BUCKETS - 1; index >= 0; index--) { higher[index] = above; above += histogram[index]; }
  const actual = top.map(entry => ({ ...entry, rank: higher[scoreIndex(entry.score)] + 1 }));
  return { corpusId: corpus.manifest.corpusId, targetId, dictionarySize: seen, neighbors: actual.length, histogramSha256: sha256(Buffer.from(stableJson(histogram))), entries: actual };
}

async function verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, payload) {
  const actual = await scoreEvidencePayloadAgainstCorpus(corpusDir, corpus, payload);
  if (actual.histogramSha256 !== payload.verification.histogramSha256) throw new Error("Editorial evidence exhaustive histogram mismatch");
  if (stableJson(actual.entries) !== stableJson(payload.neighborhood.entries)) throw new Error("Editorial evidence neighborhood differs from independent corpus scoring");
  return { corpusId: actual.corpusId, targetId: actual.targetId, dictionarySize: actual.dictionarySize, neighbors: actual.neighbors };
}

/** @param {{corpusDir:string,targetsDir:string,evidenceDir:string,targetId:number,capturedAt?:string}} options */
export async function captureEditorialEvidence({ corpusDir, targetsDir, evidenceDir, targetId, capturedAt = new Date().toISOString() }) {
  corpusDir = resolve(corpusDir); targetsDir = resolve(targetsDir); evidenceDir = resolve(evidenceDir);
  if (!Number.isInteger(targetId) || targetId < 0 || targetId > 0xffff_ffff || !Number.isFinite(Date.parse(capturedAt))) throw new Error("Editorial evidence capture arguments are invalid");
  const corpus = await loadActiveCorpus(corpusDir); const targetsRoot = join(targetsDir, corpus.manifest.corpusId, "targets");
  const canonicalTargetsRoot = await realpath(targetsRoot); const canonicalEvidenceDir = await canonicalDestination(evidenceDir);
  if (canonicalEvidenceDir === canonicalTargetsRoot || canonicalEvidenceDir.startsWith(`${canonicalTargetsRoot}${sep}`)) throw new Error("Editorial evidence must be stored outside target staging");
  await mkdir(evidenceDir, { recursive: true });
  if (!(await lstat(evidenceDir)).isDirectory()) throw new Error("Editorial evidence root is unsafe");
  const evidenceIndex = await loadEditorialEvidenceIndex(evidenceDir, corpus);
  const currentReference = evidenceIndex.entries.find(entry => entry.targetId === targetId) ?? null;
  const currentEvidence = currentReference ? await loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256: currentReference.sha256 }) : null;
  const guard = acquireTargetCacheGuard(targetsRoot, "exclusive");
  try {
    const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir: targetsDir, targetId, neighborCount: EXTENDED_NEIGHBOR_COUNT }, guard);
    if (currentEvidence?.payload.schemaVersion === 2 && currentEvidence.payload.targetManifest.sha256 === verified.manifestSha256) {
      await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, currentEvidence.payload);
      return { corpusId: corpus.manifest.corpusId, targetId, evidenceSha256: currentEvidence.sha256, file: currentEvidence.reference.file, neighbors: currentEvidence.payload.neighborhood.entries.length, idempotent: true };
    }
    const payload = validateEvidencePayload({
      schemaVersion: 2,
      format: EVIDENCE_FORMAT,
      supersedesEvidenceSha256: currentEvidence?.sha256 ?? null,
      corpus: corpusPin(corpus),
      target: { id: targetId, word: verified.targetWord, wordSha256: verified.targetWordSha256 },
      scoreContractSha256: verified.contractHash,
      targetManifest: { sha256: verified.manifestSha256, utf8: verified.manifestUtf8 },
      verification: {
        kind: "automated-exhaustive",
        verifierContract: "verify-semantic-target-v2@2",
        neighborhoodVerifierContract: "editorial-evidence-v2@2",
        dictionarySize: verified.dictionarySize,
        valuePages: verified.valuePages,
        orderPages: verified.orderPages,
        histogramSha256: verified.histogramSha256,
        checks: ["scores", "histogram", "competition-ranks", "stable-order"],
      },
      neighborhood: { order: SCORE_CONTRACT.stableOrder, targetExcludedByIdentity: true, entries: verified.topNeighbors },
    }, corpusPin(corpus));
    if (currentEvidence && (currentEvidence.payload.targetManifest.sha256 !== payload.targetManifest.sha256 ||
        currentEvidence.payload.verification.histogramSha256 !== payload.verification.histogramSha256 ||
        stableJson(payload.neighborhood.entries.slice(0, currentEvidence.payload.neighborhood.entries.length)) !== stableJson(currentEvidence.payload.neighborhood.entries))) {
      throw new Error(`Extended editorial evidence does not preserve its parent: ${targetId}`);
    }
    const digest = sha256(Buffer.from(stableJson(payload)));
    const file = `evidence-${String(targetId).padStart(10, "0")}-${digest}.json`;
    const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
    if (bytes.length > MAX_EVIDENCE_BYTES) throw new Error("Editorial evidence exceeds its size limit");
    await installImmutable(join(evidenceDir, file), bytes);
    await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, payload);
    await installIndex({ evidenceDir, corpus, targetId, file, digest, capturedAt, payload });
    return { corpusId: corpus.manifest.corpusId, targetId, evidenceSha256: digest, file, neighbors: verified.topNeighbors.length };
  } finally { releaseTargetCacheGuard(guard); }
}

/** @param {{corpusDir:string,evidenceDir:string,targetId:number,parentSha256?:string|null,capturedAt?:string}} options */
export async function expandEditorialEvidence({ corpusDir, evidenceDir, targetId, parentSha256 = null, capturedAt = new Date().toISOString() }) {
  corpusDir = resolve(corpusDir); evidenceDir = resolve(evidenceDir);
  if (!Number.isInteger(targetId) || targetId < 0 || targetId > 0xffff_ffff || parentSha256 !== null && !HASH.test(parentSha256) || !Number.isFinite(Date.parse(capturedAt))) throw new Error("Editorial evidence extension arguments are invalid");
  const corpus = await loadActiveCorpus(corpusDir);
  const parent = await loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256: parentSha256 });
  if (parent.payload.schemaVersion === 2) {
    await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, parent.payload);
    return { corpusId: corpus.manifest.corpusId, targetId, evidenceSha256: parent.sha256, file: parent.reference.file, neighbors: parent.payload.neighborhood.entries.length, idempotent: true };
  }
  const draft = { ...parent.payload, schemaVersion: 2, supersedesEvidenceSha256: parent.sha256 };
  const scored = await scoreEvidencePayloadAgainstCorpus(corpusDir, corpus, draft);
  if (scored.histogramSha256 !== parent.payload.verification.histogramSha256 || stableJson(scored.entries.slice(0, parent.payload.neighborhood.entries.length)) !== stableJson(parent.payload.neighborhood.entries)) throw new Error(`Extended editorial evidence does not preserve its parent: ${targetId}`);
  const payload = validateEvidencePayload({
    schemaVersion: 2,
    format: EVIDENCE_FORMAT,
    supersedesEvidenceSha256: parent.sha256,
    corpus: parent.payload.corpus,
    target: parent.payload.target,
    scoreContractSha256: parent.payload.scoreContractSha256,
    targetManifest: parent.payload.targetManifest,
    verification: { ...parent.payload.verification, kind: "automated-exhaustive-corpus-extension", neighborhoodVerifierContract: "editorial-evidence-v2@2" },
    neighborhood: { order: SCORE_CONTRACT.stableOrder, targetExcludedByIdentity: true, entries: scored.entries },
  }, corpusPin(corpus));
  const digest = sha256(Buffer.from(stableJson(payload)));
  const file = `evidence-${String(targetId).padStart(10, "0")}-${digest}.json`;
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
  if (bytes.length > MAX_EVIDENCE_BYTES) throw new Error("Editorial evidence exceeds its size limit");
  await installImmutable(join(evidenceDir, file), bytes);
  await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, payload);
  await installIndex({ evidenceDir, corpus, targetId, file, digest, capturedAt, payload });
  return { corpusId: corpus.manifest.corpusId, targetId, evidenceSha256: digest, file, neighbors: scored.entries.length };
}

async function installIndex({ evidenceDir, corpus, targetId, file, digest, capturedAt, payload }) {
  const canonicalEvidenceDir = await realpath(evidenceDir);
  const lockRoot = join(tmpdir(), `braise-editorial-evidence-${sha256(Buffer.from(canonicalEvidenceDir)).slice(0, 24)}`);
  await mkdir(lockRoot, { recursive: true });
  const guard = acquireTargetCacheGuard(lockRoot, "exclusive");
  try {
    const loaded = await loadEditorialEvidenceIndex(evidenceDir, corpus);
    const index = loaded.schemaVersion === 2 ? structuredClone(loaded) : {
      schemaVersion: 2, format: INDEX_FORMAT, corpus: loaded.corpus,
      entries: loaded.entries.map(entry => ({ ...entry, revisions: [] })),
    };
    const existing = index.entries.find(entry => entry.targetId === targetId);
    if (existing?.sha256 === digest && existing.file === file) return evidenceDir;
    if (existing) {
      if (payload.schemaVersion !== 2 || payload.supersedesEvidenceSha256 !== existing.sha256) throw new Error(`Editorial evidence revision does not extend the current head: ${targetId}`);
      existing.revisions = [{ file: existing.file, sha256: existing.sha256, capturedAt: existing.capturedAt }, ...(existing.revisions ?? [])];
      Object.assign(existing, { file, sha256: digest, capturedAt });
    } else {
      if (payload.schemaVersion !== 2 || payload.supersedesEvidenceSha256 !== null) throw new Error(`First editorial evidence must not supersede another proof: ${targetId}`);
      index.entries.push({ targetId, file, sha256: digest, capturedAt, revisions: [] });
      index.entries.sort((left, right) => left.targetId - right.targetId);
    }
    const bytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
    if (bytes.length > MAX_INDEX_BYTES) throw new Error("Editorial evidence index exceeds its size limit");
    await durableWrite(join(evidenceDir, "index.json"), bytes);
  } finally { releaseTargetCacheGuard(guard); }
  return evidenceDir;
}

function parseArgs(argv) {
  const operation = argv[0];
  if (!["capture", "expand", "verify"].includes(operation)) throw new Error("Usage: capture|expand|verify --corpus DIR --evidence DIR --target-id N");
  const values = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || Object.hasOwn(values, key)) throw new Error("Editorial evidence arguments are invalid");
    values[key] = value;
  }
  const allowed = operation === "capture" ? new Set(["--corpus", "--targets", "--evidence", "--target-id"]) : operation === "expand" ? new Set(["--corpus", "--evidence", "--target-id", "--parent-sha256"]) : new Set(["--corpus", "--evidence", "--target-id", "--expected-sha256"]);
  if (Object.keys(values).some(key => !allowed.has(key)) || !values["--corpus"] || !values["--evidence"] || values["--target-id"] === undefined || operation === "capture" && !values["--targets"]) throw new Error("Editorial evidence arguments are incomplete");
  const common = { corpusDir: values["--corpus"], evidenceDir: values["--evidence"], targetId: Number(values["--target-id"]) };
  if (operation === "capture") return { operation, options: { ...common, targetsDir: values["--targets"] } };
  if (operation === "expand") return { operation, options: { ...common, parentSha256: values["--parent-sha256"] ?? null } };
  return { operation, options: { ...common, expectedSha256: values["--expected-sha256"] ?? null } };
}

if (process.argv[1] && basename(process.argv[1]) === "editorial-evidence-v2.mjs") {
  const { operation, options } = parseArgs(process.argv.slice(2));
  const action = operation === "capture" ? captureEditorialEvidence(options) : operation === "expand" ? expandEditorialEvidence(options) : verifyEditorialEvidence(options);
  action.then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
