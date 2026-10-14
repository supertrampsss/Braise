import { formatNumberFr } from './format-fr';

export const PROXIMITY_MILESTONES = [
  { rank: 5000, position: .2, label: '5 000' },
  { rank: 1000, position: .4, label: '1 000' },
  { rank: 100, position: .6, label: '100' },
  { rank: 10, position: .8, label: '10' },
  { rank: 1, position: 1, label: 'Trouvé' },
] as const;

/** Visual spacing only. API ranks stay exact; no score or percentage is displayed. */
export function proximityFill(rank: number | null | undefined, vocabularySize: number | undefined): number {
  if (rank == null) return 0;
  if (!Number.isSafeInteger(rank) || rank < 1 || !Number.isSafeInteger(vocabularySize) || vocabularySize! < rank) {
    throw new RangeError('Invalid proximity rank or vocabulary size');
  }
  if (rank === 1) return 1;
  const points = [{ rank: vocabularySize!, position: 0 }, ...PROXIMITY_MILESTONES.filter(point => point.rank < vocabularySize!)];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i];
    if (rank >= to.rank) {
      const part = (Math.log(from.rank) - Math.log(rank)) / (Math.log(from.rank) - Math.log(to.rank));
      return from.position + (to.position - from.position) * part;
    }
  }
  throw new RangeError('Proximity rank is outside the display intervals');
}

export function proximityColor(rank: number): string {
  return rank <= 100 ? '#ff946a' : rank <= 1000 ? '#f1bd55' : rank <= 5000 ? '#83b493' : '#b3b8c1';
}

export function formatRankFr(rank: number): string {
  return `${formatNumberFr(rank)}${rank === 1 ? 'er' : 'e'}`;
}
