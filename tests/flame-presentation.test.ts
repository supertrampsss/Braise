import assert from "node:assert/strict";
import test from "node:test";
import { flameLevel } from "../lib/flame-presentation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { statSync } from "node:fs";
import FlameScene from "../components/flame-scene";

test("fillable flame uses the actual gauge fill and only a recognized win fully reveals it", () => {
  assert.equal(flameLevel(0, false), 0);
  assert.ok(flameLevel(1, false) < 1);
  assert.equal(flameLevel(1, true), 1);
  assert.equal(flameLevel(Number.NaN, false), 0);
});

test("accepted best proximity reveals bottom-up without reaching full before a win", () => {
  const levels = [0, .12, .25, .55, .99, 1].map(value => flameLevel(value, false));
  assert.ok(levels.every((value, index) => index === 0 || value >= levels[index - 1]));
  assert.ok(levels.every(value => value < 1));
  assert.equal(flameLevel(-20, false), flameLevel(0, false));
});

test("the visible flame has one priority preload and keeps accessible reserved geometry", () => {
  const html = renderToStaticMarkup(createElement(FlameScene, { level: 0.6, rank: 100, celebrating: false, paused: true }));
  const imagePath = /<image[^>]+href="([^"]+)"/.exec(html)?.[1];
  assert.ok(imagePath?.endsWith('.webp'));
  assert.ok(statSync('public' + imagePath).size < 100_000);
  assert.equal((html.match(/rel="preload"/g) ?? []).length, 1);
  assert.match(html, /as="image"/);
  assert.match(html, /fetchPriority="high"/);
  assert.match(html, /viewBox="0 0 180 240"/);
  assert.match(html, /role="img" aria-label="Proximité :/);
});
