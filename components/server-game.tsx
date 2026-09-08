"use client";
import { useEffect, useRef, useState } from "react";
type Session = { guest: { id: string; name: string } | null; csrf?: string };
type GameView = { game: { id: string; state: string; revision: number }; guesses: Array<{ word: string; ordinal: number; temperature: number; rank: number; found: boolean }> };
export default function ServerGame() {
  const [session, setSession] = useState<Session>({ guest: null });
  const [view, setView] = useState<GameView | null>(null);
  const [games, setGames] = useState<Array<{ id: string; state: string; revision: number }>>([]);
  const [name, setName] = useState(""); const [word, setWord] = useState("");
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const lock = useRef(false); const inputRevision = useRef(0);
  const pending = useRef<{ id: string; requestId: string; word: string; revision: number } | null>(null);
  async function api(path: string, body?: unknown, csrf = session.csrf) {
    const response = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json", "X-Braise-CSRF": csrf ?? "" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const data = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(data.error || "Service indisponible."); return data;
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Service indisponible."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refreshGames() { const data = await api("/api/server-games"); setGames(data.games as typeof games); }
  useEffect(() => { void perform(async () => {
    const result = await api("/api/session") as Session; setSession(result);
    if (result.guest) await refreshGames();
  });
  // Restore only. A page visit does not create a guest or a game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <main className="main-shell laboratory-shell"><a className="text-action" href="/">← Revenir à Braise</a><div className="page-heading"><div><div className="eyebrow">PARTIES CONSERVÉES PAR LE SERVEUR</div><h1>Votre espace<span>.</span></h1><p>Une identité invitée pour préparer les jeux partagés.</p></div></div>
    <section className="collection-picker laboratory-card">
      {!session.guest ? <form onSubmit={event => { event.preventDefault(); void perform(async () => { const data = await api("/api/session", { name }) as Session; setSession(data); }); }}><label htmlFor="guest-name">Votre pseudonyme</label><input id="guest-name" value={name} maxLength={24} onChange={event => setName(event.target.value)} disabled={busy} /><button type="submit" className="primary-button" disabled={busy || !name.trim()}>Créer mon identité invitée</button></form> : <><h2>{session.guest.name}</h2><button className="primary-button" disabled={busy} onClick={() => void perform(async () => { const data = await api("/api/server-games", { action: "create", id: crypto.randomUUID() }); setView(data as GameView); pending.current = null; await refreshGames(); })}>Nouvelle partie serveur</button><p>La session dure 30 jours. Sans récupération de compte, supprimer les cookies fait perdre l’accès à cette identité. Les anciennes parties locales ne deviennent pas des résultats serveur.</p>
      <details><summary>Mes 50 dernières parties</summary>{games.map(game => <button className="text-action" key={game.id} disabled={busy} onClick={() => void perform(async () => { setView(await api(`/api/server-games?id=${game.id}`) as GameView); pending.current = null; })}>{game.state === "won" ? "Trouvée ✓" : "Reprendre"} · {game.revision} essais</button>)}</details></>}
      {view && <><h2>{view.game.state === "won" ? "Mot trouvé !" : "Trouvez le mot secret"}</h2><p>{view.game.revision} essais conservés côté serveur. Pas d’indice dans ce mode.</p><button className="text-action" disabled={busy} onClick={() => void perform(async () => { setView(await api(`/api/server-games?id=${view.game.id}`) as GameView); pending.current = null; })}>Actualiser la partie</button>{view.game.state !== "won" && <form className="guess-form" onSubmit={event => { event.preventDefault(); const revision = inputRevision.current; void perform(async () => {
        const existing = pending.current;
        const request = existing && existing.id === view.game.id && existing.word === word.trim() ? existing : { id: view.game.id, requestId: crypto.randomUUID(), word: word.trim(), revision: view.game.revision };
        pending.current = request;
        const data = await api("/api/server-games", { action: "guess", ...request }); setView(data as GameView); pending.current = null;
        if (revision === inputRevision.current) setWord("");
      }); }}><label className="sr-only" htmlFor="server-word">Votre proposition</label><input id="server-word" value={word} maxLength={50} onChange={event => { inputRevision.current++; setWord(event.target.value); }} placeholder="Un mot français…" /><button className="guess-button" type="submit" disabled={busy || !word.trim()}>→</button></form>}<div className="two-braises-history"><table><caption>Historique enregistré</caption><thead><tr><th>Mot</th><th>Température</th><th>Rang</th></tr></thead><tbody>{[...view.guesses].reverse().map(guess => <tr key={guess.ordinal}><th scope="row">{guess.word}</th><td>{guess.temperature.toFixed(1)}°</td><td>{guess.found ? "Trouvé ✓" : guess.rank}</td></tr>)}</tbody></table></div></>}
      {session.guest && <details><summary>Déconnecter cet appareil</summary><p>Sans récupération configurée, vous ne pourrez plus accéder à cette identité depuis cet appareil. Les parties ne seront pas supprimées.</p><button className="text-action" disabled={busy} onClick={() => void perform(async () => {
        const response = await fetch("/api/session", { method: "DELETE", headers: { "Content-Type": "application/json", "X-Braise-CSRF": session.csrf ?? "" } });
        if (!response.ok) throw new Error("La déconnexion n’a pas abouti. Réessayez.");
        setSession({ guest: null }); setView(null); setGames([]); pending.current = null; setWord("");
      })}>Confirmer la déconnexion</button></details>}
      {busy && <p role="status">Chargement…</p>}{error && <p role="alert">{error}</p>}
      <p>Les cercles et les duels seront raccordés à ce socle. Aucun joueur ni classement fictif.</p>
    </section></main>;
}
