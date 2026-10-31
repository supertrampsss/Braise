import assert from "node:assert/strict";
import test from "node:test";
import { flameLevel } from "../lib/flame-presentation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

test("the flame is drawn on a canvas, without image to load, and keeps its accessible label", () => {
  const html = renderToStaticMarkup(createElement(FlameScene, { level: 0.6, rank: 100, celebrating: false, paused: true }));
  assert.match(html, /<canvas class="drawn-flame" aria-hidden="true">/);
  assert.match(html, /data-renderer="drawn"/);
  assert.doesNotMatch(html, /<image|rel="preload"/);
  assert.match(html, /role="img" aria-label="Proximité :/);
});
