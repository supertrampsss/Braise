import { formatNumberFr } from "./format-fr";

export const proximityProgress = (rank: number): number | null => rank <= 1000 ? 1001 - rank : null;

/** Counters never turn missing historical facts into zero. */
export function countLabel(value: number | null | undefined, singular: string, plural = `${singular}s`): string {
  return `${formatNumberFr(value)} ${value === 1 ? singular : plural}`;
}
