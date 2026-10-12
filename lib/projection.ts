export type Projection = { revision: number; won: boolean; temperatures: number[]; refreshedAt: number };
export function projectionFreshness(refreshedAt: number | null, now: number): "unknown" | "fresh" | "stale" {
  return refreshedAt === null ? "unknown" : now - refreshedAt > 45000 || now < refreshedAt ? "stale" : "fresh";
}
/** Explicit allowlist: no game IDs, seeds, words, solutions, guests or opponent facts. */
export function sanitizeProjection(view: { game: { revision: number; state: string }; guesses: unknown[] }, now: number): Projection {
  const temperatures = view.guesses.map(item => (item as { temperature: number }).temperature);
  if (temperatures.some(value => !Number.isFinite(value) || value < -100 || value > 100)) throw new Error("Invalid projection");
  return { revision: view.game.revision, won: view.game.state === "won", temperatures, refreshedAt: now };
}
