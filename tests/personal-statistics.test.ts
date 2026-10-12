import test from "node:test";
import assert from "node:assert/strict";
import { median, personalStatistics } from "../lib/personal-statistics";
import type { Win } from "../lib/game-types";

const now = new Date("2026-10-12T12:00:00Z");
const win = (id: string, overrides: Partial<Win> = {}): Win => ({ id, date: "2026-10-12", mode: "daily", tries: 4, hints: 0, ...overrides });
test("median never fills absent or invalid observations with zero", () => {
  assert.equal(median([]), null);
  assert.equal(median([null, undefined, NaN, Infinity, -1]), null);
  assert.equal(median([8, 2, undefined, 4, 6]), 5);
  assert.equal(median([0, 3, 1]), 1);
});
test("wins by mode and daily streak keep archives separate without inventing completion dates", () => {
  const result = personalStatistics([
    win("daily-2026-10-12"), win("daily-2026-10-11", { date: "2026-10-11" }),
    win("daily-2026-10-10", { mode: "archive", date: "2026-10-10" }),
    win("free-2", { mode: "free", completedAt: "2026-10-10T20:00:00Z", tries: 10, hints: 2 }),
    win("free-2", { mode: "free", completedAt: "2026-10-10T20:00:00Z", tries: 10, hints: 2 }),
  ], now);
  assert.equal(result.totalWins, 4); assert.equal(result.dailyStreak, 2);
  assert.equal(result.modes.find(mode => mode.mode === "archive")?.wins, 1);
  assert.equal(result.undatedWins, 3); assert.equal(result.trend.length, 1);
  assert.equal(result.trend[0].date, "2026-10-10"); assert.equal(result.trend[0].wins, 1);
  assert.equal(result.trend[0].medianTries, 10);
});
test("statistics disclose distinct denominators and exclude future or invalid dates from trends", () => {
  const result = personalStatistics([
    win("a", { tries: NaN, hints: NaN, completedAt: "invalid" }),
    win("b", { tries: 6, hints: 2, completedAt: "2026-10-13T00:00:00Z" }),
    win("c", { tries: 8, hints: 0, completedAt: "2026-10-11T23:30:00Z" }),
  ], now);
  assert.equal(result.medianTries, 7); assert.equal(result.trialsSample, 2);
  assert.equal(result.medianHints, 1); assert.equal(result.hintsSample, 2);
  assert.equal(result.totalHints, 2); assert.equal(result.undatedWins, 2);
  assert.equal(result.trend[0].date, "2026-10-12"); assert.equal(result.trend[0].medianTries, 8);
});
