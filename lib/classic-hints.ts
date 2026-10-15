export const MAX_CLASSIC_HINTS = 3;

/** Select a real unused rank strictly ahead of the best attempt; never the answer. */
export function betterHintId(ranks: ArrayLike<number>, used: ReadonlySet<number>, level: number, eligible: (id:number)=>boolean = ()=>true): number | null {
  if (!Number.isInteger(level) || level < 0 || level >= MAX_CLASSIC_HINTS) throw new RangeError('Invalid hint level');
  let bestRank=ranks.length;
  for (const id of used) bestRank = Math.min(bestRank, ranks[id]);
  const desired = Math.max(2, Math.floor(bestRank * .75));
  const minimumRank = Math.max(2, Math.ceil(bestRank * .6));
  let candidate: number | null = null, distance = Infinity;
  for (let id = 0; id < ranks.length; id++) {
    const rank = ranks[id];
    if (rank < minimumRank || rank >= bestRank || used.has(id) || !eligible(id)) continue;
    const delta = Math.abs(rank - desired);
    if (delta < distance) { candidate = id; distance = delta; }
  }
  return candidate;
}
