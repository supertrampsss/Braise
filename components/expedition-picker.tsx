"use client";
import { useEffect, useRef, useState } from "react";
import { EXPEDITIONS, type ExpeditionStatus } from "@/lib/expeditions";
import { restoreLegacyGame } from "@/lib/legacy-storage";
import type { Puzzle, SavedGame } from "@/lib/game-types";
import { resumeExpedition } from "@/lib/expedition-resume";

export function ExpeditionPicker({ disabled, puzzle, game, navigationGeneration, onSelect }: { disabled: boolean; puzzle: Puzzle | null; game: SavedGame; navigationGeneration: () => number; onSelect: (seed: string, saved?: SavedGame) => Promise<boolean> }) {
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
  return <details className="collection-picker">
    <summary>Expéditions <span>6 parcours · 3 étapes</span></summary>
    <section className="collection-content" aria-label="Expéditions">
      <p>Trois mots à découvrir dans l’ordre. Chaque étape suivante se dévoile après une réponse trouvée.</p>
      <div className="collection-grid">{EXPEDITIONS.map(item => <button type="button" key={item.id} disabled={disabled || busy} onClick={() => void resume(item.id)}>{item.title}<small>Commencer ou reprendre</small></button>)}</div>
      <div aria-live="polite">{busy ? <p>Vérification du parcours…</p> : status && <p>{EXPEDITIONS.find(item => item.id === status.id)?.title} : {status.completed === status.length ? "Parcours accompli ✓" : `${status.completed} / ${status.length} mots trouvés. Étape ${status.completed + 1} déverrouillée.`}</p>}</div>
      {status?.reward && <p>🏅 Insigne de parcours acquis · {summary.tries} essais · {summary.hints} indices. Un seul insigne par édition, sans crédit supplémentaire. Il reste acquis tant que les parties sont conservées sur cet appareil.</p>}
      {status?.seed && <button className="primary-button" type="button" disabled={disabled || busy} onClick={() => void resume(status.id)}>Continuer le parcours</button>}
      {error && <p role="alert">{error}</p>}
      <p>Après une victoire, revenez ici pour continuer. Essais, indices et épingles restent dans ce navigateur. L’export du profil ne contient pas ces parties : sur un autre appareil, les étapes sont à rejouer. Aucune publicité obligatoire.</p>
    </section>
  </details>;
}
