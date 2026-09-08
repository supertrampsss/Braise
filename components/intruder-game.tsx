"use client";
import { useEffect, useRef, useState } from "react";
import { readIntruderAttempts, saveIntruderAttempt } from "@/lib/profile-storage";
import type { IntruderAnswer, IntruderAttempt, IntruderQuestion } from "@/lib/intruder";

export default function IntruderGame() {
  const [question, setQuestion] = useState<IntruderQuestion | null>(null);
  const [answer, setAnswer] = useState<IntruderAnswer | null>(null);
  const [attempts, setAttempts] = useState<IntruderAttempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const generation = useRef(0);
  const submitting = useRef(false);
  const retryIndex = useRef(0);
  async function load(index: number, known: IntruderAttempt[] = attempts) {
    const request = ++generation.current; retryIndex.current = index;
    setBusy(true); setError(""); setQuestion(null); setAnswer(null);
    try {
      const existing = known.find(item => item.index === index);
      const response = await fetch(existing ? "/api/intruder" : `/api/intruder?index=${index}`, existing ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(existing) } : { cache: "no-store" });
      const data = await response.json() as IntruderAnswer & { error?: string };
      if (request !== generation.current) return;
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      setQuestion(data); if (existing) setAnswer(data);
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { if (request === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const saved = readIntruderAttempts(); setAttempts(saved);
    void load(Array.from({ length: 20 }, (_, i) => i).find(i => !saved.some(item => item.index === i)) ?? 0, saved);
    return () => { generation.current++; };
  // Initial restoration does not replay effects or record an attempt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function choose(choice: number) {
    if (!question || answer || busy || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    const request = generation.current;
    try {
      const response = await fetch("/api/intruder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edition: question.edition, index: question.index, choice }) });
      const data = await response.json() as IntruderAnswer & { error?: string };
      if (request !== generation.current) return;
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      const attempt: IntruderAttempt = { edition: "intrus-v1", index: question.index, choice, occurredAt: new Date().toISOString() };
      const saved = saveIntruderAttempt(attempt); setWarning(!saved.persisted);
      setAnswer({ ...data, choice: saved.attempt.choice, correct: saved.attempt.choice === data.answer });
      setAttempts(current => [...current.filter(item => item.index !== attempt.index), saved.attempt]);
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { submitting.current = false; if (request === generation.current) setBusy(false); }
  }
  return <main className="main-shell laboratory-shell">
    <a className="text-action" href="/">← Revenir à Braise</a>
    <div className="page-heading"><div><div className="eyebrow">LE LABORATOIRE</div><h1>L’intrus<span>.</span></h1><p>Quatre mots. Une différence à repérer.</p></div></div>
    <a className="text-action" href="/laboratoire/deux-braises">Jouer à Deux braises →</a>
    <section className="collection-picker laboratory-card" aria-label="L’intrus">
      <p>Choisissez le mot qui n’appartient pas à la même catégorie. Une seule réponse par énigme, puis l’explication. Aucun score chaud/froid dans ce mode.</p>
      <p>{attempts.length} / 20 énigmes jouées · historique personnel sur cet appareil</p>
      {question && <><h2>Énigme {question.index + 1} / {question.total}</h2><div className="collection-grid">{question.words.map((word, choice) => <button type="button" key={word} disabled={busy || Boolean(answer)} onClick={() => void choose(choice)} aria-label={`Choisir ${word}`}>{word}{answer && choice === answer.answer && <small>✓ L’intrus</small>}{answer && choice === answer.choice && <small>Votre réponse</small>}</button>)}</div></>}
      {busy && <p role="status">Chargement…</p>}
      {answer && <div className="laboratory-explanation" aria-live="polite"><h2>{answer.correct ? "Bien vu !" : "Une autre piste à retenir"}</h2><p>{answer.explanation}</p>{question && question.index < 19 && <button className="primary-button" disabled={busy} onClick={() => void load(question.index + 1)}>Énigme suivante →</button>}</div>}
      {error && <p role="alert">{error} {!question && <button onClick={() => void load(retryIndex.current)}>Réessayer</button>}</p>}
      {warning && <p role="status">La sauvegarde est indisponible. Cette réponse reste visible pendant la session.</p>}
      <details><summary>Choisir une énigme</summary><div className="collection-grid">{Array.from({ length: 20 }, (_, i) => <button type="button" key={i} disabled={busy} onClick={() => void load(i)}>{i + 1}{attempts.some(item => item.index === i) ? " ✓" : ""}</button>)}</div></details>
      <p>Les réponses sont expliquées par catégories, pas déduites d’une distance vectorielle. L’export du profil classique n’inclut pas cet historique.</p>
    </section>
  </main>;
}
