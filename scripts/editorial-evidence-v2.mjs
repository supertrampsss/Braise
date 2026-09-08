import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
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
const NEIGHBOR_COUNT = 12;

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
  if (!payload || payload.schemaVersion !== 1 || payload.format !== EVIDENCE_FORMAT ||
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
      !payload.verification || payload.verification.kind !== "automated-exhaustive" ||
      payload.verification.verifierContract !== "verify-semantic-target-v2@2" ||
      payload.verification.dictionarySize !== payload.corpus.dictionarySize ||
      !Number.isInteger(payload.verification.valuePages) || payload.verification.valuePages < 1 ||
      !Number.isInteger(payload.verification.orderPages) || payload.verification.orderPages < 1 ||
      !HASH.test(payload.verification.histogramSha256) ||
      !Array.isArray(payload.verification.checks) ||
      stableJson(payload.verification.checks) !== stableJson(["scores", "histogram", "competition-ranks", "stable-order"]) ||
      !payload.neighborhood || payload.neighborhood.order !== SCORE_CONTRACT.stableOrder ||
      payload.neighborhood.targetExcludedByIdentity !== true || !Array.isArray(payload.neighborhood.entries) ||
      payload.neighborhood.entries.length !== Math.min(NEIGHBOR_COUNT, payload.corpus.dictionarySize - 1)) {
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
    if (error?.code === "ENOENT") return { schemaVersion: 1, format: INDEX_FORMAT, corpus: corpusPin(corpus), entries: [] };
    throw error;
  }
  const expected = corpusPin(corpus);
  if (index.schemaVersion !== 1 || index.format !== INDEX_FORMAT || !sameCorpus(index.corpus, expected) || !Array.isArray(index.entries)) throw new Error("Editorial evidence index contract is invalid");
  const ids = new Set();
  for (const entry of index.entries) {
    if (!Number.isInteger(entry.targetId) || entry.targetId < 0 || entry.targetId >= expected.dictionarySize || ids.has(entry.targetId) ||
        basename(entry.file) !== entry.file || !/^evidence-\d{10}-[0-9a-f]{64}\.json$/.test(entry.file) ||
        !HASH.test(entry.sha256) || !Number.isFinite(Date.parse(entry.capturedAt))) throw new Error("Editorial evidence index entry is invalid");
    ids.add(entry.targetId);
  }
  return index;
}

/** @param {{corpus:any,evidenceDir:string,targetId:number,expectedSha256?:string|null}} options */
export async function loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256 = null }) {
  const index = await loadEditorialEvidenceIndex(evidenceDir, corpus);
  const reference = index.entries.find(entry => entry.targetId === targetId);
  if (!reference || expectedSha256 && reference.sha256 !== expectedSha256) throw new Error(`Editorial evidence is missing or changed: ${targetId}`);
  const payload = validateEvidencePayload(await boundedJson(join(resolve(evidenceDir), reference.file), MAX_EVIDENCE_BYTES, "Editorial evidence"), corpusPin(corpus));
  const digest = sha256(Buffer.from(stableJson(payload)));
  if (digest !== reference.sha256 || !reference.file.endsWith(`-${digest}.json`)) throw new Error(`Editorial evidence hash mismatch: ${targetId}`);
  if (payload.target.id !== targetId) throw new Error(`Editorial evidence target mismatch: ${targetId}`);
  return { payload, sha256: digest, reference };
}

/** @param {{corpusDir:string,evidenceDir:string,targetId:number,expectedSha256?:string|null}} options */
export async function verifyEditorialEvidence({ corpusDir, evidenceDir, targetId, expectedSha256 = null }) {
  corpusDir = resolve(corpusDir);
  const corpus = await loadActiveCorpus(corpusDir);
  const loaded = await loadEditorialEvidence({ corpus, evidenceDir, targetId, expectedSha256 });
  const verified = await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, loaded.payload);
  return { ...verified, evidenceSha256: loaded.sha256 };
}

