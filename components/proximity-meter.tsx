import type { CSSProperties } from 'react';
import FlameScene from '@/components/flame-scene';
import { formatRankFr, proximityFill, proximityPercent, PROXIMITY_MILESTONES } from '@/lib/proximity-presentation';

/** En-tête du plateau : la proximité à gauche, la flamme à droite à la même hauteur, puis la jauge. */
export function ProximityMeter({ rank, word, vocabularySize, solved, celebrating, paused, revealMotion, pulse = null, pulsePower = .3, record = false }: {
  rank: number | null; vocabularySize: number | undefined; solved: boolean;
  word?: string | null;
  celebrating: boolean; paused: boolean; revealMotion: boolean;
  pulse?: string | number | null; pulsePower?: number; record?: boolean;
}) {
  const fill = proximityFill(rank, vocabularySize);
  return <div className="proximity-meter" data-paused={paused} style={{ '--proximity-position': `${fill * 100}%` } as CSSProperties}>
    <p className="proximity-label">Votre meilleure piste</p>
    <div className="proximity-head">
      <div className="proximity-best">
        <span className="proximity-percentage" aria-label={`Meilleure progression : ${proximityPercent(rank,vocabularySize)} pour cent`}>{proximityPercent(rank,vocabularySize)} %</span>
        <p className="proximity-best-word">{rank === null ? 'Aucun essai pour le moment' : <><strong>{word}</strong><span>{formatRankFr(rank)}</span></>}</p>
      </div>
      <div className="proximity-flame-slot">
        <FlameScene level={fill} rank={rank} celebrating={celebrating} paused={paused} solved={solved} revealMotion={revealMotion} pulse={pulse} pulsePower={pulsePower} record={record}/>
      </div>
    </div>
    <div className="proximity-track" aria-hidden="true"><i style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}/></div>
    <div className="proximity-milestones" aria-label="Repères de proximité">
      {PROXIMITY_MILESTONES.map(point => <span key={point.rank} style={{ left: `${point.position * 100}%` }}>
        {point.rank > 1 && <span className="milestone-prefix">Top </span>}{point.label}
      </span>)}
    </div>
    <p className="proximity-guidance">Plus le rang est petit, plus le mot est proche. La jauge garde votre meilleur résultat.</p>
  </div>;
}
