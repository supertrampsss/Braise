"use client";
import { useEffect, useRef, useState } from "react";
import { readTwoBraises, saveTwoBraises } from "@/lib/profile-storage";
import type { TwoBraisesGuess } from "@/lib/two-braises";
import { warmth } from "@/lib/game-types";

export default function TwoBraisesGame() {
  const [pair, setPair] = useState(0);
  const [guesses, setGuesses] = useState<TwoBraisesGuess[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const submitting = useRef(false);
  const revision = useRef(0);
  const memory = useRef(new Map<number, TwoBraisesGuess[]>());
  useEffect(() => { setGuesses(readTwoBraises(0)); setReady(true); }, []);
  const found = [0, 1].map(index => guesses.some(guess => guess.values[index].found));
  function changePair(next: number) {
    if (submitting.current) return;
    memory.current.set(pair, guesses); setPair(next);
    setGuesses(memory.current.get(next) ?? readTwoBraises(next)); setInput(""); setError(""); revision.current++;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || submitting.current || found.every(Boolean) || !input.trim()) return;
    submitting.current = true; setBusy(true); setError(""); const version = revision.current;
    try {
      const response = await fetch("/api/two-braises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edition: "deux-braises-v1", pair, word: input.trim() }) });
      const data = await response.json() as Omit<TwoBraisesGuess, "acceptedAt"> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (guesses.some(guess => guess.word === data.word)) { setError("Ce mot figure déjà dans vos essais."); return; }
      const guess: TwoBraisesGuess = { edition: "deux-braises-v1", pair, word: data.word, values: data.values, acceptedAt: new Date().toISOString() };
      const saved = saveTwoBraises(guess); setWarning(!saved);
      setGuesses(current => {
        const merged = new Map([...readTwoBraises(pair), ...current, guess].map(item => [item.word, item]));
        return [...merged.values()];
      });
      if (version === revision.current) setInput("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className="main-shell laboratory-shell">
    <a className="text-action" href="/">← Revenir à Braise</a>
    <div className="page-heading"><div><div className="eyebrow">LE LABORATOIRE</div><h1>Deux braises<span>.</span></h1><p>Un essai. Deux températures. Deux mots à découvrir.</p></div></div>
    <a className="text-action" href="/laboratoire">Jouer à L’intrus →</a>
    <section className="collection-picker laboratory-card" aria-label="Deux braises">
      <p>Les deux colonnes utilisent les vrais scores du jeu classique. Trouvez les deux mots pour terminer. Une cible trouvée reste acquise. Pas d’indice dans cette variante.</p>
      <label htmlFor="pair-select">Paire </label><select id="pair-select" value={pair} disabled={busy || !ready} onChange={event => changePair(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Paire {index + 1} / 12</option>)}</select>
      <p aria-live="polite">Braise 1 : {found[0] ? "trouvée ✓" : "à découvrir"} · Braise 2 : {found[1] ? "trouvée ✓" : "à découvrir"}</p>
      {found.every(Boolean) ? <h2>Les deux mots sont trouvés ! {guesses.length} essais.</h2> : <form className="guess-form" onSubmit={submit}><label className="sr-only" htmlFor="two-guess">Votre proposition</label><input id="two-guess" value={input} onChange={event => { revision.current++; setInput(event.target.value); }} maxLength={50} autoComplete="off" autoCapitalize="none" placeholder="Un mot français…" disabled={!ready} /><button type="submit" className="guess-button" disabled={busy || !ready || !input.trim()} aria-label="Proposer ce mot">{busy ? "…" : "→"}</button></form>}
      {error && <p role="alert">{error}</p>}{warning && <p role="status">Sauvegarde indisponible : vos essais restent en mémoire dans cette page.</p>}
      <div className="two-braises-history"><table><caption>{guesses.length} essais distincts</caption><thead><tr><th>Mot</th><th>Braise 1</th><th>Braise 2</th></tr></thead><tbody>{[...guesses].reverse().map(guess => <tr key={guess.word}><th scope="row">{guess.word}</th>{guess.values.map((value, index) => <td key={index} style={{ color: warmth(value.temperature).color }}>{value.temperature.toFixed(1).replace(".", ",")}°<small>{value.found ? "Trouvé ✓" : `Rang ${value.rank}`}</small></td>)}</tr>)}</tbody></table></div>
      <p>Historique personnel, séparé du classique et exclu de son export. Aucun classement compétitif ni score combiné.</p>
    </section>
  </main>;
}
