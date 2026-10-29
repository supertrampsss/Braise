import { decideAd, type AdEligibility, type AdRuntimeConfig } from './advertising';
import type { AdDecision } from './game-contracts';

const loaders = new WeakMap<Document, { publisher: string; promise: Promise<void> }>();
const requested = new WeakSet<Document>();
type AdWindow = Window & { adsbygoogle?: { push(value: Record<string, never>): unknown } };
function load(doc: Document, publisher: string) {
  const existing = loaders.get(doc);
  if (existing) return existing.publisher === publisher ? existing.promise : Promise.reject(new Error('adsense-publisher-conflict'));
  const promise = new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script'); script.async = true; script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
    const timer = setTimeout(() => failed(), 10_000);
    const loaded = () => { clearTimeout(timer); script.removeEventListener('error', failed); resolve(); };
    const failed = () => { clearTimeout(timer); script.removeEventListener('load', loaded); script.remove(); loaders.delete(doc); reject(new Error('adsense-unavailable')); };
    script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true }); doc.head.appendChild(script);
  });
  loaders.set(doc, { publisher, promise }); return promise;
}
/** No script or DOM ad is created until all independent eligibility gates pass. One request per document, no automatic refresh. */
export async function mountAdSense(options: { host: HTMLElement; config: AdRuntimeConfig | null; placement: AdDecision['placement']; eligibility: () => AdEligibility; signal?: AbortSignal }): Promise<{ requested: boolean; dispose: () => void }> {
  const { host, config, placement, eligibility, signal } = options, doc = host.ownerDocument;
  if (!config || signal?.aborted || !doc.defaultView || requested.has(doc) || decideAd(placement, config, eligibility()).result !== 'show') return { requested: false, dispose() {} };
  const unit = doc.createElement('ins'); unit.className = 'adsbygoogle'; unit.style.display = 'block';
  unit.setAttribute('data-ad-client', config.publisherId); unit.setAttribute('data-ad-slot', config.slots[placement]!);
  unit.setAttribute('data-ad-format', 'auto'); unit.setAttribute('data-full-width-responsive', 'true');
  const dispose = () => { unit.remove(); signal?.removeEventListener('abort', dispose); };
  signal?.addEventListener('abort', dispose, { once: true });
  try {
    await load(doc, config.publisherId);
    // CMP revocation, an unmount or a new round while the SDK loads must stop the ad request.
    if (signal?.aborted || requested.has(doc) || decideAd(placement, config, eligibility()).result !== 'show') { dispose(); return { requested: false, dispose }; }
    host.appendChild(unit);
    const win = doc.defaultView as AdWindow;
    const queue = win.adsbygoogle ?? ([] as Record<string, never>[]);
    win.adsbygoogle = queue; queue.push({}); requested.add(doc);
    return { requested: true, dispose };
  } catch { dispose(); return { requested: false, dispose }; }
}
