export const DUEL_VOCABULARY_SIZE = 30000;
export const DUEL_ATTEMPTS = 30;
export const DUEL_ROUNDS = [0, 1, 2] as const;
export type DuelGuessView = { round: number; word: string; ordinal: number; temperature: number; rank: number; found: number };
export type DuelView = {
  id: string; hostName: string; opponentName: string | null; inviteExpires: number;
  state: string; deadline: number | null; role: string; forfeiter: string | null;
  decisions: number[] | null; guesses: DuelGuessView[];
};
export function duelRound(view: DuelView, round: number, now: number) {
  const guesses = view.guesses.filter(guess => guess.round === round);
  const ordered = [...guesses].sort((a,b) => a.rank-b.rank || b.ordinal-a.ordinal);
  const won = guesses.some(guess => guess.found === 1);
  const expired = view.deadline !== null && view.deadline <= now;
  return { guesses, ordered, best: ordered[0] ?? null, won, expired, closed: won || guesses.length >= DUEL_ATTEMPTS || expired || view.state !== 'active' };
}
export function duelOutcome(view: DuelView) {
  if(view.state !== 'finished') return null;
  if(view.forfeiter) return { title:view.forfeiter===view.role?'Duel abandonné':'Duel remporté', note:view.forfeiter===view.role?'Vous avez abandonné.':'Votre adversaire a abandonné.' };
  if(!view.decisions || view.decisions.length!==3) throw new Error('Résultat du duel incomplet.');
  const won = view.decisions.filter(decision => decision === (view.role==='host' ? -1 : 1)).length;
  const lost = view.decisions.filter(decision => decision === (view.role==='host' ? 1 : -1)).length;
  return { title:won>lost?'Duel remporté':won<lost?'Duel perdu':'Égalité', note:`${won} — ${lost}` };
}
export function invitationToken(value: string) {
  const text=value.trim();
  if(/^[a-f0-9]{64}$/.test(text)) return text;
  try { return new URLSearchParams(new URL(text).hash.slice(1)).get('invitation') ?? text; }
  catch { return text; }
}
