'use client';
import {useState,type CSSProperties} from 'react';
import {duelRoundLabel,duelRoundReason,DUEL_ROUNDS,DUEL_VOCABULARY_SIZE,type DuelView,type DuelGuessView,type DuelRoundFacts} from '@/lib/duel-presentation';
import {formatRankFr,proximityColor,proximityFill,proximityPercent} from '@/lib/proximity-presentation';
import {countLabel} from '@/lib/game-copy';

export function DuelProgress({view,round}:{view:DuelView;round:number}){
 const facts=view.rounds?.[round];if(!facts?.opponent)return null;
 const ownName=view.role==='host'?view.hostName:view.opponentName!,otherName=view.role==='host'?view.opponentName!:view.hostName;
 function player(name:string,value:DuelRoundFacts,other=false){
  const status=value.found?'Trouvé':value.closed?'Terminé':value.attempts?'En cours':'Pas commencé';
  const percent=proximityPercent(value.bestRank,view.vocabularySize??DUEL_VOCABULARY_SIZE);
  return <div className={other?'duel-player-progress is-opponent':'duel-player-progress'}><div><strong>{name}</strong><span>{percent} %</span></div><div className="duel-player-track" aria-hidden="true"><i style={{width:percent+'%'}}/></div><p><span>{status}</span><span>{countLabel(value.attempts,'essai')}</span></p></div>;
 }
 return <section className="duel-live-progress" aria-label="Progression des deux joueurs">{player(ownName,facts.own)}{player(otherName,facts.opponent,true)}</section>;
}

export function DuelMatchReview({view,onRound}:{view:DuelView;onRound:(round:number)=>void}){
 if(!view.rounds)return null;
 const ownName=view.role==='host'?view.hostName:view.opponentName,otherName=view.role==='host'?view.opponentName:view.hostName;
 return <ol className="duel-match-review">{DUEL_ROUNDS.map(round=>{
  const facts=view.rounds![round];return <li key={round}><button type="button" onClick={()=>onRound(round)}><span>Manche {round+1}</span><strong>{facts.answer}</strong><span>{duelRoundLabel(view,round)}</span><small>{duelRoundReason(view,round)}</small><span className="duel-review-counts">{ownName} · {countLabel(facts.own.attempts,'essai')}<br/>{otherName} · {countLabel(facts.opponent?.attempts??0,'essai')}</span><span className="duel-review-link">Voir les essais</span></button></li>;
 })}</ol>;
}

function GuessList({name,guesses,vocabularySize}:{name:string;guesses:DuelGuessView[];vocabularySize:number}){
 const ordered=[...guesses].sort((a,b)=>a.rank-b.rank||b.ordinal-a.ordinal);
 return <section className="duel-player-history" aria-label={'Essais de '+name}><h3>{name}</h3><div className="list-labels"><span>Mot</span><span>Proximité</span></div>{ordered.length?ordered.map(guess=><div key={guess.ordinal} className="guess-row" style={{'--row-color':proximityColor(guess.rank)} as CSSProperties}><div className="guess-word"><strong>{guess.word}</strong></div><div className="guess-score"><div className="mini-heat" aria-hidden="true"><i style={{width:proximityFill(guess.rank,vocabularySize)*100+'%'}}/></div><span>{guess.found?'Trouvé':formatRankFr(guess.rank)}</span></div></div>):<p className="duel-empty-history">Aucun essai.</p>}</section>;
}

export function DuelRoundReview({view,round}:{view:DuelView;round:number}){
 const [selected,setSelected]=useState<'own'|'opponent'>('own');const facts=view.rounds?.[round];if(!facts?.revealed)return null;
 const ownName=view.role==='host'?view.hostName:view.opponentName!,otherName=view.role==='host'?view.opponentName!:view.hostName;
 const size=view.vocabularySize??DUEL_VOCABULARY_SIZE;
 return <section className="duel-round-review" aria-label={'Comparer les essais de la manche '+(round+1)}>
  <div className="duel-round-verdict"><strong>{duelRoundLabel(view,round)}</strong><span>{duelRoundReason(view,round)}</span></div>
  <div className="duel-history-tabs" role="group" aria-label="Choisir les essais"><button type="button" aria-pressed={selected==='own'} onClick={()=>setSelected('own')}>{ownName}</button><button type="button" aria-pressed={selected==='opponent'} onClick={()=>setSelected('opponent')}>{otherName}</button></div>
  <div className="duel-comparison" data-selected={selected}><div data-player="own"><GuessList name={ownName} guesses={view.guesses.filter(g=>g.round===round)} vocabularySize={size}/></div><div data-player="opponent"><GuessList name={otherName} guesses={(view.opponentGuesses??[]).filter(g=>g.round===round)} vocabularySize={size}/></div></div>
 </section>;
}
