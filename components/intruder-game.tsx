"use client";
import { useEffect, useRef, useState } from "react";
import { AppNavigation } from "./app-navigation";
import { readIntruderAttempts, saveIntruderAttempt } from "@/lib/profile-storage";
import type { IntruderAnswer, IntruderAttempt, IntruderQuestion } from "@/lib/intruder";

export default function IntruderGame() {
  const [question, setQuestion] = useState<IntruderQuestion | null>(null);
  const [answer, setAnswer] = useState<IntruderAnswer | null>(null);
  const [attempts, setAttempts] = useState<IntruderAttempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const [summary, setSummary] = useState<{ total: number; completed: number; correct: number; results: IntruderAnswer[] } | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null); const focusResult = useRef(false); const focusQuestion = useRef(false); const questionHeading = useRef<HTMLHeadingElement>(null); const errorNotice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (focusResult.current && (answer || summary || error)) { (error ? errorNotice.current : resultHeading.current)?.focus(); focusResult.current = false; } }, [answer, summary, error]);
  useEffect(() => { if (focusQuestion.current && question) { questionHeading.current?.focus(); focusQuestion.current = false; } }, [question]);
  const generation = useRef(0);
  const submitting = useRef(false); const loading = useRef(false);
  const retryOperation = useRef<{ kind: "question"; index: number } | { kind: "summary" }>({ kind: "question", index: 0 });
  function invalidate() { generation.current++; loading.current = false; }
  async function load(index: number, known: IntruderAttempt[] = attempts) {
    if (loading.current || submitting.current) return; loading.current = true;
    const request = ++generation.current; retryOperation.current = { kind: "question", index };
    setBusy(true); setError(""); setQuestion(null); setAnswer(null); setSummary(null);
    try {
      const existing = known.find(item => item.index === index);
      const response = await fetch(existing ? "/api/intruder" : `/api/intruder?index=${index}`, existing ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(existing) } : { cache: "no-store" });
      const data = await response.json() as IntruderAnswer & { error?: string };
      if (request !== generation.current) return;
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      setQuestion(data); if (existing) setAnswer(data);
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { if (request === generation.current) { loading.current = false; setBusy(false); } }
  }
  async function loadSummary(known = attempts) {
    if (loading.current || submitting.current) return; loading.current = true; retryOperation.current = { kind: "summary" };
    const request = ++generation.current; setBusy(true); setError(""); setQuestion(null); setAnswer(null);
    try { const response = await fetch("/api/intruder/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attempts: known }) }); const data = await response.json() as { total: number; completed: number; correct: number; results: IntruderAnswer[]; error?: string }; if (request !== generation.current) return; if (!response.ok) throw new Error(data.error); setSummary(data); }
    catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { if (request === generation.current) { loading.current = false; setBusy(false); } }
  }
  useEffect(() => {
  // Browser-only silent restoration after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    const saved = readIntruderAttempts(); setAttempts(saved);
    if (saved.length === 20) void loadSummary(saved); else void load(Array.from({ length: 20 }, (_, i) => i).find(i => !saved.some(item => item.index === i)) ?? 0, saved);
    return invalidate;
  // Initial restoration does not replay effects or record an attempt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function choose(choice: number) {
    if (!question || answer || busy || loading.current || submitting.current) return;
    submitting.current = true; focusResult.current = true; setBusy(true); setError("");
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
    <AppNavigation active="explore" modeName="L’intrus" />
    <div className="page-heading"><div><div className="eyebrow">LE LABORATOIRE</div><h1>L’intrus<span>.</span></h1><p>Quatre mots. Une différence à repérer.</p></div></div>
    <a className="text-action" href="/laboratoire/deux-braises">Jouer à Deux braises</a>
    <section className="collection-picker laboratory-card" aria-label="L’intrus">
      <p>Choisissez le mot qui n’appartient pas à la même catégorie. Une seule réponse par énigme, puis l’explication. Aucun score chaud/froid dans ce mode.</p>
      <p>{attempts.length} / 20 énigmes jouées · historique personnel sur cet appareil</p>
      {question && <><h2 ref={questionHeading} tabIndex={-1}>Énigme {question.index + 1} / {question.total}</h2><div className="collection-grid">{question.words.map((word, choice) => <button type="button" key={word} disabled={busy || Boolean(answer)} onClick={() => void choose(choice)} aria-label={`Choisir ${word}`}>{word}{answer && choice === answer.answer && <small>✓ L’intrus</small>}{answer && choice === answer.choice && <small>Votre réponse</small>}</button>)}</div></>}
      {busy && <p role="status">Chargement…</p>}
      {answer && <div className="laboratory-explanation" aria-live="polite"><h2 ref={resultHeading} tabIndex={-1}>{answer.correct ? "Bien vu !" : "Une autre piste à retenir"}</h2><p>{answer.explanation}</p>{attempts.length < 20 && <button className="primary-button" disabled={busy} onClick={() => { focusQuestion.current = true; void load(Array.from({ length: 20 }, (_, index) => index).find(index => !attempts.some(item => item.index === index))!); }}>Énigme suivante</button>}</div>}
      {attempts.length === 20 && !summary && <button className="primary-button" disabled={busy} onClick={() => { focusResult.current = true; void loadSummary(); }}>Voir le bilan des 20 énigmes</button>}
      {summary && <section aria-label="Bilan de la session"><h2 ref={resultHeading} tabIndex={-1}>Session terminée</h2><p>{summary.completed} / {summary.total} énigmes terminées · {summary.correct} réponses justes · {summary.completed - summary.correct} réponses à revoir.</p><p>Ce bilan repose sur vos premières réponses conservées sur cet appareil ou dans cette session.</p><details><summary>Revoir les explications</summary>{summary.results.map(item => <div key={item.index}><h3>Énigme {item.index + 1} · {item.correct ? "Réponse juste" : "À revoir"}</h3><p>Votre réponse : {item.words[item.choice]} · Intrus : {item.words[item.answer]}</p><p>{item.explanation}</p></div>)}</details><a className="text-action" href="/laboratoire/deux-braises">Continuer avec Deux braises</a></section>}
      {error && <p role="alert" ref={errorNotice} tabIndex={-1}>{error} {!question && <button onClick={() => { if (retryOperation.current.kind === "summary") { focusResult.current = true; void loadSummary(); } else { focusQuestion.current = true; void load(retryOperation.current.index); } }}>Réessayer</button>}</p>}
      {warning && <p role="status">La sauvegarde est indisponible. Cette réponse reste visible pendant la session.</p>}
      <details><summary>Choisir une énigme</summary><div className="collection-grid">{Array.from({ length: 20 }, (_, i) => <button type="button" key={i} disabled={busy} onClick={() => { focusQuestion.current = true; void load(i); }}>{i + 1}{attempts.some(item => item.index === i) ? " ✓" : ""}</button>)}</div></details>
      <p>Les réponses sont expliquées par catégories, pas déduites d’une distance vectorielle. L’export du profil classique n’inclut pas cet historique.</p>
    </section>
  </main>;
}
