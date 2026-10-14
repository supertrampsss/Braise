/** Presentation only: the caller supplies the best accepted guess. */
export function flameLevel(proximity: number, solved: boolean) {
  const safe = Number.isFinite(proximity) ? Math.max(0, Math.min(1, proximity)) : 0;
  // Only the recognized exact answer fully reveals the flame.
  return solved ? 1 : .08 + .83 * safe;
}
