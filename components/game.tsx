"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowDownUp, ArrowRight, Award, CalendarDays, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Copy, Flame, Infinity as InfinityIcon, Lightbulb, Loader2, LockKeyhole, Pin, Plus, Share2, Sparkles, Target, Trophy, Users, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import AdPlacement from "@/components/ad-placement";
import { CosmeticPicker, WeeklyRitualCard } from "@/components/weekly-ritual";
import { ProfileTransfer } from "@/components/profile-transfer";
import { CollectionPicker } from "@/components/collection-picker";
import { ExpeditionPicker } from "@/components/expedition-picker";
import { getStreak, warmth, type Guess, type Mode, type Puzzle, type SavedGame } from "@/lib/game-types";

import { EMPTY_GAME, EMPTY_PROFILE, readLocal, writeLocal, restoreLegacyGame } from "@/lib/legacy-storage";
import { samePuzzleRef, type EvaluationResponse, type GameEffect } from "@/lib/game-contracts";
import { consumeGameFeedback, createGameFeedback, inputAfterAcceptedGuess, shouldAdmitGameFeedback } from "@/lib/game-feedback";
import { isProfileStorageKey, recordLocalGameProgress, refreshLocalProfile, setLocalCosmetic, setLocalSound, type ProfileSnapshot } from "@/lib/profile-storage";
import { archiveDateStatus, LEGACY_ARCHIVE_START_DATE, latestArchiveDate, parisDate } from "@/lib/calendar";
import { COSMETICS, projectWeeklyRitual, type CosmeticId } from "@/lib/weekly-ritual";

