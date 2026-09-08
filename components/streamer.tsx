"use client";
import { useEffect, useState } from "react";
export default function Streamer() {
  const [id, setId] = useState(""); const [facts, setFacts] = useState<{ revision: number; won: boolean; temperatures: number[] } | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setId(new URLSearchParams(location.search).get("game") ?? ""); }, []);
  async function refresh() { if (busy || !id) return; setBusy(true); setError(""); try {
    const response = await fetch(`/api/server-games?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Partie inaccessible ou connexion indisponible.");
    const data = await response.json() as { game: { revision: number; state: string }; guesses: Array<{ temperature: number }> };
    setFacts({ revision: data.game.revision, won: data.game.state === "won", temperatures: data.guesses.map(guess => guess.temperature) });
  } catch (e) { setFacts(null); setError(e instanceof Error ? e.message : "Indisponible"); } finally { setBusy(false); } }
  return <main className="main-shell laboratory-shell"><div className="eyebrow">BRAISE · AFFICHAGE STREAM</div><h1>{facts?.won ? "Défi réussi !" : "La température monte."}</h1><p>Aucun mot ni solution affiché. Jouez dans l’autre fenêtre, puis actualisez cette vue. Les données ne sont pas actualisées en temps réel.</p><button className="primary-button" disabled={busy || !id} onClick={() => void refresh()}>Actualiser les températures</button>{facts && <><p>{facts.revision} propositions enregistrées</p><ol>{facts.temperatures.map((value, index) => <li key={index}>{value.toFixed(1)}°</li>)}</ol></>}{error && <p role="alert">{error}</p>}</main>;
}
