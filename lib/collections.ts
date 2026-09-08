import type { Win } from "./game-types";

// Public edition: challenge references only, never answer words or target indexes.
// Immutable seeds preserve the frozen V1 scoring and existing personal saves.
export const NATURE_COLLECTION = {
  id: "nature-v1",
  title: "Nature",
  corpusVersion: "fr-fasttext-30000-v1",
  rulesVersion: "classic-v1",
  seeds: ["1000000046", "1000000038", "1000000032", "1000000279", "1000000010", "1000000049", "1000000036", "1000000168", "1000000066", "1000000043", "1000000090", "1000000054"],
} as const;

export function collectionProgress(wins: readonly Win[]) {
  const won = new Set(wins.filter(win => win.mode === "challenge" || win.mode === "free").map(win => win.id));
  const completed = NATURE_COLLECTION.seeds.map(seed => won.has(`free-${seed}`));
  return { completed, count: completed.filter(Boolean).length, next: completed.findIndex(value => !value) };
}
