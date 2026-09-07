// Server-only data path. Never import this module into a client component.
import dataset from "@/data/semantic-fr.json";
import type { Mode } from "./game-types";
import { getLegacyPuzzle, resolveLegacyTargetIndexes } from "./legacy-puzzles";
export { parisDate, nextParisMidnight } from "./calendar";

const words: string[] = dataset.words;
const targets = dataset.puzzles;
const legacyTargetIndexes = resolveLegacyTargetIndexes(targets);
const wordIndex = new Map(words.map((word, i) => [word, i]));
const fold = (word: string) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
const aliases = new Map<string, number | null>();
for (let i = 0; i < words.length; i++) {
  const key = fold(words[i]);
  if (!aliases.has(key)) aliases.set(key, i);
  else if (aliases.get(key) !== i) aliases.set(key, null);
}
export function normalizeWord(input: string) { return input.trim().toLocaleLowerCase("fr").normalize("NFC").replace(/’/g, "'"); }
export function findWord(input: string): number | undefined {
  const word = normalizeWord(input);
  const exact = wordIndex.get(word);
  if (exact !== undefined) return exact;
  const alias = aliases.get(fold(word));
  return alias === null ? undefined : alias;
}
export function getPuzzle(mode: Mode, seed = "", now = new Date()) {
  const { publicPuzzle, legacyIndex } = getLegacyPuzzle(mode, seed, now);
  return { publicPuzzle, targetIndex: legacyTargetIndexes[legacyIndex] };
}
// Only decoded targets are bounded here; the full encoded V1 JSON still occupies memory.
// B1 replaces that retained matrix with versioned shards and a byte-bounded cache.
const scoreCache = new Map<number, { scores: Int16Array; ranks: Uint32Array; order: number[] }>();
function targetScores(targetIndex: number) {
  const hit = scoreCache.get(targetIndex);
  if (hit) return hit;
  const bytes = Uint8Array.from(atob(targets[targetIndex].scores), c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const scores = new Int16Array(words.length);
  for (let i = 0; i < words.length; i++) scores[i] = view.getInt16(i * 2, true);
  const order = Array.from({ length: words.length }, (_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  const ranks = new Uint32Array(words.length);
  order.forEach((index, rank) => { ranks[index] = rank > 0 && scores[index] === scores[order[rank - 1]] ? ranks[order[rank - 1]] : rank + 1; });
  const value = { scores, ranks, order };
  if (scoreCache.size >= 5) scoreCache.delete(scoreCache.keys().next().value!);
  scoreCache.set(targetIndex, value);
  return value;
}
export function evaluateWord(targetIndex: number, index: number) {
  const { scores, ranks } = targetScores(targetIndex);
  const found = words[index] === targets[targetIndex].word;
  return { word: words[index], temperature: found ? 100 : Math.min(99.9, Math.round(scores[index] / 10) / 10), rank: found ? 1 : ranks[index], found };
}
export function nextHint(targetIndex: number, hintLevel: number, guesses: string[]) {
  const { order, ranks } = targetScores(targetIndex);
  const used = new Set(guesses.map(normalizeWord));
  const bestRank = guesses.reduce((best, word) => {
    const index = findWord(word); return index === undefined ? best : Math.min(best, ranks[index]);
  }, words.length);
  const desiredRank = Math.min([350, 80, 12][Math.min(2, Math.max(0, hintLevel))], Math.max(1, Math.floor(bestRank * .55)));
  // Avoid obvious inflections of the target as hints: keep the discovery moment.
  const target = targets[targetIndex].word;
  const stem = fold(target).slice(0, Math.max(3, target.length - 2));
  const candidate = order.slice(desiredRank, Math.min(bestRank - 1, desiredRank + 1000)).find(i => !used.has(words[i]) && words[i] !== target && !fold(words[i]).startsWith(stem));
  return candidate === undefined ? null : evaluateWord(targetIndex, candidate);
}
export const datasetMetadata = dataset.meta;
export function exportDataset() { return dataset; }
