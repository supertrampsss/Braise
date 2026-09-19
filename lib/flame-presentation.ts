/** Presentation only: the caller supplies the best accepted guess. */
export function flameLevel(temperature: number, solved: boolean) {
  const safe = Number.isFinite(temperature) ? Math.max(0, Math.min(100, temperature)) : 0;
  // A score alone is never a win. Even a rounded 100 stays below full reveal.
  return solved ? 1 : .08 + .83 * safe / 100;
}
