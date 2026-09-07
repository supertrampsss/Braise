"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowDownUp, ArrowRight, Award, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Copy, Flame, Infinity as InfinityIcon, Lightbulb, Loader2, LockKeyhole, Pin, Plus, Share2, Snowflake, Sparkles, Target, Trophy, Users, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getStreak, warmth, type Guess, type Mode, type Profile, type Puzzle, type SavedGame } from "@/lib/game-types";

type Modal = "help" | "stats" | "challenge" | "privacy" | "about" | "share" | null;
const EMPTY_PROFILE: Profile = { wins: [], guesses: 0, sound: false };
const EMPTY_GAME: SavedGame = { guesses: [], pins: [], hints: 0, startedAt: 0 };
const STORAGE_PREFIX = "braise.v1.";
function readLocal<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(STORAGE_PREFIX + key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
function validGame(value: SavedGame) {
  return value && Array.isArray(value.guesses) && value.guesses.every(g => g && typeof g.word === "string" && Number.isFinite(g.temperature) && Number.isFinite(g.rank) && Number.isInteger(g.order) && typeof g.found === "boolean") && Array.isArray(value.pins) && value.pins.length <= 3 && value.pins.every(p => typeof p === "string") && Number.isInteger(value.hints) && value.hints >= 0 && value.hints <= 3;
}
function validProfile(value: Profile) {
  return value && Array.isArray(value.wins) && value.wins.every(w => w && typeof w.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && ["daily", "free", "challenge"].includes(w.mode) && Number.isInteger(w.tries) && Number.isInteger(w.hints)) && Number.isFinite(value.guesses) && value.guesses >= 0 && typeof value.sound === "boolean";
}
function freshSeed() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647); }
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
  const [mode, setMode] = useState<Mode>("daily");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [game, setGame] = useState<SavedGame>(EMPTY_GAME);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [record, setRecord] = useState(false);
  const [sort, setSort] = useState<"heat" | "recent">("heat");
  const [modal, setModal] = useState<Modal>(null);
  const [now, setNow] = useState(0);
  const [shareText, setShareText] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const submitting = useRef(false);
  const lastLoad = useRef<{ mode: Mode; seed: string }>({ mode: "daily", seed: "" });
  const victoryRef = useRef<HTMLHeadingElement>(null);

  const best = game.guesses.reduce<Guess | null>((winner, guess) => !winner || guess.temperature > winner.temperature ? guess : winner, null);
  const solved = Boolean(game.guesses.some(g => g.found));
  const temperature = best?.temperature ?? 0;
  const heat = warmth(temperature);
  const latest = game.guesses[game.guesses.length - 1];
  const ordered = [...game.guesses].sort((a, b) => sort === "heat" ? b.temperature - a.temperature || b.order - a.order : b.order - a.order);
  const xp = profile.wins.length * 150 + Math.min(profile.guesses, 10000) * 2;
  const level = Math.floor(xp / 500) + 1;
  const streak = puzzle ? getStreak(profile.wins, puzzle.date) : 0;
  const countdown = puzzle && now ? Math.max(0, new Date(puzzle.resetAt).getTime() - now) : 0;
  const countdownLabel = `${String(Math.floor(countdown / 3600000)).padStart(2, "0")}:${String(Math.floor(countdown / 60000) % 60).padStart(2, "0")}:${String(Math.floor(countdown / 1000) % 60).padStart(2, "0")}`;

  async function loadPuzzle(nextMode: Mode, seed = "") {
    const request = ++requestRef.current;
    lastLoad.current = { mode: nextMode, seed };
    setLoading(true); setLoadError(""); setError(""); setInput(""); setRecord(false);
    setBusy(false); submitting.current = false;
    try {
      const response = await fetch(`/api/game?mode=${nextMode}&seed=${encodeURIComponent(seed)}`, { cache: "no-store" });
      const data = await response.json() as Puzzle & { error?: string };
      if (!response.ok) throw new Error(data.error || "Le jeu ne répond pas. Réessayez dans un instant.");
      if (request !== requestRef.current) return false;
      const stored = readLocal<SavedGame>(`game.${data.id}`, EMPTY_GAME);
      setGame(validGame(stored) ? { ...stored, startedAt: stored.startedAt || Date.now() } : { ...EMPTY_GAME, startedAt: Date.now() });
      setMode(nextMode); setPuzzle(data);
      const url = new URL(window.location.href);
      if (nextMode === "challenge") url.searchParams.set("defi", data.seed);
      else url.searchParams.delete("defi");
      window.history.replaceState(null, "", url);
      if (nextMode === "free") writeLocal("freeSeed", data.seed);
      return true;
    } catch (err) {
      if (request === requestRef.current) setLoadError(err instanceof Error ? err.message : "Connexion impossible.");
      return false;
    } finally { if (request === requestRef.current) setLoading(false); }
  }

  useEffect(() => {
    const stored = readLocal<Profile>("profile", EMPTY_PROFILE);
    if (validProfile(stored)) setProfile(stored);
    const challenge = new URLSearchParams(window.location.search).get("defi");
    if (challenge && /^\d{1,10}$/.test(challenge)) void loadPuzzle("challenge", challenge);
    else void loadPuzzle("daily");
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
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
  function saveProfile(next: Profile) { setProfile(next); if (!writeLocal("profile", next)) setStorageWarning(true); }
  async function changeMode(value: string) {
    if (busy) return;
    if (value === "challenge") { setModal("challenge"); return; }
    const url = new URL(window.location.href); url.searchParams.delete("defi"); window.history.replaceState(null, "", url);
    await loadPuzzle(value as Mode, value === "free" ? readLocal<string>("freeSeed", "") || freshSeed() : "");
  }
  async function submit(event?: FormEvent, isHint = false) {
    event?.preventDefault();
    if (!puzzle || loading || submitting.current || solved) return;
    const word = input.trim().toLocaleLowerCase("fr");
    if (!isHint && !word) { inputRef.current?.focus(); return; }
    if (!isHint && game.guesses.some(g => g.word === word)) { setError(`« ${word} » est déjà dans vos essais.`); inputRef.current?.select(); return; }
    if (isHint && game.hints >= 3) return;
    submitting.current = true; setBusy(true); setError("");
    const request = requestRef.current;
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, seed: puzzle.seed, puzzleId: puzzle.id, word, action: isHint ? "hint" : "guess", hintLevel: game.hints, guesses: isHint ? game.guesses.map(g => g.word) : undefined }) });
      const data = await response.json() as Omit<Guess, "order"> & { error?: string };
      if (request !== requestRef.current) return;
      if (!response.ok) throw new Error(data.error || "Impossible d’analyser ce mot.");
      if (game.guesses.some(g => g.word === data.word)) { setError(`« ${data.word} » est déjà dans vos essais.`); return; }
      const guess: Guess = { ...data, order: game.guesses.length + 1, hint: isHint };
      const next = { ...game, guesses: [...game.guesses, guess], hints: game.hints + (isHint ? 1 : 0), ...(data.found ? { solvedAt: Date.now() } : {}) };
      saveGame(next);
      if (!isHint) setInput(current => current.trim().toLocaleLowerCase("fr") === word ? "" : current);
      const newRecord = !best || data.temperature > best.temperature;
      setRecord(newRecord && game.guesses.length > 0);
      setTimeout(() => setRecord(false), 2000);
      const nextProfile = { ...profile, guesses: profile.guesses + (isHint ? 0 : 1) };
      if (data.found && !profile.wins.some(w => w.id === puzzle.id)) {
        nextProfile.wins = [...profile.wins, { id: puzzle.id, date: puzzle.date, mode, tries: next.guesses.length, hints: next.hints }];
        toast.success("La braise est allumée. Bien joué !", { duration: 4000 });
        requestAnimationFrame(() => victoryRef.current?.focus({ preventScroll: true }));
      }
      saveProfile(nextProfile);
      if (profile.sound && (newRecord || data.found)) playTone(data.found);
      if (isHint) toast("Une nouvelle piste a rejoint vos essais.");
      if (!data.found) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
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
    if (mode !== "daily") url.searchParams.set("defi", puzzle?.seed || "0");
    return `🔥 Braise ${mode === "daily" ? `du ${puzzle?.date}` : "· Défi"}\n${solved ? "Trouvé" : "En piste"} en ${game.guesses.length} essais · ${game.hints ? `${game.hints} indice(s)` : "sans indice"}\n${journey}${solved && !journey.endsWith("🟩") ? "🟩" : ""}\nÀ vous de jouer ! ${url.toString()}`;
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

  return <div className="app-shell">
    <Toaster position="bottom-center" theme="dark" />
    <a className="skip-link" href="#guess">Aller au jeu</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Braise, accueil"><span className="brand-icon"><Flame strokeWidth={2.5} /></span>braise<span className="brand-period">.</span></a>
      <nav className="header-nav" aria-label="Navigation principale"><span className="nav-current">Le jeu</span><button onClick={() => setModal("stats")}>Ma progression</button><button onClick={() => setModal("help")}>Comment jouer</button></nav>
      <div className="header-actions"><span className="level-pill"><Sparkles size={15} />Niv. {level}</span><button className="icon-button" aria-label={profile.sound ? "Désactiver le son" : "Activer le son"} disabled={busy || loading} onClick={() => saveProfile({ ...profile, sound: !profile.sound })}>{profile.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><button className="icon-button mobile-help" aria-label="Comment jouer" onClick={() => setModal("help")}><CircleHelp size={20} /></button></div>
    </header>

    <main className="main-shell">
      <div className="page-heading"><div><div className="eyebrow"><span className="tiny-flame"><Flame size={13} /></span> FAITES CONFIANCE À VOTRE INTUITION</div><h1>Vous brûlez<span>.</span></h1><p>Un mot secret. Trouvez-le en vous rapprochant de son sens.</p></div><button className="streak-overview" onClick={() => setModal("stats")}><Flame size={24} /><span><strong>{streak} <small>jour{streak > 1 ? "s" : ""}</small></strong><span>de série quotidienne</span></span><ChevronRight size={16} /></button></div>

      <Tabs value={mode} onValueChange={changeMode} className="mode-tabs"><TabsList aria-label="Mode de jeu" className="mode-list"><TabsTrigger value="daily" disabled={busy}><Flame />Quotidien</TabsTrigger><TabsTrigger value="free" disabled={busy}><InfinityIcon />Libre</TabsTrigger><TabsTrigger value="challenge" disabled={busy}><Users />Entre amis</TabsTrigger></TabsList>

      <TabsContent value={mode} className="game-tab-content"><div className="play-layout">
        <div className="play-column">
          <section className={`game-panel ${record ? "is-record" : ""} ${solved ? "is-won" : ""}`} aria-label="Plateau de jeu">
            <div className="game-topline"><div><span className="game-kicker">{mode === "daily" ? "LE MOT DU JOUR" : mode === "free" ? "À VOTRE RYTHME" : "LE DÉFI EST LANCÉ"}</span><span className="edition">{puzzle ? `N° ${String(puzzle.number).padStart(3, "0")}` : "…"}</span></div><span className="daily-pill">{mode === "daily" ? <><Clock3 size={13} />{puzzle ? new Date(`${puzzle.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "Aujourd’hui"}</> : <><InfinityIcon size={15} />{mode === "challenge" ? "Même mot, même défi" : "Sans limite de temps"}</>}</span></div>
            {loadError ? <div className="load-error" role="alert"><CircleHelp size={34} /><h2>Une petite pause imprévue.</h2><p>{loadError}</p><button className="primary-button" onClick={() => loadPuzzle(lastLoad.current.mode, lastLoad.current.seed)}>Réessayer<ArrowRight size={18} /></button></div> : <>
              <div className={`heat-scene ${record ? "heat-record" : ""}`} style={{ "--heat-color": best ? heat.color : "#ff754d", "--heat-intensity": String(.18 + Math.max(0, temperature) / 140) } as CSSProperties}>
                <div className="heat-atmosphere" aria-hidden="true" />
                <svg className="heat-dial" viewBox="0 0 330 264" aria-hidden="true"><defs><linearGradient id="dial-gradient" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#ff754d" /><stop offset="1" stopColor="#ffcc9c" /></linearGradient></defs><circle className="dial-orbit" cx="165" cy="146" r="129" /><path className="dial-track" d="M 78.73 232.27 A 122 122 0 1 1 251.27 232.27" pathLength="100" /><path className="dial-value" d="M 78.73 232.27 A 122 122 0 1 1 251.27 232.27" pathLength="100" strokeDasharray={`${best ? Math.max(2, Math.min(100, temperature)) : 0} 100`} /><path className="dial-inner" d="M 98 213 A 95 95 0 1 1 232 213" /></svg>
                <div className="heat-center"><div className="thermo-caption">{solved ? "LA BRAISE EST ALLUMÉE" : "VOTRE MEILLEURE PISTE"}</div><div className={`temperature ${loading ? "is-loading" : ""}`}>{loading ? <Loader2 className="spinner" size={44} /> : <>{best ? temperature.toFixed(1).replace(".", ",") : "0"}<span>°</span></>}</div><div className="heat-status">{solved ? <Sparkles size={17} /> : best && temperature >= 35 ? <Flame size={17} /> : !best ? <Flame size={17} /> : <Snowflake size={17} />}{best ? heat.label : "À vous d’allumer la mèche"}</div></div>
                <div className="dial-labels"><span>FROID</span><span>BRÛLANT</span></div>
                {record && <span className="record-toast"><Zap size={14} />Nouvelle meilleure piste !</span>}
                {solved && <div className="confetti" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
              </div>
              {solved ? <div className="victory-box"><span className="victory-eyebrow">C’ÉTAIT BIEN</span><h2 ref={victoryRef} tabIndex={-1} aria-label={`Bravo, le mot était ${best?.word}`}>{best?.word}</h2><p>{game.guesses.length} essais, {game.hints ? `${game.hints} indice${game.hints > 1 ? "s" : ""}` : "aucun indice"}. Vous avez trouvé votre chemin.</p><div className="victory-actions"><button className="primary-button" onClick={shareResult}><Share2 size={17} />Partager ma victoire</button><button className="secondary-button" onClick={() => loadPuzzle("free", freshSeed())}>Encore un mot<ArrowRight size={17} /></button></div><span className="xp-award"><Sparkles size={14} />+150 XP de victoire</span></div> : <div className="guess-area"><form onSubmit={submit} className="guess-form"><label className="sr-only" htmlFor="guess">Votre proposition</label><input id="guess" ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setError(""); }} placeholder="À quel mot pensez-vous ?" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send" maxLength={50} aria-describedby="guess-feedback" disabled={loading} /><button type="submit" className="guess-button" aria-label="Proposer ce mot" disabled={loading || busy || !input.trim()}>{busy ? <Loader2 className="spinner" size={21} /> : <ArrowRight size={24} />}</button></form><div className={`input-feedback ${error ? "error" : ""}`} id="guess-feedback" aria-live="polite">{error || (latest ? <><span style={{ color: warmth(latest.temperature).color }}>{latest.word} : {latest.temperature.toFixed(1).replace(".", ",")}°</span><span> {warmth(latest.temperature).label.toLowerCase()}.</span></> : <>Le sens compte. Pas les lettres. <span className="keyboard-hint">Entrée ↵</span></>)}</div></div>}
              <div className="game-bottom"><span><Target size={16} /><b>{game.guesses.length}</b> essai{game.guesses.length > 1 ? "s" : ""}</span><span className="rank-info">{best ? <><Flame size={16} /><b>{best.rank <= 1000 ? `#${best.rank}` : "Hors top 1 000"}</b><span className="rank-suffix">{best.rank <= 1000 ? "en proximité" : ""}</span></> : <><Sparkles size={16} />Tous les chemins sont ouverts</>}</span><button className="hint-button" onClick={() => submit(undefined, true)} disabled={loading || busy || solved || game.hints >= 3 || game.guesses.length < 5} title={game.guesses.length < 5 ? "Votre premier indice se débloque après 5 essais" : "Ajouter une piste proche du mot secret"}><Lightbulb size={16} /><span>Un indice</span><span className="hint-count">{3 - game.hints}</span></button></div>
            </>}
          </section>

          <section className="history-panel"><div className="section-topline"><h2>Vos explorations<span>{game.guesses.length}</span></h2><button className="sort-button" onClick={() => setSort(sort === "heat" ? "recent" : "heat")}><ArrowDownUp size={14} />{sort === "heat" ? "Les plus chauds" : "Les plus récents"}</button></div>
            {ordered.length ? <div className="guess-list"><div className="list-labels"><span>ESSAI</span><span>VOTRE MOT</span><span>TEMPÉRATURE</span><span className="pin-label">PISTE</span></div>{ordered.map(g => <div key={g.word} className={`guess-row ${latest?.word === g.word ? "latest-guess" : ""}`} style={{ "--row-color": warmth(g.temperature).color } as CSSProperties}><span className="guess-index">{String(g.order).padStart(2, "0")}</span><div className="guess-word"><strong>{g.word}</strong>{g.found && <Check size={15} />}{g.hint && <Lightbulb size={13} aria-label="Indice" />}{g.word === best?.word && !g.found && <span className="best-tag">MEILLEUR</span>}</div><div className="guess-score"><div className="mini-heat"><i style={{ width: `${Math.max(2, g.temperature)}%` }} /></div><span>{g.temperature.toFixed(1).replace(".", ",")}°</span></div><button aria-label={`${game.pins.includes(g.word) ? "Détacher" : "Épingler"} ${g.word}`} aria-pressed={game.pins.includes(g.word)} className={`pin-button ${game.pins.includes(g.word) ? "pinned" : ""}`} disabled={busy || loading} onClick={() => pin(g.word)}><Pin size={15} /></button></div>)}</div> : <div className="empty-history"><span className="empty-icon"><Sparkles size={23} /></span><div><h3>Tout commence par un mot.</h3><p>Essayez « maison », « amour » ou votre première intuition.</p></div><button className="icon-button" aria-label="Saisir mon premier mot" onClick={() => inputRef.current?.focus()}><ArrowRight size={20} /></button></div>}
          </section>
        </div>

        <aside className="side-column">
          <section className="progress-card"><div className="section-topline"><span className="card-eyebrow">VOTRE ÉTINCELLE</span><span className="small-icon"><Zap size={17} /></span></div><div className="player-level"><span className="level-emblem"><Flame size={27} /></span><div><h2>{level < 3 ? "L’étincelle" : level < 7 ? "La flamme" : "Le brasier"}</h2><span>Niveau {level} · {xp.toLocaleString("fr-FR")} XP</span></div></div><Progress className="xp-track" value={(xp % 500) / 5} aria-label="Progression vers le prochain niveau" aria-valuetext={`${xp % 500} sur 500 XP`} /><div className="xp-caption"><span>{500 - xp % 500} XP avant le niveau {level + 1}</span><Sparkles size={12} /></div><div className="personal-stats"><div><strong>{profile.wins.length}</strong><span>Mots trouvés</span></div><div><strong>{streak}<Flame size={15} /></strong><span>Jours de série</span></div></div><button className="text-action" onClick={() => setModal("stats")}>Ma progression<ArrowRight size={16} /></button></section>

          <section className="notebook-card"><div className="section-topline"><h2><Pin size={17} />Mon carnet</h2><span className="muted-count">{game.pins.length}/3</span></div><p>Gardez vos pistes pour rebondir.</p><div className="notebook-pins">{game.pins.map(word => <button key={word} disabled={busy || loading} onClick={() => pin(word)} title="Détacher cette piste">{word}<X size={13} /></button>)}{Array.from({ length: 3 - game.pins.length }, (_, i) => <span className="empty-pin" key={i}><Plus size={14} /></span>)}</div>{!game.pins.length && <span className="notebook-note">Épinglez un mot dans vos explorations.</span>}</section>

          <section className="tip-card"><span className="tip-icon"><Lightbulb size={20} /></span><div><span className="card-eyebrow">LE DÉCLIC</span><h3>Pensez autour du mot.</h3><p>« Plage » peut être proche de « vacances ». Les mots partagent un univers, pas forcément une définition.</p></div></section>

          <button className="friend-card" onClick={() => setModal("challenge")}><div className="friend-card-top"><span className="friends-glyph"><Users size={23} /></span><ArrowRight size={20} /></div><h2>Qui aura le déclic ?</h2><p>Un même mot. Vos amis.<br />À chacun son chemin.</p><span className="friend-link">Lancer un défi<ChevronRight size={15} /></span></button>
          <div className="reset-note"><Clock3 size={14} /><span>{mode === "daily" ? <>Prochain mot dans <b>{countdownLabel}</b><small>Minuit, heure de Paris</small></> : <>Envie d’une autre piste ?<button disabled={busy} onClick={() => loadPuzzle("free", freshSeed())}>Tirer un nouveau mot <ArrowRight size={12} /></button></>}</span></div>
        </aside>
      </div>

      </TabsContent></Tabs>
      {storageWarning && <p className="storage-warning" role="status">La sauvegarde sur cet appareil est indisponible. Gardez cet onglet ouvert pour conserver votre partie.</p>}
      <section className="ad-zone" aria-label="Espace publicitaire"><span className="ad-label">ESPACE PUBLICITAIRE</span><div><span className="ad-badge"><Flame size={18} /></span><p>Une petite place pour la pub.<br /><strong>Tout le reste, pour le jeu.</strong></p><span className="ad-status">Emplacement disponible</span></div></section>
      <footer className="site-footer"><a className="footer-brand" href="/">braise.</a><span>Un nouveau mot. Un nouveau déclic.</span><div><button onClick={() => setModal("about")}>À propos</button><button onClick={() => setModal("privacy")}>Confidentialité</button><button onClick={() => setModal("help")}>Les règles</button></div><span className="footer-language">FR <span>·</span> Fait pour les curieux</span></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => !open && setModal(null)}><DialogContent className="braise-dialog"><DialogHeader><span className="modal-symbol">{modal === "stats" ? <Trophy /> : modal === "challenge" ? <Users /> : modal === "privacy" ? <LockKeyhole /> : <Flame />}</span><DialogTitle>{modal === "help" ? "Un mot. Et le déclic." : modal === "stats" ? "Votre feu prend." : modal === "challenge" ? "Passez le mot. Pas la réponse." : modal === "privacy" ? "Votre partie vous appartient." : modal === "share" ? "À vous de partager." : "Bienvenue chez Braise."}</DialogTitle><DialogDescription>{modal === "help" ? "La règle tient en trois petites étapes." : modal === "stats" ? "Votre progression, sauvegardée sur cet appareil." : modal === "challenge" ? "Créez un lien : chaque personne cherchera exactement le même mot." : modal === "privacy" ? "Le fonctionnement de cette première version." : modal === "share" ? "Copiez ce texte pour le partager avec vos amis." : "Un jeu de proximité sémantique, en français."}</DialogDescription></DialogHeader>
      {modal === "help" && <><ol className="rules-list"><li><span>01</span><div><h3>Suivez une intuition.</h3><p>Proposez un mot français. Les noms, adjectifs et verbes à l’infinitif sont de bonnes pistes.</p></div></li><li><span>02</span><div><h3>Prenez la température.</h3><p>Plus le score est élevé, plus le sens est proche. 100° : c’est le mot secret. Le rang #1 est le plus proche.</p></div></li><li><span>03</span><div><h3>Changez de perspective.</h3><p>Explorez des associations. Après 5 essais, vous disposez de 3 indices gratuits. Ils sont signalés dans le résultat partagé.</p></div></li></ol><div className="modal-note">La température traduit une proximité calculée, pas une probabilité. Un contraire peut être proche. Les accents manquants sont acceptés si le mot est identifiable.</div><button className="primary-button full-width" onClick={() => { setModal(null); setTimeout(() => inputRef.current?.focus(), 100); }}>J’ai compris, à moi de jouer<ArrowRight size={18} /></button></>}
      {modal === "stats" && <><div className="modal-stats"><div><strong>{profile.wins.length}</strong><span>mots trouvés</span></div><div><strong>{streak}</strong><span>jours de série</span></div><div><strong>{profile.guesses}</strong><span>mots proposés</span></div></div><div className="achievement-list">{[{ icon: Flame, name: "Première étincelle", text: "Trouvez votre premier mot", done: profile.wins.length >= 1 }, { icon: Target, name: "L’intuition juste", text: "Trouvez un mot en 10 essais maximum, sans indice", done: profile.wins.some(w => w.tries <= 10 && w.hints === 0) }, { icon: Award, name: "Ça devient un rituel", text: "Réussissez 3 quotidiens de suite", done: streak >= 3 }, { icon: Trophy, name: "Gardien du feu", text: "Trouvez 10 mots", done: profile.wins.length >= 10 }].map(a => <div className={a.done ? "achievement unlocked" : "achievement"} key={a.name}><a.icon size={23} /><div><h3>{a.name}</h3><p>{a.text}</p></div>{a.done ? <CheckCheck size={18} /> : <LockKeyhole size={16} />}</div>)}</div><p className="modal-note">+2 XP par proposition, +150 XP par victoire. Les indices ne rapportent pas d’XP. La série compte les défis quotidiens réussis, à l’heure de Paris.</p></>}
      {modal === "challenge" && <><div className="challenge-example"><span>VOUS</span><div><Target size={34} /><b>?</b></div><span>VOS AMIS</span></div><p className="modal-copy">Qui trouvera le mot en le moins d’essais ? Le lien ouvre une partie indépendante pour chacun. Partagez ensuite vos résultats pour comparer.</p><button className="primary-button full-width" disabled={busy || loading} onClick={createChallenge}>Créer et copier le lien<Copy size={17} /></button>{mode === "challenge" && <button className="secondary-button full-width" onClick={() => copy(window.location.href, "Lien du défi copié.")}>Copier le défi actuel<Share2 size={16} /></button>}<p className="modal-note">Pas de compte requis. Aucun classement en direct : chacun conserve sa partie sur son appareil.</p></>}
      {modal === "privacy" && <div className="legal-copy"><h3>Une sauvegarde sur votre appareil</h3><p>Les essais, les victoires, les pistes et le choix du son sont enregistrés dans votre navigateur. Ils ne sont pas synchronisés entre appareils.</p><h3>Le calcul des mots</h3><p>Vos propositions sont envoyées au serveur pour calculer leur proximité. Braise ne les enregistre pas dans une base de joueurs. L’hébergeur peut conserver les journaux techniques nécessaires au service.</p><h3>La publicité</h3><p>Aucun réseau publicitaire ni outil d’analyse tiers n’est activé dans cette version. L’espace affiché est réservé. Aucun cookie publicitaire n’est déposé.</p><h3>Repartir de zéro</h3><p>Vous pouvez supprimer les données de ce site dans les réglages de votre navigateur. Cela efface votre progression locale.</p></div>}
      {modal === "about" && <div className="legal-copy"><p>Braise reprend le plaisir de chercher un mot par son contexte, popularisé par <a href="https://semantle.com" target="_blank" rel="noreferrer">Semantle</a> et <a href="https://cemantix.certitudes.org" target="_blank" rel="noreferrer">Cémantix</a>. C’est un projet indépendant.</p><h3>De vrais liens entre les mots</h3><p>Les températures reposent sur les vecteurs français <a href="https://fasttext.cc/docs/en/pretrained-vectors.html" target="_blank" rel="noreferrer">fastText de Meta</a>, entraînés sur Wikipédia, sous licence <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. Les scores sont pré-calculés par similarité cosinus.</p><p>{puzzle ? puzzle.vocabularySize.toLocaleString("fr-FR") : "Des milliers de"} mots sont disponibles. Certains mots rares ou fléchis peuvent manquer. Le rang porte sur ce vocabulaire, pas sur toute la langue française.</p><h3>Le quotidien et le mode libre</h3><p>Le mot quotidien change à minuit à Paris. Le quotidien parcourt une collection de 120 mots. Le mode libre puise dans cette même collection : une répétition reste possible.</p><a href="/semantic-data.json" className="data-link" download>Télécharger les données dérivées et leur attribution<ArrowRight size={15} /></a></div>}
      {modal === "share" && <><textarea className="share-fallback" readOnly value={shareText} onFocus={e => e.currentTarget.select()} aria-label="Texte à copier" /><button className="secondary-button" onClick={() => setModal(null)}>Fermer<Check size={16} /></button></>}
    </DialogContent></Dialog>
  </div>;
}
