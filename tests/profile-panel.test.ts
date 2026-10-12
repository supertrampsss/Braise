import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfilePanel } from "../components/profile-panel";
import { createLocalProfileExport, loadLocalProfile, recordLocalGameProgress } from "../lib/profile-storage";
import { projectWeeklyRitual } from "../lib/weekly-ritual";
import { ProfileTransfer } from "../components/profile-transfer";
import type { Puzzle, SavedGame } from "../lib/game-types";

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

test("transfer scope describes real exported progression words separately from absent full game saves", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } };
  const initial = loadLocalProfile(storage);
  const puzzle: Puzzle = { id: "free-1", mode: "free", seed: "1", date: "2026-10-12", number: 1, vocabularySize: 30000, resetAt: "2026-10-12T22:00:00.000Z", ref: { contractVersion: 1, id: "free-1", corpusVersion: "fr-fasttext-30000-v1", rulesVersion: "classic-v1", context: "free", variant: "classic", calendar: null } };
  const game: SavedGame = { guesses: [{ word: "maison", order: 1, temperature: 25, rank: 5000, found: false, acceptedAt: "2026-10-12T10:00:00.000Z" }], pins: ["maison"], hints: 0, startedAt: Date.parse("2026-10-12T09:59:00Z"), profileV2StartIndex: 0 };
  const snapshot = recordLocalGameProgress(puzzle, game, storage, initial);
  const exported = createLocalProfileExport(snapshot, new Date("2026-10-12T12:00:00Z"));
  assert.equal(exported.ok, true); if (!exported.ok) return;
  const payload = JSON.parse(exported.text);
  assert.equal(payload.scope, "profile-only");
  assert.equal(payload.activities[0].word, "maison"); assert.equal(payload.activities[0].order, 1);
  assert.equal(payload.activities[0].occurredAt, "2026-10-12T10:00:00.000Z"); assert.equal(payload.activities[0].puzzleRef.id, puzzle.id);
  assert.equal(payload.activities[0].temperature, undefined); assert.equal(payload.activities[0].rank, undefined);
  assert.equal(payload.pins, undefined); assert.equal(payload.games, undefined);
  const markup = renderToStaticMarkup(createElement(ProfileTransfer, { snapshot, onSnapshot: () => {} }));
  assert.match(markup, /Faits de progression et mots associés<\/th><td>Oui/);
  assert.match(markup, /ordre, date et référence de partie/);
  assert.match(markup, /Sauvegardes complètes des parties en cours, scores détaillés et épingles<\/th><td>Non/);
  assert.doesNotMatch(markup, /historique des mots/);
});
