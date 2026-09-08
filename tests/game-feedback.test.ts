import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeGameFeedback, createGameFeedback, inputAfterAcceptedGuess, shouldAdmitGameFeedback } from "../lib/game-feedback";
import { getPuzzle } from "../lib/semantic";
import type { Guess } from "../lib/game-types";

const ref = getPuzzle("free", "1234").publicPuzzle.ref;
const guess = (order: number, temperature: number, found = false): Guess => ({
  word: `mot-${order}`,
  temperature,
  rank: Math.max(1, 1000 - order),
  found,
  order,
});

test("accepted guesses produce one identified feedback with visual priority", () => {
  assert.equal(createGameFeedback(null, guess(1, 20), ref).type, "guessAccepted");
  assert.equal(createGameFeedback(20, guess(2, 19), ref).type, "guessAccepted");
  assert.equal(createGameFeedback(20, guess(3, 21), ref).type, "bestImproved");
  assert.equal(createGameFeedback(99, guess(4, 100, true), ref).type, "puzzleWon");
  assert.equal(createGameFeedback(20, guess(3, 21), ref).id, `${ref.id}:3:bestImproved`);
});

test("an expired timer only consumes its own feedback", () => {
  const first = createGameFeedback(20, guess(2, 30), ref);
  const second = createGameFeedback(30, guess(3, 40), ref);
  assert.equal(consumeGameFeedback(first, first.id), null);
  assert.equal(consumeGameFeedback(second, first.id), second);
  assert.equal(consumeGameFeedback(second, second.id), null);
});

test("a consumed feedback id cannot be admitted twice in the same puzzle epoch", () => {
  const event = createGameFeedback(20, guess(2, 30), ref);
  const consumed = new Set<string>();
  assert.equal(shouldAdmitGameFeedback(consumed, event), true);
  consumed.add(event.id);
  assert.equal(shouldAdmitGameFeedback(consumed, event), false);
});

test("a response clears only an input that was not edited during the request", () => {
  assert.equal(inputAfterAcceptedGuess(" mer ", false, 4, 4), "");
  assert.equal(inputAfterAcceptedGuess("plage", false, 5, 4), "plage");
  assert.equal(inputAfterAcceptedGuess("mer", false, 5, 4), "mer");
  assert.equal(inputAfterAcceptedGuess("plage", true, 4, 4), "plage");
});