async function verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, payload) {
  const targetId = payload.target.id;
  let target = null;
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) {
    if (targetId >= entries[0].id && targetId <= entries.at(-1).id) target = entries[targetId - entries[0].id];
  }
  if (!target || target.word !== payload.target.word || sha256(Buffer.from(target.word)) !== payload.target.wordSha256) throw new Error("Editorial evidence target identity differs from the corpus");
  const histogram = new Array(SCORE_BUCKETS).fill(0); const top = []; const targetNorm = vectorNorm(target.vector, corpus.manifest.config.dimensions); let seen = 0;
  for await (const { entries } of corpusEntries(corpusDir, corpus.manifest)) for (const entry of entries) {
    const score = independentScore(entry.vector, target.vector, corpus.manifest.config.dimensions, targetNorm, entry.id === targetId);
    histogram[scoreIndex(score)]++; seen++;
    if (entry.id !== targetId) insertTop(top, { id: entry.id, word: entry.word, score }, NEIGHBOR_COUNT);
  }
  if (seen !== corpus.manifest.stats.accepted || sha256(Buffer.from(stableJson(histogram))) !== payload.verification.histogramSha256) throw new Error("Editorial evidence exhaustive histogram mismatch");
  const higher = new Uint32Array(SCORE_BUCKETS); let above = 0;
  for (let index = SCORE_BUCKETS - 1; index >= 0; index--) { higher[index] = above; above += histogram[index]; }
  const actual = top.map(entry => ({ ...entry, rank: higher[scoreIndex(entry.score)] + 1 }));
  if (stableJson(actual) !== stableJson(payload.neighborhood.entries)) throw new Error("Editorial evidence neighborhood differs from independent corpus scoring");
  return { corpusId: corpus.manifest.corpusId, targetId, dictionarySize: seen, neighbors: actual.length };
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
  const guard = acquireTargetCacheGuard(targetsRoot, "exclusive");
  try {
    const verified = await verifySemanticTargetUnderGuard({ corpusDir, outputDir: targetsDir, targetId }, guard);
    const payload = validateEvidencePayload({
      schemaVersion: 1,
      format: EVIDENCE_FORMAT,
      corpus: corpusPin(corpus),
      target: { id: targetId, word: verified.targetWord, wordSha256: verified.targetWordSha256 },
      scoreContractSha256: verified.contractHash,
      targetManifest: { sha256: verified.manifestSha256, utf8: verified.manifestUtf8 },
      verification: {
        kind: "automated-exhaustive",
        verifierContract: "verify-semantic-target-v2@2",
        dictionarySize: verified.dictionarySize,
        valuePages: verified.valuePages,
        orderPages: verified.orderPages,
        histogramSha256: verified.histogramSha256,
        checks: ["scores", "histogram", "competition-ranks", "stable-order"],
      },
      neighborhood: { order: SCORE_CONTRACT.stableOrder, targetExcludedByIdentity: true, entries: verified.topNeighbors },
    }, corpusPin(corpus));
    const digest = sha256(Buffer.from(stableJson(payload)));
    const file = `evidence-${String(targetId).padStart(10, "0")}-${digest}.json`;
    const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
    if (bytes.length > MAX_EVIDENCE_BYTES) throw new Error("Editorial evidence exceeds its size limit");
    await installImmutable(join(evidenceDir, file), bytes);
    await verifyEvidencePayloadAgainstCorpus(corpusDir, corpus, payload);
    await installIndex({ evidenceDir, corpus, targetId, file, digest, capturedAt });
    return { corpusId: corpus.manifest.corpusId, targetId, evidenceSha256: digest, file, neighbors: verified.topNeighbors.length };
  } finally { releaseTargetCacheGuard(guard); }
}

async function installIndex({ evidenceDir, corpus, targetId, file, digest, capturedAt }) {
  const index = await loadEditorialEvidenceIndex(evidenceDir, corpus);
  const existing = index.entries.find(entry => entry.targetId === targetId);
  if (existing && (existing.sha256 !== digest || existing.file !== file)) throw new Error(`Immutable editorial evidence differs: ${targetId}`);
  if (!existing) {
    index.entries.push({ targetId, file, sha256: digest, capturedAt });
    index.entries.sort((left, right) => left.targetId - right.targetId);
    const bytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
    if (bytes.length > MAX_INDEX_BYTES) throw new Error("Editorial evidence index exceeds its size limit");
    await durableWrite(join(evidenceDir, "index.json"), bytes);
  }
  return evidenceDir;
}

function parseArgs(argv) {
  const operation = argv[0];
  if (!["capture", "verify"].includes(operation)) throw new Error("Usage: capture|verify --corpus DIR --targets DIR --evidence DIR --target-id N");
  const values = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || Object.hasOwn(values, key)) throw new Error("Editorial evidence arguments are invalid");
    values[key] = value;
  }
  const allowed = operation === "capture" ? new Set(["--corpus", "--targets", "--evidence", "--target-id"]) : new Set(["--corpus", "--evidence", "--target-id", "--expected-sha256"]);
  if (Object.keys(values).some(key => !allowed.has(key)) || !values["--corpus"] || !values["--evidence"] || values["--target-id"] === undefined || operation === "capture" && !values["--targets"]) throw new Error("Editorial evidence arguments are incomplete");
  const common = { corpusDir: values["--corpus"], evidenceDir: values["--evidence"], targetId: Number(values["--target-id"]) };
  return operation === "capture" ? { operation, options: { ...common, targetsDir: values["--targets"] } } : { operation, options: { ...common, expectedSha256: values["--expected-sha256"] ?? null } };
}

if (process.argv[1] && basename(process.argv[1]) === "editorial-evidence-v2.mjs") {
  const { operation, options } = parseArgs(process.argv.slice(2));
  const action = operation === "capture" ? captureEditorialEvidence(options) : verifyEditorialEvidence(options);
  action.then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
