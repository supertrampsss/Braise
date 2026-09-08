// Public contracts only: no target word, target index or score matrix here.
export const CONTRACT_VERSION = 1 as const;
export const LEGACY_VERSIONS = {
  corpus: "fr-fasttext-30000-v1",
  rules: "classic-v1",
  calendar: "paris-daily-v1",
  save: 1,
} as const;

export type GameContext = "daily" | "archive" | "free" | "challenge" | "collection" | "expedition" | "circle" | "duel" | "creation";
export type Variant = "classic" | "two-braises" | "intruder" | "chain";
export type PuzzleRef = {
  contractVersion: typeof CONTRACT_VERSION;
  id: string;
  corpusVersion: string;
  rulesVersion: string;
  context: GameContext;
  variant: Variant;
  calendar: { version: string; date: string } | null;
};

// Order is assigned by the local game in V1, never represented as server-verified.
export type WordEvaluation = { word: string; temperature: number; rank: number; found: boolean };
export type EvaluationResponse = WordEvaluation & { puzzleRef: PuzzleRef };
export type GuessResult = EvaluationResponse & { order: number; hint?: boolean };

// Durable state and one-time effects are deliberately independent.
export type GameState = "loading" | "ready" | "submitting" | "error" | "won";
export type GameEffect = { id: string; type: "guessAccepted" | "bestImproved" | "puzzleWon"; puzzleRef: PuzzleRef };
export type ProgressEvent = {
  id: string;
  type: "guessAccepted" | "puzzleWon" | "contentCompleted";
  puzzleRef: PuzzleRef;
  occurredAt: string;
  provenance: "personal-local" | "server-verified";
  clock: "device" | "server";
};
export type ContentManifest = {
  id: string;
  edition: number;
  language: "fr";
  title: string;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published" | "withdrawn";
  resources: string[];
  attributions: { title: string; url: string; license: string }[];
};
export type AdDecision = {
  placement: "game-display" | "expedition-break" | "duel-summary";
  consent: "not-required" | "unknown" | "granted" | "denied";
  available: boolean;
  frequencyAllowed: boolean;
  result: "show" | "skip";
  reason: "eligible" | "not-configured" | "consent" | "frequency" | "game-active" | "unavailable";
};

export function samePuzzleRef(candidate: unknown, expected: PuzzleRef): candidate is PuzzleRef {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const ref = candidate as Partial<PuzzleRef>;
  return ref.contractVersion === expected.contractVersion && ref.id === expected.id &&
    ref.corpusVersion === expected.corpusVersion && ref.rulesVersion === expected.rulesVersion &&
    ref.context === expected.context && ref.variant === expected.variant &&
    (expected.calendar === null ? ref.calendar === null :
      !!ref.calendar && typeof ref.calendar === "object" && !Array.isArray(ref.calendar) &&
      ref.calendar.version === expected.calendar.version && ref.calendar.date === expected.calendar.date);
}
