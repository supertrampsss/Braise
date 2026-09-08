"use client";
import { useEffect, useState } from "react";
export function ServerGameLinks({ game }: { game?: string }) {
  const [edition, setEdition] = useState("");
  useEffect(() => { const id = new URLSearchParams(location.search).get("edition"); if (id && /^[a-f0-9-]{36}$/.test(id)) setEdition(id); }, []);
  return <nav aria-label="Parcours partagé">{edition && <a className="text-action" href={`/studio?edition=${edition}`}>Revenir à la création et continuer →</a>}{game && <a className="text-action" href={`/streamer?game=${encodeURIComponent(game)}`} target="_blank" rel="noopener noreferrer">Ouvrir l’affichage sans mots pour le stream ↗</a>}<a className="text-action" href="/cercles">Mes cercles</a><a className="text-action" href="/duels">Mes duels</a></nav>;
}
