"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppNavigation } from "./app-navigation";
import { formatDateFr, formatNumberFr, formatScoreFr } from "@/lib/format-fr";
import { projectionFreshness, type Projection } from "@/lib/projection";
export default function Streamer() {
  const [id, setId] = useState(""); const [facts, setFacts] = useState<Projection | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [automatic, setAutomatic] = useState(false); const [visible, setVisible] = useState(true); const [now, setNow] = useState(0);
  const pending = useRef<AbortController | null>(null); const active = useRef(true);
  const refresh = useCallback(async () => {
    if (pending.current || !id || document.hidden) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projection?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Partie inaccessible ou connexion interrompue. Réessayez.");
      const data = await response.json() as Projection;
      if (!active.current || controller.signal.aborted) return;
      setFacts(data); setLastRefresh(data.refreshedAt); setNow(Date.now());
    } catch (cause) { if (active.current && !controller.signal.aborted) { setFacts(null); setError(cause instanceof Error ? cause.message : "Connexion interrompue."); } }
    finally { if (pending.current === controller) { pending.current = null; if (active.current) setBusy(false); } }
  }, [id]);
  useEffect(() => {
  // Browser-only silent restoration after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    active.current = true; setId(new URLSearchParams(location.search).get("game") ?? "");
    const visibility = () => { setVisible(!document.hidden); setNow(Date.now()); if (document.hidden) pending.current?.abort(); };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { active.current = false; pending.current?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { if (!visible) return; const timer = window.setInterval(() => { setNow(Date.now()); if (automatic) void refresh(); }, 15000); return () => window.clearInterval(timer); }, [automatic, visible, refresh]);
  const freshness = projectionFreshness(facts?.refreshedAt ?? null, now);
  return <main className="main-shell laboratory-shell"><AppNavigation active="explore" modeName="Projection" /><div className="eyebrow">BRAIZ · AFFICHAGE STREAM</div><h1>{facts?.won ? "Défi réussi !" : "La température monte."}</h1>
    <p>Projetez cette fenêtre depuis votre identité. Aucun mot, solution ni essai adverse n’est transmis à cette vue. Le lien seul ne donne pas accès à votre partie.</p>
    <button className="primary-button" disabled={busy || !id} onClick={() => void refresh()}>{busy ? "Actualisation…" : "Actualiser les températures"}</button>
    <label className="projection-option"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Actualisation facultative toutes les 15 secondes</label>
    <p role="status">{!visible ? "Actualisation suspendue : fenêtre masquée." : error ? "Déconnecté ou accès indisponible." : facts ? freshness === "fresh" ? "Vue à jour." : "Vue ancienne : actualisez pour connaître la progression." : "En attente d’une actualisation."}</p>
    {lastRefresh !== null && <p>Dernière actualisation réussie : <time dateTime={new Date(lastRefresh).toISOString()}>{formatDateFr(new Date(lastRefresh), true)}</time></p>}
    {facts && <><p>{formatNumberFr(facts.revision)} propositions enregistrées</p><ol className="projection-temperatures">{facts.temperatures.map((value, index) => <li key={index}>Essai {index + 1} · {formatScoreFr(value)}°</li>)}</ol></>}
    {!id && <p>Ouvrez la projection depuis une partie de votre espace.</p>}{error && <p role="alert">{error}</p>}
  </main>;
}
