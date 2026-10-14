"use client";

import type { ReactNode } from 'react';
import type { LocalPlay } from '@/lib/play-hub';
import { countLabel } from '@/lib/game-copy';
import { formatDateFr } from '@/lib/format-fr';

export function PartiesPanel({ plays, disabled, onResume, children }: {
  plays: LocalPlay[]; disabled: boolean;
  onResume: (play: LocalPlay) => void;
  children?: ReactNode;
}) {
  const unfinished = plays.filter(play => !play.game.guesses.some(guess => guess.found));
  return <section className="parties-page" aria-labelledby="parties-heading">
    <h1 id="parties-heading">Archives</h1>
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
