import type { GameEffect, PuzzleRef } from "./game-contracts";
import type { Guess } from "./game-types";

export function createGameFeedback(previousRank: number | null, guess: Guess, puzzleRef: PuzzleRef): GameEffect {
  const type = guess.found
    ? "puzzleWon"
    : previousRank !== null && guess.rank < previousRank
      ? "bestImproved"
      : "guessAccepted";
  return { id: `${puzzleRef.id}:${guess.order}:${type}`, type, puzzleRef };
}

export function consumeGameFeedback(active: GameEffect | null, id: string) {
  return active?.id === id ? null : active;
}

export function shouldAdmitGameFeedback(consumedIds: ReadonlySet<string>, next: GameEffect) {
  return !consumedIds.has(next.id);
}

export function inputAfterAcceptedGuess(
  currentInput: string,
  isHint: boolean,
  currentRevision: number,
  submittedRevision: number,
) {
  return !isHint && currentRevision === submittedRevision ? "" : currentInput;
}
