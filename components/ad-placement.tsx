'use client';
import { useEffect, useRef, useState } from 'react';
import { AD_DISABLED_ELIGIBILITY, AD_RUNTIME_CONFIG, decideAd, type AdEligibility, type AdRuntimeConfig } from '@/lib/advertising';
import { mountAdSense } from '@/lib/adsense-adapter';
import type { AdDecision } from '@/lib/game-contracts';

/** A future CMP integration must explicitly supply live consent and game state. Existing callers stay off. */
export default function AdPlacement({ placement = 'game-display', config = AD_RUNTIME_CONFIG, eligibility = AD_DISABLED_ELIGIBILITY }: { placement?: AdDecision['placement']; config?: AdRuntimeConfig | null; eligibility?: AdEligibility } = {}) {
  const host = useRef<HTMLDivElement>(null), current = useRef(eligibility), [available, setAvailable] = useState(false);
  current.current = eligibility;
  const show = decideAd(placement, config, eligibility).result === 'show';
  useEffect(() => {
    setAvailable(false); if (!show || !host.current) return;
    const controller = new AbortController(); let dispose = () => {};
    void mountAdSense({ host: host.current, config, placement, eligibility: () => current.current, signal: controller.signal }).then(result => { dispose = result.dispose; if (controller.signal.aborted) dispose(); else setAvailable(result.requested); });
    return () => { controller.abort(); dispose(); };
  }, [show, config, placement]);
  if (!show) return null;
  return <section className={available ? 'ad-zone' : undefined} aria-label="Publicité"><span className="ad-label" hidden={!available}>Publicité</span><div ref={host} /></section>;
}
