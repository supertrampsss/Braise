import type { AdDecision } from "./game-contracts";

// Remains null until account approval, real slots and a certified CMP are verified.
export type AdRuntimeConfig = { provider: 'adsense'; publisherId: string; slots: Partial<Record<AdDecision['placement'], string>>; accountApproved: boolean; cmpReady: boolean };
export const AD_RUNTIME_CONFIG: AdRuntimeConfig | null = null;
export type AdEligibility = { consent: AdDecision['consent']; gameActive: boolean; frequencyAllowed: boolean };
export const AD_DISABLED_ELIGIBILITY: AdEligibility = { consent: 'unknown', gameActive: true, frequencyAllowed: false };

export function decideAd(placement: AdDecision['placement'], config: AdRuntimeConfig | null = AD_RUNTIME_CONFIG, state: AdEligibility = AD_DISABLED_ELIGIBILITY): AdDecision {
  const configured = config?.provider === 'adsense' && /^ca-pub-\d{16}$/.test(config.publisherId) && /^\d{10}$/.test(config.slots[placement] ?? '') && config.accountApproved && config.cmpReady;
  const base = { placement, consent: state.consent, available: !!configured, frequencyAllowed: state.frequencyAllowed };
  if (!configured) return { ...base, result: 'skip', reason: 'not-configured' };
  if (state.consent !== 'granted') return { ...base, result: 'skip', reason: 'consent' };
  if (state.gameActive) return { ...base, result: 'skip', reason: 'game-active' };
  if (!state.frequencyAllowed) return { ...base, result: 'skip', reason: 'frequency' };
  return { ...base, result: 'show', reason: 'eligible' };
}
