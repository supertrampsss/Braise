import { evaluateWord, findWord, getPuzzle } from "./semantic";

export const TWO_BRAISES_EDITION = "deux-braises-v1";
// Immutable V1 pairs; this API does not expose their ordered reference seeds.
const PAIRS = [
  ["1000000046", "1000000038"], ["1000000032", "1000000279"],
  ["1000000010", "1000000049"], ["1000000036", "1000000168"],
  ["1000000066", "1000000043"], ["1000000090", "1000000054"],
  ["1000000051", "1000000018"], ["1000000119", "1000000057"],
  ["1000000045", "1000000274"], ["1000000192", "1000000309"],
  ["1000000065", "1000000008"], ["1000000108", "1000000339"],
] as const;
export function twoBraisesPuzzle(pair: number) {
  if (!Number.isInteger(pair) || pair < 0 || pair >= PAIRS.length) throw new Error("invalid-pair");
  return { edition: TWO_BRAISES_EDITION, pair, total: PAIRS.length, corpus: "fr-fasttext-30000-v1" };
}
export async function evaluateTwoBraises(pair: number, word: unknown) {
  const puzzle = twoBraisesPuzzle(pair);
  if (typeof word !== "string" || word.length > 50) throw new Error("invalid-word");
  const index = findWord(word);
  if (index === undefined) return null;
  const values = await Promise.all(PAIRS[pair].map(seed => evaluateWord(getPuzzle("challenge", seed).targetIndex, index)));
  return { ...puzzle, word: values[0].word, values };
}
