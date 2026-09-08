import type { AdDecision } from "./game-contracts";

// Commercial activation requires a real provider, consent policy and frequency
// policy. Their absence is configuration, never an eligible empty impression.
type AdRuntimeConfig = { provider: string };
export const AD_RUNTIME_CONFIG: AdRuntimeConfig | null = null;

export function decideAd(placement: AdDecision["placement"]): AdDecision {
  if (AD_RUNTIME_CONFIG !== null) {
    throw new Error("Advertising provider adapter is not implemented");
  }
  return {
    placement,
    consent: "unknown",
    available: false,
    frequencyAllowed: false,
    result: "skip",
    reason: "not-configured",
  };
}