type Modal = "help" | "stats" | "challenge" | "privacy" | "about" | "share" | null;
function freshSeed() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647); }
function archiveDateError(date: string, now = new Date()) {
  const status = archiveDateStatus(date, now);
  if (status === "before-start") return "Aucune archive n’est disponible pour cette date.";
  if (status === "today-or-future") return "Cette date est à venir. Choisissez une date passée.";
  if (status === "invalid") return "Choisissez une date valide.";
  return "";
}
function playTone(won: boolean) {
  try {
    const ctx = new AudioContext();
    [0, .09, .19].slice(0, won ? 3 : 1).forEach((delay, i) => {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = [523.25, 659.25, 783.99][i];
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(.055, ctx.currentTime + delay + .015);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + delay + .25);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + delay); oscillator.stop(ctx.currentTime + delay + .3);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch { /* Sound is optional. */ }
}

export default function Game() {
  const [view, setView] = useState<"play" | "explore">("play");
  const viewRef = useRef<"play" | "explore">("play");
  const exploreHeadingRef = useRef<HTMLHeadingElement>(null);
  const gameBoardRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [game, setGame] = useState<SavedGame>(EMPTY_GAME);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadRetryable, setLoadRetryable] = useState(true);
  const [feedback, setFeedback] = useState<GameEffect | null>(null);
  const [sort, setSort] = useState<"heat" | "recent">("heat");
  const [modal, setModal] = useState<Modal>(null);
  const [now, setNow] = useState(0);
  const [shareText, setShareText] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveDraft, setArchiveDraft] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const submitting = useRef(false);
  const inputRevisionRef = useRef(0);
  const consumedFeedbackRef = useRef(new Set<string>());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const modalRef = useRef<Modal>(null);
  const lastLoad = useRef<{ mode: Mode; locator: string; sessionSave?: SavedGame }>({ mode: "daily", locator: "" });
  const victoryRef = useRef<HTMLHeadingElement>(null);
  modalRef.current = modal;

  useEffect(() => {
    const changed = viewRef.current !== view;
    viewRef.current = view;
    if (view === "explore") exploreHeadingRef.current?.focus({ preventScroll: true });
    else if (changed && modalRef.current === null) gameBoardRef.current?.focus({ preventScroll: true });
  }, [view]);

  const profile = profileSnapshot?.profile ?? EMPTY_PROFILE;
  const best = game.guesses.reduce<Guess | null>((winner, guess) => !winner || guess.temperature > winner.temperature ? guess : winner, null);
  const solved = Boolean(game.guesses.some(g => g.found));
  const temperature = best?.temperature ?? 0;
  const heat = warmth(temperature);
  const latest = game.guesses[game.guesses.length - 1];
  const ordered = [...game.guesses].sort((a, b) => sort === "heat" ? b.temperature - a.temperature || b.order - a.order : b.order - a.order);
  const xp = profile.wins.length * 150 + Math.min(profile.guesses, 10000) * 2;
  const level = Math.floor(xp / 500) + 1;
  const today = now ? parisDate(new Date(now)) : "";
  const streak = today ? getStreak(profile.wins, today) : 0;
  const ritual = useMemo(
    () => now ? projectWeeklyRitual(profileSnapshot?.activities ?? [], profile.wins, new Date()) : null,
    [profileSnapshot, today],
  );
  const selectedCosmetic = ritual?.selectedCosmetic ?? "classic";
  const archiveMax = now ? latestArchiveDate(new Date(now)) : LEGACY_ARCHIVE_START_DATE;
  const tabMode = mode === "archive" ? "daily" : mode;
  const countdown = puzzle && now ? Math.max(0, new Date(puzzle.resetAt).getTime() - now) : 0;
  const countdownLabel = `${String(Math.floor(countdown / 3600000)).padStart(2, "0")}:${String(Math.floor(countdown / 60000) % 60).padStart(2, "0")}:${String(Math.floor(countdown / 1000) % 60).padStart(2, "0")}`;
  const isRecord = feedback?.type === "bestImproved" && feedback.puzzleRef.id === puzzle?.id;
  const isAccepted = feedback?.type === "guessAccepted" && feedback.puzzleRef.id === puzzle?.id;
  const isCelebratingWin = feedback?.type === "puzzleWon" && feedback.puzzleRef.id === puzzle?.id;
  const feedbackAnnouncement = isRecord && latest
    ? `Nouvelle meilleure piste : ${latest.word}, ${latest.temperature.toFixed(1).replace(".", ",")} degrés.`
    : isAccepted && latest
      ? `Proposition acceptée : ${latest.word}, ${latest.temperature.toFixed(1).replace(".", ",")} degrés.`
      : "";

  function clearDeferredUi() {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    feedbackTimerRef.current = null;
    focusFrameRef.current = null;
  }

  function showFeedback(next: GameEffect) {
    if (!shouldAdmitGameFeedback(consumedFeedbackRef.current, next)) return;
    consumedFeedbackRef.current.add(next.id);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(next);
    const duration = next.type === "puzzleWon" ? 1800 : next.type === "bestImproved" ? 1800 : 650;
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(current => consumeGameFeedback(current, next.id));
      feedbackTimerRef.current = null;
    }, duration);
  }

  function closeHelpAndFocusGame() {
    setView("play");
    modalRef.current = null;
    setModal(null);
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    const request = requestRef.current;
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (request === requestRef.current && modalRef.current === null && viewRef.current === "play") inputRef.current?.focus({ preventScroll: true });
    });
  }

  async function loadPuzzle(nextMode: Mode, locator = "", sessionSave?: SavedGame) {
    const request = ++requestRef.current;
    lastLoad.current = { mode: nextMode, locator, sessionSave };
    clearDeferredUi();
    consumedFeedbackRef.current.clear();
    inputRevisionRef.current += 1;
    setMode(nextMode); setGame(EMPTY_GAME); setPuzzle(null); setLoadRetryable(true);
    if (nextMode === "archive") { setArchiveOpen(true); setArchiveDraft(locator); setArchiveStatus("Chargement de l’archive…"); }
    else { setArchiveOpen(false); setArchiveStatus(""); }
    setLoading(true); setLoadError(""); setError(""); setInput(""); setFeedback(null);
    setBusy(false); submitting.current = false;
    try {
      const query = nextMode === "archive" ? `mode=archive&date=${encodeURIComponent(locator)}` : `mode=${nextMode}&seed=${encodeURIComponent(locator)}`;
      const response = await fetch(`/api/game?${query}`, { cache: "no-store" });
      const data = await response.json() as Puzzle & { error?: string };
      if (request !== requestRef.current) return false;
      if (!response.ok) { if (request === requestRef.current) setLoadRetryable(response.status >= 500); throw new Error(data.error || "Le jeu ne répond pas. Réessayez dans un instant."); }
      const restored = sessionSave ?? restoreLegacyGame(data.id);
      setGame(restored);
      setMode(nextMode); setPuzzle(data);
      setArchiveOpen(nextMode === "archive");
      setArchiveError("");
      setArchiveStatus(nextMode === "archive" ? `Archive du ${new Date(`${data.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} chargée.` : "");
      if (restored.profileV2StartIndex !== undefined) {
        const reconciled = recordLocalGameProgress(data, restored, undefined, profileSnapshot ?? undefined);
        setProfileSnapshot(reconciled);
        if (!reconciled.persisted) setStorageWarning(true);
      }
      const url = new URL(window.location.href);
      if (nextMode === "challenge") url.searchParams.set("defi", data.seed);
      else url.searchParams.delete("defi");
      if (nextMode === "archive") url.searchParams.set("archive", data.date);
      else url.searchParams.delete("archive");
      window.history.replaceState(null, "", url);
      if (nextMode === "free") writeLocal("freeSeed", data.seed);
      return true;
    } catch (err) {
      if (request === requestRef.current) { setLoadError(err instanceof Error ? err.message : "Connexion impossible."); setArchiveStatus(""); }
      return false;
    } finally { if (request === requestRef.current) setLoading(false); }
  }

  useEffect(() => {
    const refreshProfile = (preservePending = true) => setProfileSnapshot(current => refreshLocalProfile(preservePending ? current ?? undefined : undefined));
    refreshProfile();
    const onStorage = (event: StorageEvent) => { if (isProfileStorageKey(event.key)) refreshProfile(event.key !== null); };
    const onVisibility = () => { if (document.visibilityState === "visible") refreshProfile(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    const params = new URLSearchParams(window.location.search);
    const archive = params.get("archive");
    const challenge = params.get("defi");
    setArchiveDraft(latestArchiveDate());
    if (archive !== null) void loadPuzzle("archive", archive);
    else if (challenge && /^\d{1,10}$/.test(challenge)) void loadPuzzle("challenge", challenge);
    else void loadPuzzle("daily");
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      requestRef.current += 1;
      submitting.current = false;
      clearInterval(tick);
      clearDeferredUi();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (mode === "daily" && puzzle && now >= Date.parse(puzzle.resetAt) && !loading && !busy && !loadError) {
      toast("Le nouveau mot du jour est arrivé !");
      void loadPuzzle("daily");
    }
  }, [now, puzzle, mode, loading, busy, loadError]);

  function saveGame(next: SavedGame) {
    setGame(next);
    if (puzzle && !writeLocal(`game.${puzzle.id}`, next)) setStorageWarning(true);
  }
  function saveSound(value: boolean) {
    const next = setLocalSound(value, new Date().toISOString(), crypto.randomUUID(), undefined, profileSnapshot ?? undefined);
    setProfileSnapshot(next);
    if (!next.persisted) setStorageWarning(true);
  }
  function selectCosmetic(value: CosmeticId) {
    if (!ritual?.unlockedCosmetics.includes(value)) return;
    const next = setLocalCosmetic(value, new Date().toISOString(), crypto.randomUUID(), undefined, profileSnapshot ?? undefined);
    setProfileSnapshot(next);
    if (!next.persisted) setStorageWarning(true);
    toast.success(`${COSMETICS.find(cosmetic => cosmetic.id === value)?.name ?? "Style"} équipé.`);
  }
  async function changeMode(value: string) {
    if (busy) return;
    if (value === "challenge") { setModal("challenge"); return; }
    const url = new URL(window.location.href); url.searchParams.delete("defi"); window.history.replaceState(null, "", url);
    await loadPuzzle(value as Mode, value === "free" ? readLocal<string>("freeSeed", "") || freshSeed() : "");
  }
  function revealArchives() {
    setArchiveDraft(current => current || latestArchiveDate(new Date(now || Date.now())));
    setArchiveError("");
    setArchiveOpen(true);
  }
  async function openArchive(event: FormEvent) {
    event.preventDefault();
    const message = archiveDateError(archiveDraft, new Date(now || Date.now()));
    setArchiveError(message);
    if (message || busy) return;
    await loadPuzzle("archive", archiveDraft);
  }
  async function submit(event?: FormEvent, isHint = false) {
    event?.preventDefault();
    if (!puzzle || loading || submitting.current || solved) return;
    const word = input.trim().toLocaleLowerCase("fr");
    const submittedRevision = inputRevisionRef.current;
    const focusOwner = document.activeElement;
    const shouldReturnFocus = focusOwner === inputRef.current || Boolean(event?.currentTarget.contains(focusOwner));
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = null;
    if (!isHint && !word) { inputRef.current?.focus(); return; }
    if (!isHint && game.guesses.some(g => g.word === word)) { setError(`« ${word} » est déjà dans vos essais.`); inputRef.current?.select(); return; }
    if (isHint && game.hints >= 3) return;
    submitting.current = true; setBusy(true); setError("");
    const request = requestRef.current;
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, seed: puzzle.seed, date: mode === "archive" ? puzzle.date : undefined, puzzleId: puzzle.id, puzzleRef: puzzle.ref, word, action: isHint ? "hint" : "guess", hintLevel: game.hints, guesses: isHint ? game.guesses.map(g => g.word) : undefined }) });
      const data = await response.json() as EvaluationResponse & { error?: string };
      if (request !== requestRef.current) return;
      if (!response.ok) throw new Error(data.error || "Impossible d’analyser ce mot.");
      if (!samePuzzleRef(data.puzzleRef, puzzle.ref)) throw new Error("La réponse ne correspond pas à cette partie. Rechargez le jeu.");
      if (game.guesses.some(g => g.word === data.word)) { setError(`« ${data.word} » est déjà dans vos essais.`); return; }
      const acceptedAt = new Date().toISOString();
      const guess: Guess = { word: data.word, temperature: data.temperature, rank: data.rank, found: data.found, order: game.guesses.length + 1, hint: isHint, acceptedAt };
      const next = { ...game, guesses: [...game.guesses, guess], hints: game.hints + (isHint ? 1 : 0), profileV2StartIndex: game.profileV2StartIndex ?? game.guesses.length, ...(data.found ? { solvedAt: Date.parse(acceptedAt), completedMode: mode } : {}) };
      setInput(current => inputAfterAcceptedGuess(current, isHint, inputRevisionRef.current, submittedRevision));
      const nextFeedback = createGameFeedback(best?.temperature ?? null, guess, puzzle.ref);
      showFeedback(nextFeedback);
      const progressed = recordLocalGameProgress(puzzle, next, undefined, profileSnapshot ?? undefined);
      setProfileSnapshot(progressed);
      if (!progressed.persisted) setStorageWarning(true);
      saveGame(next);
      if (data.found && !profile.wins.some(w => w.id === puzzle.id)) {
        toast.success("La braise est allumée. Bien joué !", { duration: 4000 });
      }
      if (profile.sound && nextFeedback.type !== "guessAccepted") playTone(data.found);
      if (isHint) toast("Une nouvelle piste a rejoint vos essais.");
      if (shouldReturnFocus) {
        focusFrameRef.current = requestAnimationFrame(() => {
          focusFrameRef.current = null;
          if (request !== requestRef.current || modalRef.current !== null || viewRef.current !== "play") return;
          if (document.activeElement !== focusOwner && document.activeElement !== document.body) return;
          (data.found ? victoryRef.current : inputRef.current)?.focus({ preventScroll: true });
        });
      }
    } catch (err) { if (request === requestRef.current) setError(err instanceof Error ? err.message : "Une erreur est survenue."); }
    finally { if (request === requestRef.current) { submitting.current = false; setBusy(false); } }
  }

  function pin(word: string) {
    if (!game.pins.includes(word) && game.pins.length >= 3) { toast("Votre carnet accueille 3 pistes. Détachez-en une pour continuer."); return; }
    saveGame({ ...game, pins: game.pins.includes(word) ? game.pins.filter(w => w !== word) : [...game.pins, word] });
  }
  async function copy(text: string, feedback: string) {
    try { await navigator.clipboard.writeText(text); toast.success(feedback); }
    catch { setShareText(text); setModal("share"); }
  }
  function resultText() {
    const journey = game.guesses.filter(g => !g.hint).filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 8)) === 0).slice(0, 8).map(g => g.found ? "🟩" : g.temperature >= 55 ? "🟥" : g.temperature >= 35 ? "🟧" : g.temperature >= 18 ? "🟨" : "🟦").join("");
    const url = new URL(window.location.origin);
    url.searchParams.delete("defi"); url.searchParams.delete("archive");
    if (mode === "archive" && puzzle) url.searchParams.set("archive", puzzle.date);
    else if (mode !== "daily") url.searchParams.set("defi", puzzle?.seed || "0");
    return `🔥 Braise ${mode === "daily" ? `du ${puzzle?.date}` : mode === "archive" ? `· Archive du ${puzzle?.date}` : "· Défi"}\n${solved ? "Trouvé" : "En piste"} en ${game.guesses.length} essais · ${game.hints ? `${game.hints} indice(s)` : "sans indice"}\n${journey}${solved && !journey.endsWith("🟩") ? "🟩" : ""}\nÀ vous de jouer ! ${url.toString()}`;
  }
  async function shareResult() {
    const text = resultText();
    if (navigator.share) { try { await navigator.share({ title: "Braise", text }); return; } catch (err) { if (err instanceof Error && err.name === "AbortError") return; } }
    await copy(text, "Résultat copié, sans révéler le mot.");
  }
  async function createChallenge() {
    const seed = freshSeed();
    const url = new URL(window.location.origin); url.searchParams.set("defi", seed);
    setModal(null); window.history.replaceState(null, "", url);
    const loaded = await loadPuzzle("challenge", seed);
    if (!loaded) return;
    await copy(url.toString(), "Lien du défi copié. Envoyez-le à vos amis !");
  }

  return <div className={`app-shell focused-interface cosmetic-${selectedCosmetic}`}>
    <Toaster position="bottom-center" theme="dark" />
    <a className="skip-link" href={view === "play" ? "#game-board" : "#explore-heading"}>Aller au contenu</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Braise, accueil"><span className="brand-icon"><Flame strokeWidth={2.5} /></span>braise<span className="brand-period">.</span></a>
      <nav className="header-nav" aria-label="Navigation principale">
        <button type="button" aria-current={view === "play" ? "page" : undefined} onClick={() => setView("play")}>Jouer</button>
        <button type="button" aria-current={view === "explore" ? "page" : undefined} onClick={() => setView("explore")}>Explorer</button>
        <button type="button" onClick={() => setModal("stats")}>Progression</button>
      </nav>
      <div className="header-actions"><button className="icon-button" aria-label="Comment jouer" onClick={() => setModal("help")}><CircleHelp size={21} /></button></div>
    </header>

    <main className="main-shell">
      <div className="page-heading" hidden={view !== "play"}><div><h1>{mode === "daily" ? "Le mot du jour" : mode === "archive" ? "Un mot des archives" : mode === "free" ? "Un mot, à votre rythme" : "Votre défi"}</h1><p>Proposez un mot. Plus son sens est proche, plus ça chauffe.</p></div></div>
      <div hidden={view !== "play"} className="play-view">
      <Tabs value={tabMode} onValueChange={changeMode} className="mode-tabs"><TabsList aria-label="Mode de jeu" className="mode-list"><TabsTrigger value="daily" disabled={busy}><Flame />Quotidien</TabsTrigger><TabsTrigger value="free" disabled={busy}><InfinityIcon />Libre</TabsTrigger><TabsTrigger value="challenge" disabled={busy}><Users />Entre amis</TabsTrigger></TabsList>

      <TabsContent value={tabMode} className="game-tab-content">
      <section className={`archive-access ${archiveOpen || mode === "archive" ? "is-open" : ""}`} aria-label="Archives des mots quotidiens">
        {!archiveOpen && mode !== "archive" ? <button className="archive-reveal" type="button" onClick={revealArchives} disabled={busy}><CalendarDays size={18} /><span><strong>Archives</strong><small>Rejouer un ancien mot</small></span><ChevronRight size={16} /></button> : <form className="archive-form" onSubmit={openArchive}>
          <label htmlFor="archive-date">Date du mot</label>
          <input id="archive-date" type="date" min={LEGACY_ARCHIVE_START_DATE} max={archiveMax} value={archiveDraft} onChange={event => { setArchiveDraft(event.target.value); setArchiveError(""); }} aria-invalid={Boolean(archiveError)} aria-describedby={archiveError ? "archive-error" : undefined} disabled={busy || loading} />
          <button className="secondary-button" type="submit" disabled={busy || loading}>Ouvrir</button>
          {mode === "archive" ? <button className="archive-today" type="button" onClick={() => loadPuzzle("daily")} disabled={busy || loading}>Revenir au mot du jour</button> : <button className="archive-close" type="button" aria-label="Fermer les archives" onClick={() => { setArchiveOpen(false); setArchiveError(""); }}><X size={18} /></button>}
          {archiveError && <p id="archive-error" className="archive-error">{archiveError}</p>}
          {mode === "archive" && <p className="archive-rule">Une archive enrichit votre progression, sans prolonger votre série quotidienne.</p>}
        </form>}
        <span className="archive-status" role="status" aria-live="polite" aria-atomic="true">{archiveStatus}</span>
      </section>
      <div className="play-layout">
        <div className="play-column">
          <section id="game-board" ref={gameBoardRef} tabIndex={-1} className={`game-panel ${isAccepted ? "is-accepted" : ""} ${isRecord ? "is-record" : ""} ${solved ? "is-won" : ""} ${isCelebratingWin ? "is-celebrating" : ""}`} aria-label="Plateau de jeu">
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{feedbackAnnouncement}</p>
            <div className="game-topline"><div><span className="game-kicker">{mode === "daily" ? "LE MOT DU JOUR" : mode === "archive" ? "ARCHIVE" : mode === "free" ? "À VOTRE RYTHME" : "LE DÉFI EST LANCÉ"}</span><span className="edition">{puzzle ? `N° ${String(puzzle.number).padStart(3, "0")}` : "…"}</span></div><span className="daily-pill">{mode === "daily" || mode === "archive" ? <><Clock3 size={13} />{puzzle ? new Date(`${puzzle.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(mode === "archive" ? { year: "numeric" as const } : {}), timeZone: "UTC" }) : mode === "archive" ? "Archive" : "Aujourd’hui"}</> : <><InfinityIcon size={15} />{mode === "challenge" ? "Même mot, même défi" : "Sans limite de temps"}</>}</span></div>
{loadError ? <div className="load-error" role="alert"><CircleHelp size={34} /><h2>{mode === "archive" ? "Archive indisponible." : "Une petite pause imprévue."}</h2><p>{loadError}</p>{loadRetryable && <button className="primary-button" onClick={() => loadPuzzle(lastLoad.current.mode, lastLoad.current.locator, lastLoad.current.sessionSave)}>Réessayer<ArrowRight size={18} /></button>}{mode === "archive" && <button className="text-action" onClick={() => loadPuzzle("daily")}>Revenir au mot du jour<ArrowRight size={16} /></button>}</div> : <>
              {solved ? <div className="victory-box"><span className="victory-eyebrow">C’ÉTAIT BIEN</span><h2 ref={victoryRef} tabIndex={-1} aria-label={`Bravo, le mot était ${best?.word}`}>{best?.word}</h2><p>{game.guesses.length} essais, {game.hints ? `${game.hints} indice${game.hints > 1 ? "s" : ""}` : "aucun indice"}. Vous avez trouvé votre chemin.</p><div className="victory-actions"><button className="primary-button" onClick={shareResult}><Share2 size={17} />Partager ma victoire</button><button className="secondary-button" onClick={() => loadPuzzle("free", freshSeed())}>Encore un mot<ArrowRight size={17} /></button></div>{isCelebratingWin && <span className="xp-award"><Sparkles size={14} />Mot trouvé</span>}</div> : <div className="guess-area"><form onSubmit={submit} className="guess-form" aria-busy={busy}><label className="sr-only" htmlFor="guess">Votre proposition</label><input id="guess" ref={inputRef} value={input} onChange={e => { inputRevisionRef.current += 1; setInput(e.target.value); setError(""); }} placeholder="À quel mot pensez-vous ?" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send" maxLength={50} aria-describedby="guess-feedback" aria-invalid={Boolean(error)} disabled={loading} /><button type="submit" className="guess-button" aria-label={busy ? "Analyse en cours" : "Proposer ce mot"} disabled={loading || busy || !input.trim()}>{busy ? <Loader2 aria-hidden="true" className="spinner" size={21} /> : <ArrowRight size={24} />}</button></form><div className={`input-feedback ${error ? "error" : ""}`} id="guess-feedback" aria-live="polite">{error || (loading ? "Chargement du mot…" : latest ? <><span style={{ color: warmth(latest.temperature).color }}>{latest.word} : {latest.temperature.toFixed(1).replace(".", ",")}°</span><span> {warmth(latest.temperature).label.toLowerCase()}.</span></> : <>Le sens compte. Pas les lettres. <span className="keyboard-hint">Entrée ↵</span></>)}</div></div>}
              {best && <div className={`heat-summary ${isRecord ? "heat-record" : ""}`} style={{ "--heat-color": heat.color } as CSSProperties}>
                <div><span>Meilleure piste</span><strong>{best.word}</strong></div>
                <div className="heat-reading"><strong>{temperature.toFixed(1).replace(".", ",")}°</strong><span>{heat.label}</span></div>
                <div className="heat-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, temperature))}%` }} /></div>
                {isRecord && <span className="compact-record">Nouvelle meilleure piste</span>}
              </div>}
              <div className="game-bottom"><span><Target size={16} /><b>{game.guesses.length}</b> essai{game.guesses.length > 1 ? "s" : ""}</span><span className="rank-info">{best ? <><Flame size={16} /><b>{best.rank <= 1000 ? `#${best.rank}` : "Hors top 1 000"}</b><span className="rank-suffix">{best.rank <= 1000 ? "en proximité" : ""}</span></> : <><Sparkles size={16} />Tous les chemins sont ouverts</>}</span><button className="hint-button" onClick={() => submit(undefined, true)} disabled={loading || busy || solved || game.hints >= 3 || game.guesses.length < 5} title={game.guesses.length < 5 ? "Votre premier indice se débloque après 5 essais" : "Ajouter une piste proche du mot secret"}><Lightbulb size={16} /><span>Un indice</span><span className="hint-count">{3 - game.hints}</span></button></div>
            </>}
          </section>

          {game.pins.length > 0 && <section className="notebook-card"><div className="section-topline"><h2><Pin size={17} />Mon carnet</h2><span className="muted-count">{game.pins.length}/3</span></div><p>Gardez vos pistes pour rebondir.</p><div className="notebook-pins">{game.pins.map(word => <button key={word} disabled={busy || loading} onClick={() => { pin(word); if (game.pins.length === 1) inputRef.current?.focus(); }} title="Détacher cette piste">{word}<X size={13} /></button>)}{Array.from({ length: 3 - game.pins.length }, (_, i) => <span className="empty-pin" key={i}><Plus size={14} /></span>)}</div>{!game.pins.length && <span className="notebook-note">Épinglez un mot dans vos explorations.</span>}</section>}
          <section className="history-panel"><div className="section-topline"><h2>Vos essais<span>{game.guesses.length}</span></h2><button className="sort-button" onClick={() => setSort(sort === "heat" ? "recent" : "heat")}><ArrowDownUp size={14} />{sort === "heat" ? "Les plus chauds" : "Les plus récents"}</button></div>
            {ordered.length ? <div className="guess-list"><div className="list-labels"><span>ESSAI</span><span>VOTRE MOT</span><span>TEMPÉRATURE</span><span className="pin-label">PISTE</span></div>{ordered.map(g => <div key={g.word} className={`guess-row ${latest?.word === g.word ? "latest-guess" : ""} ${feedback && latest?.word === g.word ? "is-new-guess" : ""}`} style={{ "--row-color": warmth(g.temperature).color } as CSSProperties}><span className="guess-index">{String(g.order).padStart(2, "0")}</span><div className="guess-word"><strong>{g.word}</strong>{g.found && <Check size={15} />}{g.hint && <Lightbulb size={13} aria-label="Indice" />}{g.word === best?.word && !g.found && <span className="best-tag">MEILLEUR</span>}</div><div className="guess-score"><div className="mini-heat"><i style={{ width: `${Math.max(2, g.temperature)}%` }} /></div><span>{g.temperature.toFixed(1).replace(".", ",")}°</span></div><button aria-label={`${game.pins.includes(g.word) ? "Détacher" : "Épingler"} ${g.word}`} aria-pressed={game.pins.includes(g.word)} className={`pin-button ${game.pins.includes(g.word) ? "pinned" : ""}`} disabled={busy || loading} onClick={() => pin(g.word)}><Pin size={15} /></button></div>)}</div> : <div className="empty-history"><span className="empty-icon"><Sparkles size={23} /></span><div><h3>Tout commence par un mot.</h3><p>Essayez « maison », « amour » ou votre première intuition.</p></div><button className="icon-button" aria-label="Saisir mon premier mot" onClick={() => inputRef.current?.focus()}><ArrowRight size={20} /></button></div>}
          </section>
        </div>


      </div>

      <div className="reset-note"><Clock3 size={14} /><span>{mode === "daily" ? <>Prochain mot dans <b>{countdownLabel}</b><small>Minuit, heure de Paris</small></> : mode === "archive" ? <>Cette archive reste disponible<button disabled={busy} onClick={() => loadPuzzle("daily")}>Revenir au mot du jour <ArrowRight size={12} /></button></> : <>Envie d’une autre piste ?<button disabled={busy} onClick={() => loadPuzzle("free", freshSeed())}>Tirer un nouveau mot <ArrowRight size={12} /></button></>}</span></div>
      </TabsContent></Tabs>
      </div>
      <section className="explore-view" hidden={view !== "explore"} aria-labelledby="explore-heading">
        <div className="page-heading"><div><h1 id="explore-heading" ref={exploreHeadingRef} tabIndex={-1}>Explorer</h1><p>Choisissez une autre façon de jouer. Votre partie vous attend.</p></div></div>
        <section className="explore-group" aria-labelledby="solo-heading"><h2 id="solo-heading">À votre rythme</h2>
      <ExpeditionPicker disabled={busy || loading} puzzle={puzzle} game={game} navigationGeneration={() => requestRef.current} onSelect={(seed, saved) => { setView("play"); return loadPuzzle("challenge", seed, saved); }} />
      <CollectionPicker wins={profile.wins} seed={mode === "challenge" || mode === "free" ? puzzle?.seed : undefined} disabled={busy || loading} onSelect={seed => {
        const url = new URL(window.location.href); url.searchParams.delete("archive"); url.searchParams.set("defi", seed);
        window.history.replaceState(null, "", url); setView("play"); void loadPuzzle("challenge", seed);
      }} />

          <a className="explore-link" href="/laboratoire"><span><strong>Laboratoire</strong><small>L’intrus et Deux braises</small></span><ArrowRight size={18} /></a>
        </section>
        <section className="explore-group" aria-labelledby="friends-heading"><h2 id="friends-heading">Avec d’autres joueurs</h2>
          <button type="button" className="explore-link" onClick={() => { setView("play"); setModal("challenge"); }}><span><strong>Partager un mot</strong><small>Un lien, le même mot pour vos amis</small></span><ArrowRight size={18} /></button>
          <a className="explore-link" href="/cercles"><span><strong>Cercles</strong><small>Retrouvez votre groupe</small></span><ArrowRight size={18} /></a>
          <a className="explore-link" href="/duels"><span><strong>Duels</strong><small>Trois manches à deux</small></span><ArrowRight size={18} /></a>
        </section>
        <section className="explore-group" aria-labelledby="space-heading"><h2 id="space-heading">Votre espace</h2>
          <a className="explore-link" href="/espace"><span><strong>Mes parties en ligne</strong><small>Retrouver les parties conservées sur le serveur</small></span><ArrowRight size={18} /></a>
          <a className="explore-link" href="/studio"><span><strong>Studio</strong><small>Composer et partager une création</small></span><ArrowRight size={18} /></a>
        </section>
      </section>
      {(storageWarning || profileSnapshot && ["partial", "corrupt", "unsupported", "conflict", "memory-only"].includes(profileSnapshot.status)) && <p className="storage-warning" role="status" aria-live="polite" aria-atomic="true">{profileSnapshot?.status === "unsupported" ? "Cette sauvegarde provient d’une version plus récente de Braise. Elle n’a pas été modifiée." : profileSnapshot?.status === "corrupt" ? "La sauvegarde locale est illisible. Les données existantes ont été conservées sans être remplacées." : profileSnapshot?.status === "conflict" ? "Deux anciennes sauvegardes différentes ont été détectées. Elles ont été conservées sans fusion automatique." : profileSnapshot?.status === "partial" ? "Une partie de votre ancienne sauvegarde n’a pas pu être reprise. Les éléments valides restent disponibles." : "La sauvegarde est indisponible dans ce navigateur. Vous pouvez continuer à jouer, mais votre progression risque d’être perdue en quittant ou en rechargeant cette page."}</p>}
      <AdPlacement />
      <footer className="site-footer"><a className="footer-brand" href="/">braise.</a><div><button onClick={() => setModal("about")}>À propos</button><button onClick={() => setModal("privacy")}>Confidentialité</button><button onClick={() => setModal("help")}>Les règles</button></div></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => !open && setModal(null)}><DialogContent className="braise-dialog"><DialogHeader><span className="modal-symbol">{modal === "stats" ? <Trophy /> : modal === "challenge" ? <Users /> : modal === "privacy" ? <LockKeyhole /> : <Flame />}</span><DialogTitle>{modal === "help" ? "Un mot. Et le déclic." : modal === "stats" ? "Votre progression" : modal === "challenge" ? "Passez le mot. Pas la réponse." : modal === "privacy" ? "Votre partie vous appartient." : modal === "share" ? "À vous de partager." : "Bienvenue chez Braise."}</DialogTitle><DialogDescription>{modal === "help" ? "La règle tient en trois petites étapes." : modal === "stats" ? "Votre progression personnelle, enregistrée dans ce navigateur." : modal === "challenge" ? "Créez un lien : chaque personne cherchera exactement le même mot." : modal === "privacy" ? "Le fonctionnement de cette première version." : modal === "share" ? "Copiez ce texte pour le partager avec vos amis." : "Un jeu de proximité sémantique, en français."}</DialogDescription></DialogHeader>
      {modal === "help" && <><ol className="rules-list"><li><span>01</span><div><h3>Suivez une intuition.</h3><p>Proposez un mot français. Les noms, adjectifs et verbes à l’infinitif sont de bonnes pistes.</p></div></li><li><span>02</span><div><h3>Prenez la température.</h3><p>Plus le score est élevé, plus le sens est proche. 100° : c’est le mot secret. Le rang #1 est le plus proche.</p></div></li><li><span>03</span><div><h3>Changez de perspective.</h3><p>Explorez des associations. Après 5 essais, vous disposez de 3 indices gratuits. Ils sont signalés dans le résultat partagé.</p></div></li></ol><div className="modal-note">La température traduit une proximité calculée, pas une probabilité. Un contraire peut être proche. Les accents manquants sont acceptés si le mot est identifiable.</div><button className="primary-button full-width" onClick={closeHelpAndFocusGame}>J’ai compris, à moi de jouer<ArrowRight size={18} /></button></>}
      {modal === "stats" && <><section className="progress-card"><div className="section-topline"><span className="card-eyebrow">VOTRE ÉTINCELLE</span><span className="small-icon"><Zap size={17} /></span></div><div className="player-level"><span className="level-emblem"><Flame size={27} /></span><div><h2>{level < 3 ? "L’étincelle" : level < 7 ? "La flamme" : "Le brasier"}</h2><span>Niveau {level} · {xp.toLocaleString("fr-FR")} XP</span></div></div><Progress className="xp-track" value={(xp % 500) / 5} aria-label="Progression vers le prochain niveau" aria-valuetext={`${xp % 500} sur 500 XP`} /><div className="xp-caption"><span>{500 - xp % 500} XP avant le niveau {level + 1}</span><Sparkles size={12} /></div></section>

          {ritual && <WeeklyRitualCard projection={ritual} />}<button className="secondary-button sound-setting" disabled={busy || loading} onClick={() => saveSound(!profile.sound)}>{profile.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}{profile.sound ? "Son activé" : "Son désactivé"}</button><div className="modal-stats"><div><strong>{profile.wins.length}</strong><span>mots trouvés</span></div><div><strong>{streak}</strong><span>jours de série</span></div><div><strong>{profile.guesses}</strong><span>mots proposés</span></div></div>{profileSnapshot && <section className="local-save-status" aria-label="Sauvegarde locale"><h3>Sauvegarde locale</h3><p>{profileSnapshot.persisted ? `Enregistrée dans ce navigateur · format v${profileSnapshot.formatVersion}` : "Sauvegarde indisponible dans ce navigateur"}</p>{profileSnapshot.status === "migrated" && <span>Votre ancienne progression a été reprise.</span>}{profileSnapshot.backupConfirmed && <span>Une copie de secours de l’ancien format est conservée ici.</span>}{profileSnapshot.persisted && <span>Les onglets de Braise dans ce navigateur partagent cette progression.</span>}<ProfileTransfer snapshot={profileSnapshot} onSnapshot={setProfileSnapshot} /></section>}<div className="achievement-list">{[{ icon: Flame, name: "Première étincelle", text: "Trouvez votre premier mot", done: profile.wins.length >= 1 }, { icon: Target, name: "L’intuition juste", text: "Trouvez un mot en 10 essais maximum, sans indice", done: profile.wins.some(w => w.tries <= 10 && w.hints === 0) }, { icon: Award, name: "Ça devient un rituel", text: "Réussissez 3 quotidiens de suite", done: streak >= 3 }, { icon: Trophy, name: "Gardien du feu", text: "Trouvez 10 mots", done: profile.wins.length >= 10 }].map(a => <div className={a.done ? "achievement unlocked" : "achievement"} key={a.name}><a.icon size={23} /><div><h3>{a.name}</h3><p>{a.text}</p></div>{a.done ? <CheckCheck size={18} /> : <LockKeyhole size={16} />}</div>)}</div><p className="modal-note">+2 XP par proposition, +150 XP par victoire. Les indices ne rapportent pas d’XP. La série compte les défis quotidiens réussis, à l’heure de Paris.</p>{ritual && <CosmeticPicker projection={ritual} disabled={busy || loading} onSelect={selectCosmetic} />}</>}
      {modal === "challenge" && <><div className="challenge-example"><span>VOUS</span><div><Target size={34} /><b>?</b></div><span>VOS AMIS</span></div><p className="modal-copy">Qui trouvera le mot en le moins d’essais ? Le lien ouvre une partie indépendante pour chacun. Partagez ensuite vos résultats pour comparer.</p><button className="primary-button full-width" disabled={busy || loading} onClick={createChallenge}>Créer et copier le lien<Copy size={17} /></button>{mode === "challenge" && <button className="secondary-button full-width" onClick={() => copy(window.location.href, "Lien du défi copié.")}>Copier le défi actuel<Share2 size={16} /></button>}<p className="modal-note">Pas de compte requis. Aucun classement en direct : chacun conserve sa partie sur son appareil.</p></>}
      {modal === "privacy" && <div className="legal-copy"><h3>Une sauvegarde dans votre navigateur</h3><p>Les modes personnels conservent vos essais, victoires, pistes et préférences dans ce navigateur. Les onglets y partagent la même progression. L’export de profil ne contient pas les parties en cours ni les épingles. Effacer les données du site efface cette progression locale et ses copies de secours.</p><h3>Les parties partagées</h3><p>Votre espace, les cercles, les duels et les créations utilisent une identité invitée et un cookie de session. Le serveur conserve le pseudonyme, les participations, les propositions et les résultats nécessaires à leur reprise. Un code secret facultatif permet de retrouver cette identité. Effacer les cookies ne supprime pas ces enregistrements serveur.</p><h3>Le calcul des mots</h3><p>Vos propositions sont envoyées au serveur pour calculer leur proximité. Les résultats personnels ne deviennent pas automatiquement des résultats compétitifs. L’hébergeur peut conserver les journaux techniques nécessaires au service.</p><h3>La publicité</h3><p>Aucun réseau publicitaire ni outil d’analyse tiers n’est activé. L’espace affiché est réservé et aucun cookie publicitaire n’est déposé.</p><h3>Hors connexion</h3><p>Seul un écran de secours neutre est mis en cache, sans proposition, résultat ni page privée.</p></div>}
      {modal === "about" && <div className="legal-copy"><p>Braise reprend le plaisir de chercher un mot par son contexte, popularisé par <a href="https://semantle.com" target="_blank" rel="noreferrer">Semantle</a> et <a href="https://cemantix.certitudes.org" target="_blank" rel="noreferrer">Cémantix</a>. C’est un projet indépendant.</p><h3>De vrais liens entre les mots</h3><p>Les températures reposent sur les vecteurs français <a href="https://fasttext.cc/docs/en/pretrained-vectors.html" target="_blank" rel="noreferrer">fastText de Meta</a>, entraînés sur Wikipédia, sous licence <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. Les scores sont pré-calculés par similarité cosinus.</p><p>{puzzle ? puzzle.vocabularySize.toLocaleString("fr-FR") : "Des milliers de"} mots sont disponibles. Certains mots rares ou fléchis peuvent manquer. Le rang porte sur ce vocabulaire, pas sur toute la langue française.</p><h3>Le quotidien et le mode libre</h3><p>Le mot quotidien change à minuit à Paris. Le quotidien parcourt une collection de 120 mots. Le mode libre puise dans cette même collection : une répétition reste possible.</p><a href="/semantic-data.json" className="data-link" download>Télécharger les données dérivées et leur attribution<ArrowRight size={15} /></a></div>}
      {modal === "share" && <><textarea className="share-fallback" readOnly value={shareText} onFocus={e => e.currentTarget.select()} aria-label="Texte à copier" /><button className="secondary-button" onClick={() => setModal(null)}>Fermer<Check size={16} /></button></>}
    </DialogContent></Dialog>
  </div>;
}
