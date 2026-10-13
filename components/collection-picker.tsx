"use client";
import { useEffect, useState } from 'react';
import { COLLECTIONS, collectionProgress } from '@/lib/collections';
import { readLocalPlays } from '@/lib/play-hub';
import type { Win } from '@/lib/game-types';
export function CollectionPicker({wins,seed,disabled,onSelect}:{wins:readonly Win[];seed?:string;disabled:boolean;onSelect:(seed:string,collection?:string)=>void}) {
  const [started,setStarted]=useState<string[]>([]);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(active)try{setStarted(readLocalPlays(localStorage).filter(p=>!p.game.guesses.some(g=>g.found)).map(p=>p.id));}catch{}};
    queueMicrotask(refresh);
    window.addEventListener("storage",refresh);
    return ()=>{active=false;window.removeEventListener("storage",refresh);};
  },[wins,seed]);
  return <section className="collection-cards" aria-label="Collections thématiques"><h2>Collections · cinq univers</h2>{COLLECTIONS.map(collection=>{
    const progress=collectionProgress(wins,collection), pending=collection.seeds.findIndex(value=>(started.includes(`free-${value}`)||started.includes(`free-w2v-${value}`))), next=pending>=0 ? pending : progress.next;
    return <article key={collection.id}><h3>{collection.title}</h3><p>{collection.description ?? 'Douze mots de nature à découvrir, à votre rythme.'}</p><p>{progress.count} / {collection.seeds.length} énigmes trouvées · {progress.count===collection.seeds.length ? 'Terminée' : pending>=0 ? 'Une énigme à reprendre' : progress.count>0 ? 'Commencée' : 'À découvrir'}</p>{next>=0 && <button className="primary-button" disabled={disabled} onClick={()=>onSelect(collection.seeds[next],collection.id)}>{pending>=0 ? `Reprendre l’énigme ${next+1}` : progress.count>0 ? 'Continuer la collection' : 'Commencer'}</button>}<details><summary>Choisir une énigme</summary><div className="collection-grid">{collection.seeds.map((value,index)=><button type="button" key={value} disabled={disabled} aria-current={seed===value?'step':undefined} onClick={()=>onSelect(value,collection.id)} aria-label={`${collection.title}, énigme ${index+1}, ${progress.completed[index]?'trouvée':(started.includes(`free-${value}`)||started.includes(`free-w2v-${value}`))?'à reprendre':'non jouée'}`}><span>Énigme {index+1}</span><small>{progress.completed[index]?'Trouvée':(started.includes(`free-${value}`)||started.includes(`free-w2v-${value}`))?'À reprendre':'Non jouée'}</small></button>)}</div></details><p className="collection-note">Certains mots traversent plusieurs univers : une victoire commune reste acquise, sans récompense en double.</p></article>;
  })}</section>;
}
