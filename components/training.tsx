"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppNavigation } from "./app-navigation";
import { formatNumberFr, formatScoreFr } from "../lib/training-format-fr";
import { decodeTrainingPack, emptyTrainingProgress, OUTSIDE_PACK, readTrainingProgress, saveTrainingProgress, TRAINING_INFO, TRAINING_STORAGE_KEY, trainingScore, trainingWorkerRequest, type OfflineTrainingStatus, type TrainingPack, type TrainingProgress } from "../lib/training";

export default function Training() {
  const [pack, setPack] = useState<TrainingPack | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [input, setInput] = useState("");
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState<OfflineTrainingStatus | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const raw = useRef<string | null>(null);
  const progressOwner = useRef<TrainingProgress | null>(null);
  const downloadLock = useRef(false);
  const wordField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    void fetch(TRAINING_INFO.path, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Le pack n’est pas disponible. Connectez-vous puis réessayez.");
      const value = await decodeTrainingPack(await response.arrayBuffer());
      if (!live) return;
      setPack(value);
      try {
        raw.current = localStorage.getItem(TRAINING_STORAGE_KEY);
        const restored = readTrainingProgress(raw.current, value);
        if (restored.ok) { progressOwner.current = restored.value; setProgress(restored.value); }
        else { setProgress(emptyTrainingProgress(value)); setBlocked(true); setMessage(restored.message); }
      } catch { setProgress(emptyTrainingProgress(value)); setBlocked(true); setMessage("Le stockage personnel est indisponible. Aucun essai ne sera enregistré."); }
    }).catch(error => { if (live) setLoadError(error instanceof TypeError ? "Connexion interrompue ou pack hors ligne absent. Reconnectez-vous puis réessayez ; aucun score disponible." : error instanceof Error ? error.message : "Chargement impossible. Aucun score disponible."); });
    void trainingWorkerRequest("status").then(value => { if (live) setStatus(value); }).catch(error => { if (live) setDownloadMessage(error.message); });
    return () => { live = false; window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  function commit(value: TrainingProgress) {
    if (!pack || blocked) return false;
    if (progressOwner.current !== progress) return false;
    try { raw.current = saveTrainingProgress(localStorage, raw.current, value, pack); progressOwner.current = value; setProgress(value); return true; }
    catch (error) { setBlocked(true); setMessage(error instanceof Error ? error.message : "Sauvegarde impossible. Les données existantes sont conservées."); return false; }
  }

  const puzzle = pack?.puzzles.find(p => p.id === progress?.selected);
  const game = puzzle && progress?.games[puzzle.id];
  const scores = puzzle && game ? game.words.map(word => trainingScore(puzzle, word)!) : [];
  const found = scores.some(score => score.found);
  const best = scores.length ? scores.reduce((a, b) => a.rank <= b.rank ? a : b) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!puzzle || !progress || !game || blocked || found) return;
    const score = trainingScore(puzzle, input);
    if (!score) { setMessage(OUTSIDE_PACK); return; }
    if (game.words.includes(score.word)) { setMessage("Ce mot figure déjà dans vos essais."); return; }
    if (commit({ ...progress, games: { ...progress.games, [puzzle.id]: { ...game, words: [...game.words, score.word] } } })) { setInput(""); setMessage(score.found ? "Mot trouvé ! Votre réussite reste personnelle à cet entraînement." : `${score.word} : ${formatScoreFr(score.temperature)} °C, rang ${formatNumberFr(score.rank)} sur 30 000.`); }
  }

  async function managePack(action: "download" | "remove") {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setBusy(true); setDownloadMessage(action === "download" ? "Téléchargement et vérification du pack et de l’écran de jeu…" : "Suppression du pack hors ligne…");
    try { const result = await trainingWorkerRequest(action); setStatus(result); setDownloadMessage(action === "download" ? "Prêt hors ligne, y compris après fermeture et rechargement de cette page. La progression reste sur cet appareil." : "Les fichiers hors ligne ont été supprimés. Votre progression personnelle est conservée."); }
    catch (error) { setDownloadMessage(error instanceof Error ? error.message : "Action non confirmée. Réessayez en ligne."); }
    finally { downloadLock.current = false; setBusy(false); }
  }

  return <div className="training-page">
    <AppNavigation active="explore" modeName="Entraînement" backHref="/?surface=explore" />
    <main className="training-main">
      <p className="training-eyebrow">À votre rythme · {offline ? "Hors connexion" : "En ligne"}</p>
      <h1>Entraînement guidé</h1>
      <p>Le sens compte, pas les lettres. Trois mots à votre rythme.</p>
      <p>Progression personnelle, sans XP, série ni classement.</p>
      {loadError && <p role="alert">{loadError} <button onClick={() => window.location.reload()}>Réessayer</button></p>}
      {!loadError && !pack && <p role="status">Chargement des scores vérifiés…</p>}
      {pack && progress && <>
        <section aria-label="Choisir un parcours" className="training-levels">
          {pack.puzzles.map(p => <button type="button" key={p.id} aria-pressed={p.id === progress.selected} disabled={blocked} onClick={() => { if (commit({ ...progress, selected: p.id })) {
            setInput(""); setMessage("");
            // Only a deliberate level choice moves focus/scroll, never restore.
            requestAnimationFrame(() => { if (progressOwner.current?.selected === p.id) { wordField.current?.focus({ preventScroll: true }); wordField.current?.scrollIntoView({ block: "center" }); } });
          } }}><strong>{p.level}</strong><span>{progress.games[p.id].words.some(word => trainingScore(p, word)?.found) ? "Terminé" : progress.games[p.id].words.length ? `${progress.games[p.id].words.length} essai${progress.games[p.id].words.length === 1 ? "" : "s"} · Continuer` : "Commencer"}</span></button>)}
        </section>
        {puzzle && game && <section className="training-panel" aria-labelledby="training-board-title">
          <h2 id="training-board-title">{puzzle.level} · {found ? "Mot trouvé" : "À vous de chercher"}</h2>
          <p>{puzzle.definition}</p>
          <form onSubmit={submit}>
            <label htmlFor="training-word">Votre proposition</label>
            <div className="training-input-row"><input ref={wordField} id="training-word" value={input} maxLength={60} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={blocked || found} onChange={event => setInput(event.target.value)} /><button type="submit" disabled={blocked || found || !input.trim()}>Proposer</button></div>
          </form>
          <p role="status" aria-live="polite">{message}</p>
          <p>Indices disponibles dès le début, à votre demande : {game.hints} / {puzzle.hints.length} utilisés.</p>
          <ol>{puzzle.hints.slice(0, game.hints).map(hint => <li key={hint}>{hint}</li>)}</ol>
          <button className="training-secondary" disabled={blocked || found || game.hints === puzzle.hints.length} onClick={() => { if (commit({ ...progress, games: { ...progress.games, [puzzle.id]: { ...game, hints: game.hints + 1 } } })) setMessage(puzzle.hints[game.hints]); }}>Voir l’indice suivant</button>
          {best && <p><strong>Meilleure piste :</strong> {best.word} · {formatScoreFr(best.temperature)} °C · rang {formatNumberFr(best.rank)}. La température exprime la proximité de sens, pas une probabilité de victoire.</p>}
          {scores.length > 0 && <><h3>Vos essais · plus récent d’abord</h3><ol className="training-attempts">{scores.toReversed().map((score, i) => <li key={score.word}><strong>{score.word}</strong><span>{formatScoreFr(score.temperature)} °C · rang {formatNumberFr(score.rank)}{i === 0 ? " · Dernier essai" : ""}{score.found ? " · Trouvé" : ""}</span></li>)}</ol></>}
        </section>}
        <details className="training-panel"><summary>Voir les {pack.vocabulary.length} mots acceptés et l’aide</summary><p>Les niveaux sont des repères éditoriaux selon le sens du mot et ses indices, sans difficulté mesurée auprès de joueurs.</p><p>Ce pack fini accepte uniquement les graphies de cette liste, avec les accents. Un mot hors pack ne reçoit aucun score. Cette liste comprend aussi les trois réponses.</p><p className="training-vocabulary">{pack.vocabulary.join(" · ")}</p></details>
      </>}
      <section className="training-panel" aria-labelledby="training-download-title">
        <h2 id="training-download-title">Emporter ce petit pack</h2>
        <p>{TRAINING_INFO.wordCount} mots acceptés, 3 énigmes et 9 indices. Les rangs comparent chaque mot au vocabulaire V1 de 30 000 mots, pas aux seuls mots du pack.</p>
        {status && <p>{status.bytes.toLocaleString("fr-FR")} octets au total (pack, écran de jeu, JavaScript, styles et manifeste ; taille non compressée). {status.ready ? "Disponible hors ligne." : "Pas encore téléchargé pour le hors ligne."}</p>}
        {status && status.olderVersions > 0 && <p>Une ancienne version hors ligne reste conservée jusqu’à suppression explicite.</p>}
        <button type="button" disabled={busy || !status || status.ready || offline} onClick={() => void managePack("download")}>Télécharger pour jouer hors ligne</button>
        {status && status.storedVersions > 0 && <button className="training-secondary" type="button" disabled={busy} onClick={() => void managePack("remove")}>Supprimer les fichiers hors ligne</button>}
        <p role="status">{downloadMessage}</p>
        <p>Le quotidien et les parties partagées demandent une connexion. Le navigateur peut libérer son stockage ; vérifiez ici la disponibilité avant de partir.</p>
      </section>
    </main>
  </div>;
}
