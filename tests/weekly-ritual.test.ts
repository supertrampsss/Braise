import { test } from "node:test";
import assert from "node:assert/strict";
import { COSMETICS, WEEKLY_OBJECTIVES, projectWeeklyRitual, weekStartParis, type ProgressFact, type ProgressWin } from "../lib/weekly-ritual";

function guesses(count: number, start = "2026-09-07", prefix = "guess"): ProgressFact[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}:${index}`,
    type: "guessAccepted",
    occurredAt: `${start}T${String(index % 20).padStart(2, "0")}:00:00.000Z`,
  }));
}

test("Paris weeks start on Monday across DST and year boundaries", () => {
  assert.equal(weekStartParis(new Date("2027-03-28T21:59:59.999Z")), "2027-03-22");
  assert.equal(weekStartParis(new Date("2027-03-28T22:00:00.000Z")), "2027-03-29");
  assert.equal(weekStartParis(new Date("2026-10-25T22:59:59.999Z")), "2026-10-19");
  assert.equal(weekStartParis(new Date("2026-10-25T23:00:00.000Z")), "2026-10-26");
  assert.equal(weekStartParis(new Date("2027-01-03T22:59:59.999Z")), "2026-12-28");
  assert.equal(weekStartParis(new Date("2027-01-03T23:00:00.000Z")), "2027-01-04");
});

test("the configured ritual has exactly three varied and stable objectives", () => {
  assert.equal(WEEKLY_OBJECTIVES.length, 3);
  assert.equal(new Set(WEEKLY_OBJECTIVES.map(objective => objective.id)).size, 3);
  assert.equal(new Set(WEEKLY_OBJECTIVES.map(objective => objective.kind)).size, 3);
  assert.equal(new Set(WEEKLY_OBJECTIVES.map(objective => objective.reward)).size, 3);
  assert.ok(WEEKLY_OBJECTIVES.every(objective => objective.target > 0));
  assert.equal(COSMETICS[0].id, "classic");
});

test("real dated facts complete the three objectives and earn each reward once", () => {
  const facts = [
    ...guesses(13, "2026-09-07", "monday"),
    ...guesses(1, "2026-09-09", "wednesday"),
    ...guesses(1, "2026-09-13", "sunday"),
  ];
  const wins: ProgressWin[] = [
    { id: "daily-2026-09-07", hints: 0, completedAt: "2026-09-07T20:00:00.000Z" },
    { id: "daily-2026-09-01", hints: 0, completedAt: "2026-09-09T20:00:00.000Z" },
  ];
  const projection = projectWeeklyRitual([...facts, ...facts], [...wins, ...wins], new Date("2026-09-13T21:59:59.999Z"));
  assert.deepEqual(projection.objectives.map(objective => [objective.value, objective.complete]), [[15, true], [3, true], [2, true]]);
  assert.equal(projection.earnedRewardIds.length, 3);
  assert.deepEqual(projection.unlockedCosmetics, ["classic", "copper", "aurora", "solar"]);
});

test("hints, future facts and undated legacy wins never invent weekly progress", () => {
  const facts: ProgressFact[] = [
    { id: "hint:one", type: "hintAccepted", occurredAt: "2026-09-08T10:00:00.000Z" },
    { id: "guess:future", type: "guessAccepted", occurredAt: "2026-09-14T10:00:00.000Z" },
  ];
  const wins: ProgressWin[] = [
    { id: "legacy", hints: 0 },
    { id: "future", hints: 0, completedAt: "2026-09-14T10:00:00.000Z" },
    { id: "hinted", hints: 1, completedAt: "2026-09-08T10:00:00.000Z" },
  ];
  const projection = projectWeeklyRitual(facts, wins, new Date("2026-09-08T12:00:00.000Z"));
  assert.deepEqual(projection.objectives.map(objective => objective.value), [0, 0, 0]);
  assert.deepEqual(projection.unlockedCosmetics, ["classic"]);
});

test("past rewards remain unlocked after the weekly counters reset", () => {
  const facts = [
    ...guesses(13, "2026-09-07", "monday"),
    ...guesses(1, "2026-09-09", "wednesday"),
    ...guesses(1, "2026-09-13", "sunday"),
  ];
  const wins: ProgressWin[] = [
    { id: "free-one", hints: 0, completedAt: "2026-09-08T10:00:00.000Z" },
    { id: "free-two", hints: 0, completedAt: "2026-09-10T10:00:00.000Z" },
  ];
  const projection = projectWeeklyRitual(facts, wins, new Date("2026-09-14T10:00:00.000Z"));
  assert.deepEqual(projection.objectives.map(objective => objective.value), [0, 0, 0]);
  assert.deepEqual(projection.unlockedCosmetics, ["classic", "copper", "aurora", "solar"]);
});

test("only the latest available cosmetic selection becomes active", () => {
  const facts: ProgressFact[] = [
    ...guesses(15, "2026-09-07"),
    { id: "cosmetic:locked", type: "cosmeticChanged", value: "solar", occurredAt: "2026-09-08T10:00:00.000Z" },
    { id: "cosmetic:copper", type: "cosmeticChanged", value: "copper", occurredAt: "2026-09-08T11:00:00.000Z" },
  ];
  const projection = projectWeeklyRitual(facts, [], new Date("2026-09-08T12:00:00.000Z"));
  assert.deepEqual(projection.unlockedCosmetics, ["classic", "copper"]);
  assert.equal(projection.selectedCosmetic, "copper");
});

test("a materialized reward stays permanent after a later win reconciliation", () => {
  const before = projectWeeklyRitual([], [
    { id: "daily-2026-09-13", hints: 0, completedAt: "2026-09-14T08:00:00.000Z" },
    { id: "free-one", hints: 0, completedAt: "2026-09-14T09:00:00.000Z" },
  ], new Date("2026-09-14T10:00:00.000Z"));
  const rewardId = before.objectives.find(objective => objective.reward === "solar")!.rewardId;
  assert.ok(before.earnedRewardIds.includes(rewardId));

  const facts: ProgressFact[] = [
    { id: `weekly-reward:${rewardId}`, type: "weeklyRewardEarned", rewardId, value: "solar", occurredAt: "2026-09-14T10:00:00.000Z" },
    { id: "cosmetic:solar", type: "cosmeticChanged", value: "solar", occurredAt: "2026-09-14T10:01:00.000Z" },
  ];
  const after = projectWeeklyRitual(facts, [
    { id: "daily-2026-09-13", hints: 0, completedAt: "2026-09-13T20:00:00.000Z" },
    { id: "free-one", hints: 0, completedAt: "2026-09-14T09:00:00.000Z" },
  ], new Date("2026-09-14T11:00:00.000Z"));
  assert.ok(after.earnedRewardIds.includes(rewardId));
  assert.ok(after.unlockedCosmetics.includes("solar"));
  assert.equal(after.selectedCosmetic, "solar");
});
