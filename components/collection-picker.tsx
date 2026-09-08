"use client";

import { Leaf, Check } from "lucide-react";
import { COLLECTIONS, collectionProgress } from "@/lib/collections";
import type { Win } from "@/lib/game-types";

export function CollectionPicker({ wins, seed, disabled, onSelect }: { wins: readonly Win[]; seed?: string; disabled: boolean; onSelect: (seed: string) => void }) {
  return <details className="collection-picker"><summary><Leaf size={20} aria-hidden="true" /><strong>Collections</strong><span>5 univers</span></summary><section className="collection-content" aria-label="Collections thématiques">{COLLECTIONS.map(collection => {
  const progress = collectionProgress(wins, collection);
  return <details key={collection.id} name="braise-collections" className="collection-picker">
    <summary><Leaf size={20} aria-hidden="true" /><strong>{collection.title}</strong><span>{progress.count} / {collection.seeds.length}</span></summary>
    <div className="collection-content">
      <p>{collection.description ?? "Douze mots de nature à découvrir, à votre rythme."}</p>
      <div className="collection-grid">
        {collection.seeds.map((value, index) => <button key={value} type="button" disabled={disabled} aria-label={`${collection.title}, énigme ${index + 1}, ${progress.completed[index] ? "trouvée" : "jouer"}`} aria-current={seed === value ? "step" : undefined} onClick={() => onSelect(value)}>
          <span>Énigme {index + 1}</span><small>{progress.completed[index] ? <><Check size={15} aria-hidden="true" />Trouvée</> : seed === value ? "En cours" : "Jouer"}</small>
        </button>)}
      </div>
      {progress.next >= 0 ? <button type="button" className="secondary-button" disabled={disabled} onClick={() => onSelect(collection.seeds[progress.next])}>Continuer la collection</button> : <p role="status">Collection terminée ! Vous pouvez rejouer chaque énigme.</p>}
      <p className="collection-note">Essais et indices conservés sur cet appareil. Certains mots traversent plusieurs univers : une victoire commune reste acquise, sans récompense en double.</p>
    </div>
  </details>;
  })}</section></details>;
}
