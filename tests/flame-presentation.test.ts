import assert from "node:assert/strict";
import test from "node:test";
import { flameLevel } from "../lib/flame-presentation";

test("approved flame has an ember at zero and only a recognized win fully reveals it", () => {
  assert.equal(flameLevel(0, false), .08);
  assert.ok(flameLevel(100, false) < 1);
  assert.equal(flameLevel(100, true), 1);
  assert.equal(flameLevel(Number.NaN, false), .08);
});

test("accepted best temperatures reveal bottom-up without reaching full before a win", () => {
  const levels = [0, 12, 25, 55, 99, 100].map(value => flameLevel(value, false));
  assert.ok(levels.every((value, index) => index === 0 || value >= levels[index - 1]));
  assert.ok(levels.every(value => value < 1));
  assert.equal(flameLevel(-20, false), flameLevel(0, false));
});
