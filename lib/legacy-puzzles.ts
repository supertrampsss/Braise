// Server-only identities. Keep this manifest out of client imports.
import manifest from "@/data/legacy-v1.json";
import { LEGACY_ARCHIVE_START_DATE, nextParisMidnight, parisDate } from "./calendar";
import { CONTRACT_VERSION } from "./game-contracts";
import type { Mode, Puzzle } from "./game-types";

type LegacyMode = Exclude<Mode, "archive">;

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

function dailyIndex(date: string) {
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${manifest.epoch}T00:00:00Z`)) / 86400000);
  const legacyIndex = ((day * manifest.multiplier + manifest.offset) % manifest.targetCount + manifest.targetCount) % manifest.targetCount;
  return { day, legacyIndex };
}

export function getLegacyPuzzle(mode: LegacyMode, seed = "", now = new Date()) {
  const date = parisDate(now);
  const daily = mode === "daily";
  const effectiveSeed = daily ? date : seed;
  const selection = dailyIndex(date);
  const legacyIndex = daily ? selection.legacyIndex : seedHash(effectiveSeed) % manifest.targetCount;
  const id = daily ? `daily-${date}` : `free-${effectiveSeed}`;
  const publicPuzzle: Puzzle = {
    id, mode, seed: effectiveSeed, date,
    number: daily ? Math.max(1, selection.day + 1) : legacyIndex + 1,
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

export function getLegacyArchivePuzzle(date: string, now = new Date()) {
  if (manifest.epoch !== LEGACY_ARCHIVE_START_DATE) throw new Error("Archive start does not match the frozen V1 calendar");
  const selection = dailyIndex(date);
  const id = `daily-${date}`;
  const publicPuzzle: Puzzle = {
    id,
    mode: "archive",
    seed: date,
    date,
    number: Math.max(1, selection.day + 1),
    vocabularySize: manifest.dictionarySize,
    resetAt: nextParisMidnight(now),
    ref: {
      contractVersion: CONTRACT_VERSION,
      id,
      corpusVersion: manifest.corpusVersion,
      rulesVersion: manifest.rulesVersion,
      context: "archive",
      variant: "classic",
      calendar: { version: manifest.calendarVersion, date },
    },
  };
  return { publicPuzzle, legacyIndex: selection.legacyIndex };
}
