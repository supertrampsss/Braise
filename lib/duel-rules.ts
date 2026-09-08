export type DuelGuess = { guest_id: string; round: number; word: string; ordinal: number; temperature: number; rank: number; found: number };
export function roundFacts(guesses: readonly DuelGuess[], guest: string, round: number) {
  const rows = guesses.filter(guess => guess.guest_id === guest && guess.round === round);
  const found = rows.some(guess => guess.found === 1);
  return { found, attempts: rows.length, bestRank: rows.length ? Math.min(...rows.map(guess => guess.rank)) : null, closed: found || rows.length >= 30 };
}
export function compareRound(a: ReturnType<typeof roundFacts>, b: ReturnType<typeof roundFacts>): -1 | 0 | 1 {
  if (a.found !== b.found) return a.found ? -1 : 1;
  const left = a.found ? a.attempts : a.bestRank ?? 30001;
  const right = b.found ? b.attempts : b.bestRank ?? 30001;
  return left === right ? 0 : left < right ? -1 : 1;
}
