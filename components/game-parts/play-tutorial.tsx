"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Puzzle, Guess } from '@/lib/game-types';
import { samePuzzleRef, type EvaluationResponse } from '@/lib/game-contracts';
import { formatScoreFr } from '@/lib/format-fr';
import { recordProductEvent } from '@/lib/product-events';
export function PlayTutorial({ onClose }: { onClose: () => void }) {
  const [puzzle,setPuzzle] = useState<Puzzle | null>(null), [guesses,setGuesses] = useState<Guess[]>([]), [input,setInput] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const alive = useRef(true), revision = useRef(0), submitting = useRef(false);
  useEffect(() => { alive.current = true; const controller = new AbortController(); fetch('/api/game?tutorial=1', { signal: controller.signal, cache: 'no-store' }).then(async response => { const data = await response.json() as Puzzle & {error?:string}; if (!response.ok) throw new Error(data.error); if (alive.current) setPuzzle(data); }).catch(() => { if (alive.current) setError('Exemple indisponible. Fermez puis relancez le tutoriel pour réessayer.'); }); return () => { alive.current = false; controller.abort(); }; }, []);
  function diagnostic(type: 'guessRejected' | 'guessAccepted' | 'networkFailed') {try{recordProductEvent(localStorage,type,'training');}catch{}}
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!puzzle || submitting.current || !input.trim()) return;
    const submittedRevision = revision.current; submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/game', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ mode:'free',seed:puzzle.seed,puzzleId:puzzle.id,puzzleRef:puzzle.ref,action:'guess',word:input }) });
      const data = await response.json() as EvaluationResponse & {error?:string}; if (!alive.current) return;
      if (!response.ok) { if(response.status === 422) diagnostic('guessRejected'); else if(response.status >= 500) diagnostic('networkFailed'); throw new Error(data.error || 'Réponse indisponible.'); }
      if (!samePuzzleRef(data.puzzleRef,puzzle.ref)) throw new Error('Réponse d’une autre partie refusée.');
      if (guesses.some(g => g.word === data.word)) { setError('Choisissez une autre association pour comparer.'); return; }
      setGuesses(previous => [...previous,{...data,order:previous.length+1}]); if(revision.current === submittedRevision) setInput('');
      diagnostic('guessAccepted');
    } catch(cause) { if(alive.current && cause instanceof TypeError) diagnostic('networkFailed'); if(alive.current) setError(cause instanceof Error ? cause.message : 'Connexion impossible. Votre saisie est conservée.'); }
    finally { submitting.current=false; if(alive.current) setBusy(false); }
  }
  return <section className="play-tutorial"><p>Exemple V1 réel · exercice séparé, sans sauvegarde, victoire ni récompense. Quittez à tout moment.</p><ol><li><strong>1. Proposer</strong> : essayez un mot comme « maison ».</li><li><strong>2. Lire</strong> : plus la température est élevée, plus le sens est proche ; un rang plus petit est meilleur.</li><li><strong>3. Changer d’association</strong> : proposez un autre mot et comparez les deux réponses.</li></ol><p role="status">{guesses.length === 0 ? 'Étape 1 sur 3 : à vous de proposer.' : guesses.length === 1 ? 'Étape 2 sur 3 : lisez ce résultat, puis essayez une autre association.' : 'Étape 3 sur 3 : comparaison terminée. Vous pouvez rejoindre votre partie.'}</p>{guesses.map(g => <p key={g.word}><b>{g.word}</b> · {formatScoreFr(g.temperature)}° · rang {g.rank.toLocaleString('fr-FR')} / {puzzle?.vocabularySize.toLocaleString('fr-FR')}{g.found ? ' · Trouvé dans cet exemple' : ''}</p>)}{guesses.length >= 2 && <p>Le second mot est {guesses[1].temperature > guesses[0].temperature ? 'plus proche' : guesses[1].temperature < guesses[0].temperature ? 'moins proche' : 'aussi proche'} que le premier. La température n’est pas une probabilité de victoire.</p>}{guesses.length < 2 && <form onSubmit={submit}><label htmlFor="tutorial-word">Mot de l’exercice</label><input id="tutorial-word" value={input} maxLength={50} onChange={event => { revision.current++;setInput(event.target.value); }} aria-describedby="tutorial-error"/><button type="submit" className="primary-button" disabled={!puzzle || busy || !input.trim()}>{busy ? 'Analyse…' : 'Envoyer'}</button></form>}<p role="alert" id="tutorial-error">{error}</p><button className="secondary-button" onClick={onClose}>{guesses.length >= 2 ? 'Revenir à ma partie' : 'Quitter le tutoriel'}</button></section>;
}
