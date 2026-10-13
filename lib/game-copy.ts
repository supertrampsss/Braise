import { formatNumberFr } from "./format-fr";

/** Counters never turn missing historical facts into zero. */
export function countLabel(value: number | null | undefined, singular: string, plural = `${singular}s`): string {
  return `${formatNumberFr(value)} ${value === 1 ? singular : plural}`;
}
