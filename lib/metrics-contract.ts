/** Deliberately separate from saves, accounts and the local diagnostic ledger. */
export const METRICS_RETENTION_DAYS = 35;
export const METRICS_LIFETIME_MS = METRICS_RETENTION_DAYS * 86_400_000;
export const METRICS_DAILY_CAP = 500;
export const METRICS_TYPES = ['gameOpened', 'firstGuessAccepted', 'guessAccepted', 'guessRejected', 'networkFailed', 'hintUsed', 'puzzleWon', 'gameResumed', 'helpOpened', 'summaryOpened', 'shareCopied', 'shareNative', 'nextActivityOpened', 'duelCreated', 'duelJoined', 'duelCompleted', 'duelRematchCreated', 'serviceUnavailable', 'requestTimedOut'] as const;
export const METRICS_CONTEXTS = ['daily', 'archive', 'free', 'challenge', 'collection', 'expedition', 'intruder', 'two-braises', 'circle', 'duel', 'studio', 'training', 'offline', 'profile'] as const;
export type MetricType = typeof METRICS_TYPES[number];
export type MetricContext = typeof METRICS_CONTEXTS[number];
export type MetricEvent = { id: string; type: MetricType; context: MetricContext };
export const metricTokenValid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const exactMetricKeys = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export function metricEventValid(value: unknown): value is MetricEvent {
  return exactMetricKeys(value, ['id', 'type', 'context']) && typeof value.id === 'string' && /^[a-f0-9-]{36}$/.test(value.id) && METRICS_TYPES.includes(value.type as MetricType) && METRICS_CONTEXTS.includes(value.context as MetricContext);
}
export type MetricsReport = {
  generatedAt: string; from: string; through: string;
  scope: string; limits: string[];
  browsers: number; events: number;
  daily: { day: string; browsers: number; events: number }[];
  actions: { type: string; context: string; browsers: number; events: number }[];
  cohorts: { day: string; browsers: number; d1Eligible: number; d1Returned: number; d7Eligible: number; d7Returned: number }[];
};
