import { parisDate } from "./calendar";
import { getStreak, type Mode, type Win } from "./game-types";

export const PERSONAL_MODES: ReadonlyArray<{ mode: Mode; label: string }> = [
  { mode: "daily", label: "Quotidiens" }, { mode: "archive", label: "Archives" },
  { mode: "free", label: "Libre" }, { mode: "challenge", label: "Défis" },
];
const knownCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
/** A missing observation is never replaced by zero. */
export function median(values: readonly (number | null | undefined)[]): number | null {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const middle = Math.floor(known.length / 2);
  return known.length ? known.length % 2 ? known[middle] : (known[middle - 1] + known[middle]) / 2 : null;
}
function measurements(wins: readonly Win[]) {
  const trials = wins.map(win => win.tries).filter(value => knownCount(value) && value > 0);
  const hints = wins.map(win => win.hints).filter(knownCount);
  return { medianTries: median(trials), trialsSample: trials.length, medianHints: median(hints), hintsSample: hints.length, totalHints: hints.length ? hints.reduce((sum, value) => sum + value, 0) : null };
}
export function personalStatistics(source: readonly Win[], now = new Date()) {
  // Storage already chooses the canonical win per puzzle. Defensively avoid counting replays twice.
  const wins = [...new Map(source.map(win => [win.id, win])).values()];
  const dated = wins.filter(win => win.completedAt && Number.isFinite(Date.parse(win.completedAt)) && Date.parse(win.completedAt) <= now.getTime());
  const byDay = new Map<string, Win[]>();
  for (const win of dated) {
    const date = parisDate(new Date(win.completedAt!));
    byDay.set(date, [...(byDay.get(date) ?? []), win]);
  }
  return {
    totalWins: wins.length, dailyStreak: getStreak(wins, parisDate(now)), ...measurements(wins),
    datedWins: dated.length, undatedWins: wins.length - dated.length,
    modes: PERSONAL_MODES.map(mode => { const selected = wins.filter(win => win.mode === mode.mode); return { ...mode, wins: selected.length, ...measurements(selected) }; }),
    trend: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, selected]) => ({ date, wins: selected.length, ...measurements(selected) })),
    history: [...wins].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || a.id.localeCompare(b.id)),
  };
}
