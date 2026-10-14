"use client";
import { gameSummary } from '@/lib/play-hub';
import type { SavedGame } from '@/lib/game-types';
import { formatRankFr, PROXIMITY_MILESTONES } from '@/lib/proximity-presentation';
import { countLabel } from '@/lib/game-copy';
export function WinSummary({game}:{game:SavedGame}) {
  const summary=gameSummary(game);
  return <section className="win-summary"><h3>Votre chemin</h3><p>{countLabel(summary.trials, "proposition personnelle", "propositions personnelles")} · {countLabel(summary.hints, "indice reçu", "indices reçus")}</p><ol>{PROXIMITY_MILESTONES.filter(point=>point.rank>1).map(point=>({point,guess:game.guesses.find(g=>g.rank<=point.rank)})).filter(item=>item.guess).map(({point,guess})=><li key={point.rank}>Top {point.label} · essai {guess!.order}</li>)}</ol>{summary.bestPistes.length > 0 && <details><summary>Mes meilleures pistes avant la réponse</summary><ul>{summary.bestPistes.map(g=><li key={g.word}>{g.word} · {formatRankFr(g.rank)}</li>)}</ul></details>}<p>Le partage contient uniquement les compteurs et la trajectoire en couleurs, sans réponse ni piste.</p></section>;
}
