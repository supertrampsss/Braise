// Server-only identities. Keep this manifest out of client imports.
import manifest from "@/data/legacy-v1.json";
import { nextParisMidnight, parisDate } from "./calendar";
import { CONTRACT_VERSION } from "./game-contracts";
import type { Mode, Puzzle } from "./game-types";

function seedHash(seed: string) {
  let hash = 2166136261;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Resolving by word protects historical answers even if a later catalogue is reordered.
export function resolveLegacyTargetIndexes(catalogue: readonly { word: string }[]) {
  if (manifest.targetCount !== 120 || manifest.targets.length !== manifest.targetCount) throw new Error("Invalid frozen V1 catalogue");
  const indexes = new Map<string, number>();
  catalogue.forEach((target, index) => {
    if (indexes.has(target.word)) throw new Error("Duplicate semantic target: " + target.word);
    indexes.set(target.word, index);
  });
  return manifest.targets.map(word => {
    const index = indexes.get(word);
    if (index === undefined) throw new Error("Missing V1 semantic target: " + word);
    return index;
  });
}

export function getLegacyPuzzle(mode: Mode, seed = "", now = new Date()) {
  const date = parisDate(now);
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${manifest.epoch}T00:00:00Z`)) / 86400000);
  const daily = mode === "daily";
  const effectiveSeed = daily ? date : seed;
  const legacyIndex = daily
    ? ((day * manifest.multiplier + manifest.offset) % manifest.targetCount + manifest.targetCount) % manifest.targetCount
    : seedHash(effectiveSeed) % manifest.targetCount;
  const id = daily ? `daily-${date}` : `free-${effectiveSeed}`;
  const publicPuzzle: Puzzle = {
    id, mode, seed: effectiveSeed, date,
    number: daily ? Math.max(1, day + 1) : legacyIndex + 1,
    vocabularySize: manifest.dictionarySize,
    resetAt: nextParisMidnight(now),
    ref: {
      contractVersion: CONTRACT_VERSION, id,
      corpusVersion: manifest.corpusVersion, rulesVersion: manifest.rulesVersion,
      context: mode, variant: "classic",
      calendar: daily ? { version: manifest.calendarVersion, date } : null,
    },
  };
  return { publicPuzzle, legacyIndex };
}
