"use client";

import { CalendarDays, Check, Flame, LockKeyhole, Palette, Sparkles, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { COSMETICS, type CosmeticId, type WeeklyProjection } from "@/lib/weekly-ritual";

function dateLabel(date: string, withYear = false) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });
}

function objectiveIcon(kind: WeeklyProjection["objectives"][number]["kind"]) {
  if (kind === "active-days") return CalendarDays;
  if (kind === "hintless-wins") return Target;
  return Flame;
}

export function WeeklyRitualCard({ projection }: { projection: WeeklyProjection }) {
  return <section className="weekly-card" aria-labelledby="weekly-title">
    <div className="section-topline"><div><span className="card-eyebrow">CETTE SEMAINE</span><h2 id="weekly-title">Trois étincelles</h2></div><span className="small-icon"><CalendarDays size={17} aria-hidden="true" /></span></div>
    <p className="weekly-dates">Du {dateLabel(projection.weekId)} au {dateLabel(projection.weekEnd, projection.weekId.slice(0, 4) !== projection.weekEnd.slice(0, 4))} · heure de Paris</p>
    <ul className="objective-list">
      {projection.objectives.map(objective => {
        const Icon = objectiveIcon(objective.kind);
        return <li className={objective.complete ? "is-complete" : ""} key={objective.id}>
          <span className="objective-icon"><Icon size={16} aria-hidden="true" /></span>
          <div className="objective-copy"><div><strong>{objective.name}</strong><span>{objective.complete ? "Terminé" : `${objective.value} / ${objective.target}`}</span></div><p>{objective.description}</p><Progress value={objective.value / objective.target * 100} aria-label={`Progression de l’objectif ${objective.name}`} aria-valuetext={`${objective.value} sur ${objective.target}`} /></div>
          {objective.complete && <Check className="objective-check" size={17} aria-hidden="true" />}
        </li>;
      })}
    </ul>
    <p className="weekly-note">Les indices ne comptent pas. Chaque objectif terminé débloque un style permanent, sans publicité.</p>
  </section>;
}

export function CosmeticPicker({ projection, disabled, onSelect }: { projection: WeeklyProjection; disabled: boolean; onSelect: (id: CosmeticId) => void }) {
  const unlocked = new Set(projection.unlockedCosmetics);
  return <section className="cosmetic-section" aria-labelledby="cosmetic-title">
    <div className="cosmetic-heading"><span className="modal-symbol compact"><Palette size={21} aria-hidden="true" /></span><div><h3 id="cosmetic-title">Votre style</h3><p>Les styles modifient l’ambiance, jamais les scores ni les indices.</p></div></div>
    <div className="cosmetic-list">
      {COSMETICS.map(cosmetic => {
        const available = unlocked.has(cosmetic.id);
        const selected = projection.selectedCosmetic === cosmetic.id;
        const objective = projection.objectives.find(item => item.reward === cosmetic.id);
        return <div className={`cosmetic-option cosmetic-${cosmetic.id} ${selected ? "is-selected" : ""}`} key={cosmetic.id}>
          <span className="cosmetic-swatch" aria-hidden="true"><Sparkles size={17} /></span>
          <div><strong>{cosmetic.name}</strong><p>{cosmetic.description}</p>{!available && objective && <small>Terminez « {objective.name} » pour le débloquer.</small>}</div>
          {available ? <button type="button" aria-pressed={selected} aria-label={`${selected ? "Style équipé" : "Équiper"} : ${cosmetic.name}`} disabled={disabled || selected} onClick={() => onSelect(cosmetic.id)}>{selected ? <><Check size={16} />Équipé</> : "Équiper"}</button> : <span className="cosmetic-locked"><LockKeyhole size={15} aria-hidden="true" />Verrouillé</span>}
        </div>;
      })}
    </div>
    <p className="modal-note">Les objectifs repartent chaque lundi. Vos styles restent acquis dans ce navigateur.</p>
  </section>;
}
