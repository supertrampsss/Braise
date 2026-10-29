import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AD_RUNTIME_CONFIG, decideAd, type AdEligibility, type AdRuntimeConfig } from '../lib/advertising';
import { mountAdSense } from '../lib/adsense-adapter';

// Synthetic values are used only in this fake DOM test, never published or requested.
const config: AdRuntimeConfig = { provider: 'adsense', publisherId: 'ca-pub-1111111111111111', slots: { 'duel-summary': '1111111111' }, accountApproved: true, cmpReady: true };
const allowed: AdEligibility = { consent: 'granted', gameActive: false, frequencyAllowed: true };
function dom() {
  class Element extends EventTarget {
    tag: string; style: Record<string, string> = {}; attributes: Record<string, string> = {}; children: Element[] = []; parent: Element | null = null;
    ownerDocument = doc as unknown as Document;
    constructor(tag: string) { super(); this.tag = tag; }
    appendChild(child: Element) { child.parent = this; this.children.push(child); return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
  }
  const doc = { defaultView: { adsbygoogle: [] as object[] }, head: null as unknown as Element, createElement: (tag: string) => new Element(tag) };
  doc.head = new Element('head'); const host = new Element('div');
  return { doc, host: host as unknown as HTMLElement, hostElement: host };
}
test('advertising stays off by default and every independent eligibility gate is required', () => {
  assert.equal(AD_RUNTIME_CONFIG, null);
  assert.equal(decideAd('duel-summary').reason, 'not-configured');
  for (const invalid of [{ ...config, accountApproved: false }, { ...config, cmpReady: false }, { ...config, slots: {} }, { ...config, publisherId: 'made-up' }]) assert.equal(decideAd('duel-summary', invalid, allowed).result, 'skip');
  assert.equal(decideAd('duel-summary', config, { ...allowed, consent: 'unknown' }).reason, 'consent');
  assert.equal(decideAd('duel-summary', config, { ...allowed, consent: 'denied' }).reason, 'consent');
  assert.equal(decideAd('duel-summary', config, { ...allowed, gameActive: true }).reason, 'game-active');
  assert.equal(decideAd('duel-summary', config, { ...allowed, frequencyAllowed: false }).reason, 'frequency');
});
test('no third-party script or ad node is created without an eligible configuration', async () => {
  const { doc, host, hostElement } = dom();
  assert.equal((await mountAdSense({ host, config: null, placement: 'duel-summary', eligibility: () => allowed })).requested, false);
  assert.equal((await mountAdSense({ host, config, placement: 'duel-summary', eligibility: () => ({ ...allowed, consent: 'denied' }) })).requested, false);
  assert.equal(doc.head.children.length, 0); assert.equal(hostElement.children.length, 0);
});
test('real asynchronous unit attributes are set, requested once, then removable', async () => {
  const { doc, host, hostElement } = dom();
  const pending = mountAdSense({ host, config, placement: 'duel-summary', eligibility: () => allowed });
  assert.equal(doc.head.children.length, 1); doc.head.children[0].dispatchEvent(new Event('load'));
  const result = await pending; assert.equal(result.requested, true); assert.equal(doc.defaultView.adsbygoogle.length, 1);
  assert.deepEqual(hostElement.children[0].attributes, { 'data-ad-client': config.publisherId, 'data-ad-slot': '1111111111', 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' });
  assert.equal((await mountAdSense({ host, config, placement: 'duel-summary', eligibility: () => allowed })).requested, false);
  result.dispose(); assert.equal(hostElement.children.length, 0);
});
test('consent withdrawal during SDK loading prevents the ad request', async () => {
  const { doc, host, hostElement } = dom(); let eligibility = allowed;
  const pending = mountAdSense({ host, config, placement: 'duel-summary', eligibility: () => eligibility });
  eligibility = { ...allowed, consent: 'denied' }; doc.head.children[0].dispatchEvent(new Event('load'));
  assert.equal((await pending).requested, false); assert.equal(doc.defaultView.adsbygoogle.length, 0); assert.equal(hostElement.children.length, 0);
});
test('blocked SDK and unmounted placement never produce an impression request', async () => {
  for (const abort of [false, true]) {
    const { doc, host, hostElement } = dom(), controller = new AbortController();
    const pending = mountAdSense({ host, config, placement: 'duel-summary', eligibility: () => allowed, signal: controller.signal });
    if (abort) controller.abort();
    doc.head.children[0].dispatchEvent(new Event(abort ? 'load' : 'error'));
    assert.equal((await pending).requested, false); assert.equal(doc.defaultView.adsbygoogle.length, 0); assert.equal(hostElement.children.length, 0);
  }
});
