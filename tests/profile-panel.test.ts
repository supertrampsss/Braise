import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfilePanel } from "../components/profile-panel";
import { loadLocalProfile } from "../lib/profile-storage";
import { projectWeeklyRitual } from "../lib/weekly-ritual";

test("profile exposes short progression, objectives and reward names, with separate preferences and exact data scope", () => {
  const map = new Map<string, string>();
  const snapshot = loadLocalProfile({ getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); }, key: index => [...map.keys()][index] ?? null, get length() { return map.size; } });
  const markup = renderToStaticMarkup(createElement(ProfilePanel, { snapshot, now: "2026-10-12T12:00:00.000Z", ritual: projectWeeklyRitual([], [], new Date("2026-10-12T12:00:00Z")), busy: false, flamePaused: false, onSound: () => {}, onAnimations: () => {}, onCosmetic: () => {}, onSnapshot: () => {}, onBack: () => {} }));
  for (const text of ["Votre progression", "Cette semaine", "Attiser", "Cuivre ardent", "Préférences", "Vos données", "Diagnostic local", "Non disponible", "Archives", "Revenir au jeu", "Ce qui sera transféré", "parties en cours", "médians"]) assert.ok(markup.includes(text), text);
  assert.match(markup, /<table/); assert.match(markup, /<caption/);
  assert.doesNotMatch(markup, /Activer un rappel|Télécharger le rappel/);
  assert.match(markup, /sur 0 réussites renseignées/);
  assert.match(markup, /Atteindre une série de 3 quotidiens de suite/);
  assert.doesNotMatch(markup, /Série actuelle : 3/);
});
