"use client";
import { useState } from "react";
import { EXPEDITIONS, type ExpeditionStatus } from "@/lib/expeditions";

export function ExpeditionPicker({ disabled, journey, currentStageSolved, error, onContinue }: {
  disabled: boolean; journey: ExpeditionStatus | null; currentStageSolved: boolean; error: string; onContinue: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>(journey?.id ?? EXPEDITIONS[0].id);
  const [chapters, setChapters] = useState(false);
  const journeyId = journey?.id;
  const [previousJourney, setPreviousJourney] = useState(journeyId);
  if (journeyId !== previousJourney) {
    setPreviousJourney(journeyId);
    if (journeyId) setSelected(journeyId);
  }
  const index = EXPEDITIONS.findIndex(item => item.id === selected);
  const current = EXPEDITIONS[index];
  const status = journey?.id === selected ? journey : null;
  const completed = status ? Math.min(status.length, status.completed + (currentStageSolved ? 1 : 0)) : 0;
  const finished = Boolean(status?.reward);
  const next = EXPEDITIONS[index + 1];
  return <section className={`voyage-stage ${chapters ? "chapters-open" : ""}`} aria-label="Chapitres du voyage">
    {!chapters ? <>
      <div className="voyage-title"><span>Chapitre {String(index + 1).padStart(2, "0")}</span><h1>{current.title}</h1>
        {status ? <><progress value={completed} max={status.length} aria-label="Progression du chapitre"/><p>{finished ? "Chapitre terminé" : `${completed} épreuve${completed === 1 ? "" : "s"} sur ${status.length}`}</p></> : <p>{current.length} mots à découvrir</p>}
      </div>
      <div className="voyage-actions"><button className="primary-button full-width" disabled={disabled} onClick={() => finished ? next ? onContinue(next.id) : setChapters(true) : onContinue(selected)}>{disabled ? "Chargement…" : finished ? next ? "Chapitre suivant" : "Tous les chapitres" : "Continuer"}</button><button className="reference-underlink" disabled={disabled} onClick={() => setChapters(true)}>Tous les chapitres</button></div>
    </> : <><div className="voyage-chapters">{EXPEDITIONS.map((item, i) => <button key={item.id} disabled={disabled} className={selected === item.id ? "current" : ""} onClick={() => { setSelected(item.id); setChapters(false); }}><span className="chapter-medal">{i + 1}</span><span><small>Chapitre {String(i + 1).padStart(2, "0")}</small><strong>{item.title}</strong><small>{item.length} épreuves</small></span></button>)}</div><button className="reference-underlink" onClick={() => setChapters(false)}>Revenir au chapitre</button></>}
    {error && <p className="voyage-error" role="alert">{error}</p>}
  </section>;
}
