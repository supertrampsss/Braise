"use client";
import { useEffect, useRef, useState } from "react";
import { readTwoBraises, saveTwoBraises } from "@/lib/profile-storage";
import type { TwoBraisesGuess } from "@/lib/two-braises";
import { AppNavigation } from "./app-navigation";
import { formatNumberFr, formatScoreFr } from "@/lib/format-fr";
import { warmth } from "@/lib/game-types";

export default function TwoBraisesGame() {
  const [pair, setPair] = useState(0);
  const [guesses, setGuesses] = useState<TwoBraisesGuess[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [warning, setWarning] = useState(false);
  const alive = useRef(true); const field = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const revision = useRef(0); const currentPair = useRef(0);
  const memory = useRef(new Map<number, TwoBraisesGuess[]>());
  // Browser-only silent restoration after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { alive.current = true; setGuesses(readTwoBraises(0)); setReady(true); return () => { alive.current = false; }; }, []);
  const found = [0, 1].map(index => guesses.some(guess => guess.values[index].found));
  function changePair(next: number) {
    if (submitting.current) return;
    currentPair.current = next; memory.current.set(pair, guesses); setPair(next);
    setGuesses(memory.current.get(next) ?? readTwoBraises(next)); setInput(""); setError(""); setAnnouncement(""); revision.current++;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pair !== currentPair.current || !ready || submitting.current || found.every(Boolean) || !input.trim()) return;
    submitting.current = true; setBusy(true); setError(""); const version = revision.current;
    try {
      const response = await fetch("/api/two-braises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edition: "deux-braises-v1", pair, word: input.trim() }) });
      const data = await response.json() as Omit<TwoBraisesGuess, "acceptedAt"> & { error?: string };
      if (!alive.current || pair !== currentPair.current) return;
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (guesses.some(guess => guess.word === data.word)) { setError("Ce mot figure déjà dans vos essais."); return; }
      const guess: TwoBraisesGuess = { edition: "deux-braises-v1", pair, word: data.word, values: data.values, acceptedAt: new Date().toISOString() };
      setAnnouncement(`Essai enregistré. Cible A : ${formatScoreFr(guess.values[0].temperature)} degrés. Cible B : ${formatScoreFr(guess.values[1].temperature)} degrés.`);
      const saved = saveTwoBraises(guess); setWarning(!saved);
      setGuesses(current => {
        const merged = new Map([...readTwoBraises(pair), ...current, guess].map(item => [item.word, item]));
        return [...merged.values()];
      });
      if (version === revision.current) setInput("");
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { submitting.current = false; if (alive.current) { setBusy(false); field.current?.focus(); } }
  }
  return <main className="main-shell laboratory-shell">
    <AppNavigation active="explore" modeName="Deux braises" />
    <div className="page-heading"><div><div className="eyebrow">LE LABORATOIRE</div><h1>Deux braises<span>.</span></h1><p>Un essai. Deux températures. Deux mots à découvrir.</p></div></div>
    <a className="text-action" href="/laboratoire">Jouer à L’intrus</a>
    <section className="collection-picker laboratory-card" aria-label="Deux braises">
      <p>Les deux colonnes utilisent les vrais scores du jeu classique. Trouvez les deux mots pour terminer. Une cible trouvée reste acquise. Pas d’indice dans cette variante.</p>
      <label htmlFor="pair-select">Paire </label><select id="pair-select" value={pair} disabled={busy || !ready} onChange={event => changePair(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Paire {index + 1} / 12</option>)}</select>
      <div className="two-braises-targets">{[0, 1].map(index => {
        const best = guesses.map(guess => guess.values[index]).reduce<(typeof guesses)[number]["values"][number] | null>((current, value) => !current || value.rank < current.rank ? value : current, null);
        return <section className="two-braises-target" key={index} aria-label={`Cible ${index === 0 ? "A" : "B"}`}><h2>Cible {index === 0 ? "A" : "B"} : {found[index] ? "trouvée ✓" : "à découvrir"}</h2>{best ? <p>Meilleure piste : <strong>{formatScoreFr(best.temperature)}°</strong><br />Rang {formatNumberFr(best.rank)}</p> : <p>Aucun essai enregistré.</p>}</section>;
      })}</div><p role="status">{announcement}</p>
      {found.every(Boolean) ? <h2>Les deux mots sont trouvés ! {guesses.length} essais.</h2> : <form className="guess-form" onSubmit={submit}><label className="sr-only" htmlFor="two-guess">Votre proposition</label><input id="two-guess" ref={field} value={input} onChange={event => { revision.current++; setInput(event.target.value); }} maxLength={50} autoComplete="off" autoCapitalize="none" placeholder="Un mot français…" disabled={!ready} /><button type="submit" className="guess-button" disabled={busy || !ready || !input.trim()} aria-label="Envoyer ce mot">{busy ? "Envoi…" : "Envoyer"}</button></form>}
      {error && <p role="alert">{error}</p>}{warning && <p role="status">Sauvegarde indisponible : vos essais restent en mémoire dans cette page.</p>}
      <div className="two-braises-history"><table><caption>{guesses.length} essais distincts</caption><thead><tr><th>Mot</th><th scope="col">Cible A</th><th scope="col">Cible B</th></tr></thead><tbody>{[...guesses].reverse().map(guess => <tr key={guess.word}><th scope="row">{guess.word}</th>{guess.values.map((value, index) => <td key={index} aria-label={`Cible ${index === 0 ? "A" : "B"} : ${formatScoreFr(value.temperature)} degrés, ${value.found ? "trouvée" : `rang ${formatNumberFr(value.rank)}`}`} style={{ color: warmth(value.temperature).color }}>{formatScoreFr(value.temperature)}°<small>{value.found ? "Trouvé ✓" : `Rang ${formatNumberFr(value.rank)}`}</small></td>)}</tr>)}</tbody></table></div>
      <p>Historique personnel, séparé du classique et exclu de son export. Aucun classement compétitif ni score combiné.</p>
    </section>
  </main>;
}
