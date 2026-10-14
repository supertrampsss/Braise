"use client";

import { CalendarDays, ChevronRight, Flame, Infinity as InfinityIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LocalPlay } from '@/lib/play-hub';
import { countLabel } from '@/lib/game-copy';
import { formatDateFr } from '@/lib/format-fr';

export function PartiesPanel({ plays, disabled, discovering, archivesOpen, onDaily, onDiscover, onArchives, onResume, children }: {
  plays: LocalPlay[]; disabled: boolean; discovering: boolean; archivesOpen: boolean;
  onDaily: () => void; onDiscover: () => void; onArchives: () => void;
  onResume: (play: LocalPlay) => void;
  children?: ReactNode;
}) {
  const unfinished = plays.filter(play => !play.game.guesses.some(guess => guess.found));
  return <section className="parties-page" aria-labelledby="parties-heading">
    <h1 id="parties-heading">Parties</h1>
    <div className="parties-choices" aria-label="Choisir une partie">
      <button className="parties-choice daily-choice" aria-label="Mot du jour" disabled={disabled} onClick={onDaily}>
        <Flame aria-hidden="true"/><span><strong>Mot du jour</strong><small>Un nouveau mot chaque jour.</small></span><ChevronRight aria-hidden="true"/>
      </button>
      <button className="parties-choice" aria-label="Partie libre" disabled={disabled} aria-busy={discovering} onClick={onDiscover}>
        <InfinityIcon aria-hidden="true"/><span><strong>Partie libre</strong><small>{discovering ? 'Recherche d’un mot…' : 'Un autre mot, sans attendre.'}</small></span><ChevronRight aria-hidden="true"/>
      </button>
      <button className="parties-choice" id="archives-choice" aria-label="Archives" disabled={disabled} aria-expanded={archivesOpen} aria-controls="parties-archives" onClick={onArchives}>
        <CalendarDays aria-hidden="true"/><span><strong>Archives</strong><small>Rejouer les mots des jours précédents.</small></span><ChevronRight aria-hidden="true"/>
      </button>
    </div>
    {children}
    {unfinished.length > 0 && <section className="parties-resume" aria-labelledby="resume-heading">
      <h2 id="resume-heading">À reprendre</h2>
      <ul>{unfinished.map(play => <li key={play.id}>
        <div><h3>{play.mode === 'archive' ? `Archive du ${formatDateFr(play.locator)}` : play.label}</h3><p className="resume-words">{play.game.guesses.slice(-2).map(guess => guess.word).join(' · ')}</p><p className="resume-meta">{countLabel(play.game.guesses.length,'essai')}{play.updatedAt !== undefined && <> · {formatDateFr(new Date(play.updatedAt),true)}</>}</p></div>
        <button disabled={disabled} aria-label={`Reprendre ${play.label}`} onClick={() => onResume(play)}>Reprendre</button>
      </li>)}</ul>
    </section>}
  </section>;
}
