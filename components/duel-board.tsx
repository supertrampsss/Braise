"use client";
import type {CSSProperties,FormEvent} from 'react';
import {Check} from 'lucide-react';
import {ProximityMeter} from './proximity-meter';
import FlameScene from './flame-scene';
import {AcceptedGuessFlight} from './accepted-guess-flight';
import {duelRound,DUEL_ROUNDS,DUEL_ATTEMPTS,DUEL_VOCABULARY_SIZE,type DuelView} from '@/lib/duel-presentation';
import {formatRankFr,proximityFill,proximityColor} from '@/lib/proximity-presentation';
import {countLabel} from '@/lib/game-copy';
import {DuelProgress,DuelRoundReview} from './duel-review';
import {duelRoundLabel} from '@/lib/duel-presentation';

export function DuelBoard({view,round,now,busy,word,paused,feedback,onWord,onRound,onSubmit,spellingSuggestion,onSpellingSuggestion}:{
  view:DuelView; round:number; now:number; busy:boolean; word:string; paused:boolean;
  feedback:{round:number;ordinal:number;improved:boolean;found:boolean;announcement:string}|null;
  onWord:(word:string)=>void; onRound:(round:number)=>void; onSubmit:(event:FormEvent)=>void;
  spellingSuggestion?:string|null;onSpellingSuggestion?:()=>void;
}) {
  const current=duelRound(view,round,now);
  const revealed=view.rounds?.[round]?.revealed===true,answer=view.rounds?.[round]?.answer;
  const vocabularySize=view.vocabularySize??DUEL_VOCABULARY_SIZE;
  const live=feedback?.round===round ? feedback : null;
  const accepted=current.guesses.find(guess=>guess.ordinal===live?.ordinal);
  const next=DUEL_ROUNDS.find(index=>index>round&&!duelRound(view,index,now).closed) ?? DUEL_ROUNDS.find(index=>index!==round&&!duelRound(view,index,now).closed);
  return <div className="play-view duel-play" id="duel-round-board" tabIndex={-1}>
    <div className="duel-rounds" role="group" aria-label="Choisir la manche">
      {DUEL_ROUNDS.map(index=>{const facts=duelRound(view,index,now);return <button key={index} disabled={busy} aria-pressed={round===index} onClick={()=>onRound(index)}>
        <span>Manche {index+1}</span>{view.rounds?.[index]?.revealed?<small>{duelRoundLabel(view,index)}</small>:facts.won ? <Check aria-label="Trouvée" size={16}/> : index!==round&&facts.guesses.length>0 ? <small>{countLabel(facts.guesses.length,'essai')}</small> : null}
      </button>;})}
    </div>
    <DuelProgress view={view} round={round}/>
    <section className={`game-panel ${current.won?'is-won':''} ${live?.improved?'is-record':''}`} aria-label={`Plateau de la manche ${round+1}`}>
      <AcceptedGuessFlight key={view.id+':'+round} inputId="duel-word" paused={paused} receipt={live&&accepted?{id:view.id+':'+round+':'+live.ordinal,word:accepted.word,rank:accepted.rank,found:live.found}:null}/>
      <div className="game-topline"><span className="sr-only">Manche {round+1}</span><span className="game-trials">{current.guesses.length}/{DUEL_ATTEMPTS} essais</span></div>
      <p className="sr-only" role="status" aria-live="polite">{live?.announcement??''}</p>
      {!current.won&&<ProximityMeter rank={current.best?.rank??null} vocabularySize={vocabularySize} solved={false} celebrating={false} paused={paused} revealMotion={Boolean(live?.improved)} bestWord={current.best?.word ?? null}/>}
      <div className="approved-play-surface">
        {!current.closed ? <div className="guess-area"><form className="guess-form" aria-busy={busy} onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="duel-word">Mot</label><input id="duel-word" value={word} onChange={event=>onWord(event.target.value)} placeholder="Mot" maxLength={50} lang="fr" autoComplete="off" autoCapitalize="none" enterKeyHint="send" aria-describedby="duel-error"/>
          <button className="guess-button" disabled={busy||!word.trim()} aria-label={busy?'Analyse en cours':'Envoyer'}>{busy?'Analyse…':'Envoyer'}</button>
        </form>{spellingSuggestion&&<button type="button" className="text-action spelling-suggestion" disabled={busy} onClick={onSpellingSuggestion}>Utiliser « {spellingSuggestion} »</button>}</div> : <div className={`duel-round-end ${current.won?'victory-box':''}`}>
          {current.won&&<><FlameScene level={1} rank={1} solved celebrating={Boolean(live?.found)} paused={paused} revealMotion={Boolean(live?.found)}/><span className="victory-eyebrow">Trouvé</span></>}
          {!current.won&&answer&&<span className="victory-eyebrow">Solution</span>}
          <h2 data-flight-word={current.won?current.best?.word:undefined}>{current.won?current.best?.word:answer??(current.expired?'Délai écoulé':'Manche terminée')}</h2>
          {current.won&&<p>{countLabel(current.guesses.length,'essai')}</p>}
          {next!==undefined ? <button className="primary-button" disabled={busy} onClick={()=>onRound(next)}>Manche suivante</button> : view.state==='active' ? <p>En attente de {view.role==='host'?view.opponentName:view.hostName}.</p> : null}
        </div>}
      </div>
    </section>
    {revealed?<DuelRoundReview key={view.id+':'+round} view={view} round={round}/>:current.ordered.length>0&&<section className="history-panel" aria-label={`Essais de la manche ${round+1}`}>
      <div className="guess-list"><div className="list-labels"><span>Mot</span><span>Proximité</span></div>
        {current.ordered.map(guess=><div key={guess.ordinal} data-flight-word={guess.word} className={`guess-row ${live?.ordinal===guess.ordinal?'is-new-guess':''}`} style={{'--row-color':proximityColor(guess.rank)} as CSSProperties}>
          <div className="guess-word"><strong>{guess.word}</strong>{guess.found===1&&<Check size={15}/>}</div>
          <div className="guess-score"><div className="mini-heat" aria-hidden="true"><i style={{width:`${proximityFill(guess.rank,vocabularySize)*100}%`}}/></div><span>{guess.found===1?'Trouvé':formatRankFr(guess.rank)}</span></div>
        </div>)}
      </div>
    </section>}
  </div>;
}
