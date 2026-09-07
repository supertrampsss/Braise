// Server-only data path. Never import this module into a client component.
import dataset from "@/data/semantic-fr.json";
import type { Mode, Puzzle } from "./game-types";

const words: string[] = dataset.words;
const targets = dataset.puzzles;
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
export function parisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}
export function nextParisMidnight(now = new Date()) {
  // Binary search the next local date transition, including 23/25-hour DST days.
  const today = parisDate(now);
  let lo = now.getTime(); let hi = lo + 27 * 3600000;
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (parisDate(new Date(mid)) === today) lo = mid; else hi = mid; }
  return new Date(Math.ceil(hi / 1000) * 1000).toISOString();
}
function seedHash(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
export function getPuzzle(mode: Mode, seed = "", now = new Date()) {
  const date = parisDate(now);
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse("2026-09-07T00:00:00Z")) / 86400000);
  const daily = mode === "daily";
  const effectiveSeed = daily ? date : seed;
  // 37 and 120 are coprime: each daily target appears once per 120-day cycle.
  const targetIndex = daily ? ((day * 37 + 23) % targets.length + targets.length) % targets.length : seedHash(effectiveSeed) % targets.length;
  const publicPuzzle: Puzzle = {
    id: daily ? `daily-${date}` : `free-${effectiveSeed}`,
    mode, seed: effectiveSeed, date, number: daily ? Math.max(1, day + 1) : targetIndex + 1,
    vocabularySize: words.length, resetAt: nextParisMidnight(now),
  };
  return { publicPuzzle, targetIndex };
}
// A bounded cache keeps the 128MB Worker budget independent of the target count.
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
