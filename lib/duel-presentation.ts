export const DUEL_VOCABULARY_SIZE = 30000;
export const DUEL_WORD2VEC_RULES = 'duel-word2vec-v1';
export type DuelRoundFacts = {found:boolean;attempts:number;bestRank:number|null;closed:boolean};
export type DuelRoundView = {own:DuelRoundFacts;opponent:DuelRoundFacts|null;revealed:boolean;answer?:string;decision:number|null};
export const DUEL_ATTEMPTS = 30;
export const DUEL_ROUNDS = [0, 1, 2] as const;
export type DuelGuessView = { round: number; word: string; ordinal: number; temperature: number; rank: number; found: number };
export type DuelListGroup = 'play' | 'waiting' | 'finished';
export const DUEL_LIST_GROUPS = [
  {id:'play',label:'À jouer'}, {id:'waiting',label:'En attente'}, {id:'finished',label:'Terminés'},
] as const;
export type DuelListItem = {id:string;hostName:string;opponentName:string|null;role?:string;result?:string|null;created_at?:number;state:string;abandoned?:number;deadline?:number|null;invite_expires?:number;score?:{won:number;lost:number;drawn:number};canAcceptRematch?:boolean;rematchOf?:string|null};
export type DuelListPage = {duels:DuelListItem[];nextCursor:string|null;counts:Record<DuelListGroup,number>};
export type DuelView = {
  id: string; hostName: string; opponentName: string | null; inviteExpires: number;
  state: string; deadline: number | null; role: string; forfeiter: string | null;
  decisions: number[] | null; guesses: DuelGuessView[];
  rules?:string; vocabularySize?:number; opponentGuesses?:DuelGuessView[]; rounds?:DuelRoundView[];
  score?:{won:number;lost:number;drawn:number}; rematchOf?:string|null; canAcceptRematch?:boolean;
  invitationVersion?:string;
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

export function duelRoundLabel(view:DuelView,round:number){
 const facts=view.rounds?.[round];if(!facts?.revealed)return facts?.own.closed?'En attente':'En cours';
 return facts.decision===0?'Égalité':facts.decision===(view.role==='host'?-1:1)?'Gagnée':'Perdue';
}
export function duelRoundReason(view:DuelView,round:number){
 const facts=view.rounds?.[round];if(!facts?.revealed||!facts.opponent)return '';
 if(facts.decision===0)return facts.own.attempts+facts.opponent.attempts===0?'Aucun essai':'Même résultat';
 return facts.own.found&&facts.opponent.found?'Moins d’essais':facts.own.found||facts.opponent.found?'Mot trouvé':'Meilleure proximité';
}
export function duelShareText(view:DuelView){
 const result=duelOutcome(view);if(!result)throw new Error('Duel encore en cours.');
 const ownName=view.role==='host'?view.hostName:view.opponentName,otherName=view.role==='host'?view.opponentName:view.hostName;
 const lines=['BRAIZ · Duel',ownName+' vs '+otherName,result.title,result.note];
 if(!view.forfeiter)for(const round of DUEL_ROUNDS)lines.push('Manche '+(round+1)+' : '+(view.decisions![round]===0?'Égalité':view.decisions![round]===(view.role==='host'?-1:1)?'Gagnée':'Perdue'));
 return [...lines,'https://braiz.io/duels'].join('\n');
}
