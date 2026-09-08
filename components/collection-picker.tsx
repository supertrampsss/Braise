"use client";

import { Leaf, Check } from "lucide-react";
import { NATURE_COLLECTION, collectionProgress } from "@/lib/collections";
import type { Win } from "@/lib/game-types";

export function CollectionPicker({ wins, seed, disabled, onSelect }: { wins: readonly Win[]; seed?: string; disabled: boolean; onSelect: (seed: string) => void }) {
  const progress = collectionProgress(wins);
  return <details className="collection-picker">
    <summary><Leaf size={20} aria-hidden="true" /><strong>Collection Nature</strong><span>{progress.count} / {NATURE_COLLECTION.seeds.length}</span></summary>
    <div className="collection-content">
      <p>Douze mots à découvrir, à votre rythme. Vos essais et indices sont conservés dans les défis correspondants.</p>
      <div className="collection-grid">
        {NATURE_COLLECTION.seeds.map((value, index) => <button key={value} type="button" disabled={disabled} aria-current={seed === value ? "step" : undefined} onClick={() => onSelect(value)}>
          <span>Énigme {index + 1}</span><small>{progress.completed[index] ? <><Check size={15} aria-hidden="true" />Trouvée</> : seed === value ? "En cours" : "Jouer"}</small>
        </button>)}
      </div>
      {progress.next >= 0 ? <button type="button" className="secondary-button" disabled={disabled} onClick={() => onSelect(NATURE_COLLECTION.seeds[progress.next])}>Continuer la collection</button> : <p role="status">Collection terminée ! Vous pouvez rejouer chaque énigme.</p>}
      <p className="collection-note">Progression personnelle sur cet appareil. Une énigme déjà gagnée en défi reste acquise ici, sans récompense en double.</p>
    </div>
  </details>;
}
