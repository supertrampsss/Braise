import type { CSSProperties } from 'react';
import FlameScene from '@/components/flame-scene';
import { proximityFill, proximityPercent, PROXIMITY_MILESTONES } from '@/lib/proximity-presentation';

export function ProximityMeter({ rank, vocabularySize, solved, celebrating, paused, revealMotion }: {
  rank: number | null; vocabularySize: number | undefined; solved: boolean;
  celebrating: boolean; paused: boolean; revealMotion: boolean;
}) {
  const fill = proximityFill(rank, vocabularySize);
  return <div className="proximity-meter" data-paused={paused} style={{ '--proximity-position': `${fill * 100}%` } as CSSProperties}>
    <div className="proximity-flame-slot">
      <FlameScene level={fill} rank={rank} celebrating={celebrating} paused={paused} solved={solved} revealMotion={revealMotion}/>
    </div>
    <span className="proximity-percentage" aria-label={`Progression : ${proximityPercent(rank,vocabularySize)} pour cent`}>{proximityPercent(rank,vocabularySize)} %</span>
    <div className="proximity-track" aria-hidden="true"><i style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}/></div>
    <div className="proximity-milestones" aria-label="Repères de proximité">
      {PROXIMITY_MILESTONES.map(point => <span key={point.rank} style={{ left: `${point.position * 100}%` }}>
        {point.rank > 1 && <span className="milestone-prefix">Top </span>}{point.label}
      </span>)}
    </div>
  </div>;
}
