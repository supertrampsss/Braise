import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { decodeTrainingPack, emptyTrainingProgress, readTrainingProgress, saveTrainingProgress, TRAINING_INFO, TRAINING_STORAGE_KEY, trainingScore, validTrainingPack, type TrainingPack } from "../lib/training";

const bytes = readFileSync(`public${TRAINING_INFO.path}`);
const pack = JSON.parse(bytes.toString()) as TrainingPack;
const arrayBuffer = (data: Uint8Array) => Uint8Array.from(data).buffer;
class Memory {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

test("all 624 pack entries independently match pinned executable V1 and every immutable shell byte is reproducible", () => {
  const output = execFileSync(process.execPath, ["scripts/build-training-pack.mjs", "--verify"], { encoding: "utf8" });
  const evidence = JSON.parse(output);
  assert.equal(evidence.comparisons, 624);
  assert.equal(evidence.sourceCommit, "85b05a71cba67b3283e1a19a1745d2d90570bcd2");
  assert.equal(evidence.oracleSourceSha256, "e236e7505e25140cea77c21201143542e20c15c70ec885e8a4c820f8ab62c482");
});

test("client admits exact pinned bytes, rejects corruption, truncation and future schema", async () => {
  assert.deepEqual(await decodeTrainingPack(arrayBuffer(bytes)), pack);
  const altered = Uint8Array.from(bytes); altered[100] ^= 1;
  await assert.rejects(decodeTrainingPack(altered.buffer), /altéré/);
  await assert.rejects(decodeTrainingPack(arrayBuffer(bytes.subarray(1))), /incomplet/);
  assert.equal(validTrainingPack({ ...pack, schema: 2 }), false);
  assert.equal(validTrainingPack({ ...pack, rankScope: 208 }), false);
  const badScore = structuredClone(pack); badScore.puzzles[0].scores[0].temperature = NaN;
  assert.equal(validTrainingPack(badScore), false);
});

test("unknown and ambiguous accentless words return no score; finite scope is not V1 absence", () => {
  assert.equal(trainingScore(pack.puzzles[0], "un-mot-absent"), null);
  assert.equal(trainingScore(pack.puzzles[0], "curiosite"), null);
  assert.equal(trainingScore(pack.puzzles[0], "  POMME  ")?.found, true);
  assert.equal(trainingScore(pack.puzzles[2], "curiosité")?.found, true);
});

test("separate training progress restores words and hints without changing daily/profile keys", () => {
  const storage = new Memory();
  storage.setItem("braise.v1.profile", '{"guesses":17}');
  storage.setItem("braise.v1.game.daily-2026-10-12", '{"untouched":true}');
  const before = [...storage.data];
  const progress = emptyTrainingProgress(pack);
  progress.games[pack.puzzles[0].id] = { words: ["banane", "pomme"], hints: 2 };
  const raw = saveTrainingProgress(storage, null, progress, pack);
  assert.deepEqual(readTrainingProgress(raw, pack), { ok: true, value: progress });
  assert.deepEqual([...storage.data].filter(([key]) => key !== TRAINING_STORAGE_KEY), before);
  assert.equal([...storage.data].filter(([key]) => key.startsWith("braiz.training.")).length, 1);
});

test("future, malformed and concurrently changed saves remain byte-for-byte preserved", () => {
  for (const raw of ['{"schema":999,"future":"preserve"}', "{broken", JSON.stringify({ ...emptyTrainingProgress(pack), packSha256: "old" })]) {
    const storage = new Memory(); storage.setItem(TRAINING_STORAGE_KEY, raw);
    assert.equal(readTrainingProgress(raw, pack).ok, false);
    assert.throws(() => saveTrainingProgress(storage, null, emptyTrainingProgress(pack), pack), /autre onglet/);
    assert.throws(() => saveTrainingProgress(storage, raw, emptyTrainingProgress(pack), pack), /conservées/);
    assert.equal(storage.getItem(TRAINING_STORAGE_KEY), raw);
  }
  const progress = emptyTrainingProgress(pack); progress.games[pack.puzzles[0].id].words = ["pomme", "banane"];
  assert.equal(readTrainingProgress(JSON.stringify(progress), pack).ok, false);
  progress.games[pack.puzzles[0].id].words = ["banane", "banane"];
  assert.equal(readTrainingProgress(JSON.stringify(progress), pack).ok, false);
});

test("editorial levels explicitly describe reviewed targets and progressive nonnumeric hints", () => {
  assert.deepEqual(pack.puzzles.map(p => p.level), ["Facile", "Standard", "Exploration"]);
  assert.deepEqual(pack.puzzles.map(p => p.scores.find(s => s.found)?.word), ["pomme", "port", "curiosité"]);
  assert.equal(pack.puzzles.flatMap(p => p.hints).length, 9);
  assert.ok(pack.puzzles.every(p => p.definition.length > 50 && p.hints.every(h => h.length > 20)));
});
