import type { WordEvaluation } from "./game-contracts";
export type TwoBraisesGuess = { edition: "deux-braises-v1"; pair: number; word: string; values: [WordEvaluation, WordEvaluation]; acceptedAt: string };
