"use client";
import type { LocalPlay } from '@/lib/play-hub';
import { resumeSuggestion, gameSummary } from '@/lib/play-hub';
import type { SavedGame } from '@/lib/game-types';
import { formatDateFr, formatScoreFr } from '@/lib/format-fr';
import { countLabel } from '@/lib/game-copy';
import { EXTRA_MODES_ENABLED } from '@/lib/release';
export function ResumeHub({plays,currentId,onResume,onDiscover}:{plays:LocalPlay[];currentId?:string;onResume:(play:LocalPlay)=>void;onDiscover:()=>void}) {
  const unfinished=plays.filter(p=>!p.game.guesses.some(g=>g.found) && (EXTRA_MODES_ENABLED || !p.context?.expedition && !p.context?.collection));
  const next=resumeSuggestion(unfinished,currentId);
  return <section className="play-hub"><h2>Reprendre ma partie</h2><p>Sur cet appareil · essais et épingles conservés. Les anciennes parties sans contexte restent indiquées comme parties libres.</p>{next && <div className="next-activity"><strong>Suggestion : {next.label}</strong><p>Cette partie comporte {countLabel(next.game.guesses.length, "essai")} et attend votre prochain mot.</p><button className="primary-button" onClick={()=>onResume(next)}>Reprendre cette piste</button></div>}{!next && <div className="next-activity"><p>{plays.some(p=>p.game.guesses.some(g=>g.found))?'Vous avez déjà trouvé un mot : découvrez une autre cible.':'Commencez à votre rythme, sans limite de temps.'}</p><button className="primary-button" onClick={onDiscover}>Découvrir un mot en libre</button></div>}<ul>{unfinished.map(play=><li key={play.id}><strong>{play.label}</strong><span>{countLabel(play.game.guesses.length, "essai")} · {countLabel(play.game.pins.length, "épingle")} · {play.updatedAt ? formatDateFr(new Date(play.updatedAt),true) : 'Date inconnue'}</span><button className="secondary-button" onClick={()=>onResume(play)}>Reprendre</button></li>)}</ul>{!unfinished.length && <p>Aucune partie commencée à reprendre.</p>}{EXTRA_MODES_ENABLED && <p><a href="/espace">Mes parties en ligne</a> · accès et sauvegarde partagée distincts de cet appareil.</p>}</section>;
}
export function WinSummary({game}:{game:SavedGame}) {
  const summary=gameSummary(game);
  return <section className="win-summary"><h3>Votre chemin</h3><p>{countLabel(summary.trials, "proposition personnelle", "propositions personnelles")} · {countLabel(summary.hints, "indice reçu", "indices reçus")}</p><ol>{summary.milestones.map(item=><li key={item.temperature}>Seuil de {item.temperature}° atteint à l’essai {item.guess!.order}{item.guess!.hint ? ' (indice)' : ''}.</li>)}</ol>{summary.bestPistes.length > 0 && <details><summary>Mes meilleures pistes avant la réponse</summary><ul>{summary.bestPistes.map(g=><li key={g.word}>{g.word} · {formatScoreFr(g.temperature)}°</li>)}</ul></details>}<p>Le partage contient uniquement les compteurs et la trajectoire en couleurs, sans réponse ni piste.</p></section>;
}
