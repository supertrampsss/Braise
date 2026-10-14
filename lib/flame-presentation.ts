/** Presentation only: the caller supplies the best accepted guess. */
export function flameLevel(proximity: number, solved: boolean) {
  const safe = Number.isFinite(proximity) ? Math.max(0, Math.min(1, proximity)) : 0;
  // Flame and percentage describe the same fill; 100% requires the answer.
  return solved ? 1 : Math.min(.99, safe);
}
