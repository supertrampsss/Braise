"use client";
import { useEffect, useRef, useState } from "react";
import { EXPEDITIONS, type ExpeditionStatus } from "@/lib/expeditions";
import { restoreLegacyGame } from "@/lib/legacy-storage";
import type { Puzzle, SavedGame } from "@/lib/game-types";
import { resumeExpedition } from "@/lib/expedition-resume";

export function ExpeditionPicker({ disabled, puzzle, game, navigationGeneration, onSelect }: { disabled: boolean; puzzle: Puzzle | null; game: SavedGame; navigationGeneration: () => number; onSelect: (seed: string, saved?: SavedGame) => Promise<boolean> }) {
  const [selected, setSelected] = useState<string>(EXPEDITIONS[0].id);
  const [chapters, setChapters] = useState(false);
  const [status, setStatus] = useState<ExpeditionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ tries: 0, hints: 0 });
  const memory = useRef(new Map<string, SavedGame>());
  const stageIds = useRef(new Set<string>());
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (disabled) controller.current?.abort(); return () => { controller.current?.abort(); }; }, [disabled]);
  async function resume(id: string) {
    if (active.current || disabled) return;
    active.current = true; setBusy(true); setError(""); setStatus(null);
    if (puzzle && stageIds.current.has(puzzle.id)) memory.current.set(puzzle.id, game);
    const abort = new AbortController(); controller.current = abort;
    const generation = navigationGeneration();
    try {
      const result = await resumeExpedition(id, {
        status: async (id, proofs) => {
        const response = await fetch("/api/expeditions", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, proofs }) });
        const data = await response.json() as ExpeditionStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || "Connexion impossible.");
        return data;
        },
        readGame: id => { stageIds.current.add(id); return memory.current.get(id) ?? restoreLegacyGame(id); },
        isCurrent: () => !abort.signal.aborted && generation === navigationGeneration(),
      });
      if (!result || abort.signal.aborted || generation !== navigationGeneration()) return;
      setSummary({ tries: result.tries, hints: result.hints }); setStatus(result.status);
      if (result.status.seed) await onSelect(result.status.seed, result.saved);
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Connexion impossible. Réessayez."); }
    finally { active.current = false; setBusy(false); }
  }
  const current = EXPEDITIONS.find(item => item.id === selected)!;
  return <section className={`voyage-stage ${chapters ? "chapters-open" : ""}`} aria-label="Chapitres du voyage">
    {!chapters ? <><div className="voyage-title"><span>Chapitre {String(EXPEDITIONS.findIndex(item => item.id === selected)+1).padStart(2,"0")}</span><h1>{current.title}</h1>{status?.id === selected ? <><progress value={status.completed} max={status.length}/><p>{status.completed} épreuves sur {status.length}</p></> : <p>{current.length} mots à découvrir</p>}</div><div className="voyage-actions"><button className="primary-button full-width" disabled={disabled || busy} onClick={() => void resume(selected)}>{busy ? "Chargement…" : "Continuer"} <span>›</span></button><button className="reference-underlink" onClick={() => setChapters(true)}>Tous les chapitres</button></div></> : <><div className="voyage-chapters">{EXPEDITIONS.map((item,i) => <button key={item.id} className={selected === item.id ? "current" : ""} onClick={() => {setSelected(item.id);setChapters(false);}}><span className="chapter-medal">{i+1}</span><span><small>Chapitre {String(i+1).padStart(2,"0")}</small><strong>{item.title}</strong><small>{item.length} épreuves</small></span></button>)}</div><button className="reference-underlink" onClick={() => setChapters(false)}>Revenir au chapitre</button></>}
    {error && <p className="voyage-error" role="alert">{error}</p>}
    {status?.reward && <p className="voyage-error">Parcours accompli · {summary.tries} essais · {summary.hints} indices</p>}
  </section>;
}
