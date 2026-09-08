import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdPlacement from "../components/ad-placement";
import { AD_RUNTIME_CONFIG, decideAd } from "../lib/advertising";

test("every advertising placement stays explicitly inactive without configuration", () => {
  assert.equal(AD_RUNTIME_CONFIG, null);
  for (const placement of ["game-display", "expedition-break", "duel-summary"] as const) {
    assert.deepEqual(decideAd(placement), {
      placement,
      consent: "unknown",
      available: false,
      frequencyAllowed: false,
      result: "skip",
      reason: "not-configured",
    });
  }
});

test("the reserved placement is static, honest and non-interactive", () => {
  const html = renderToStaticMarkup(createElement(AdPlacement));
  assert.match(html, /Emplacement publicitaire réservé/i);
  assert.match(html, /Aucune publicité activée/);
  assert.match(html, /data-ad-result="skip"/);
  assert.doesNotMatch(html, /<(script|iframe|img|a|button)\b/i);
  assert.doesNotMatch(html, /(doubleclick|googlesyndication|analytics|pixel)/i);
});
