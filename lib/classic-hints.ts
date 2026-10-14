export const MAX_CLASSIC_HINTS = 3;

/** Select a real unused rank strictly ahead of the best attempt; never the answer. */
export function betterHintId(ranks: ArrayLike<number>, used: ReadonlySet<number>, level: number, bestRank = ranks.length): number | null {
  if (!Number.isInteger(level) || level < 0 || level >= MAX_CLASSIC_HINTS) throw new RangeError('Invalid hint level');
  for (const id of used) bestRank = Math.min(bestRank, ranks[id]);
  const desired = Math.min([350, 80, 12][level], Math.max(2, Math.floor(bestRank * .55)));
  let candidate: number | null = null, distance = Infinity;
  for (let id = 0; id < ranks.length; id++) {
    const rank = ranks[id];
    if (rank <= 1 || rank >= bestRank || used.has(id)) continue;
    const delta = Math.abs(rank - desired);
    if (delta < distance) { candidate = id; distance = delta; }
  }
  return candidate;
}
