"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type SetStateAction } from "react";
import { Menu, CalendarDays, Check, CircleHelp, Clock3, Copy, Flame, Infinity as InfinityIcon, Lightbulb, LockKeyhole, Pin, Plus, Share2, Sparkles, Target, Users, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { EXTRA_MODES_ENABLED } from "@/lib/release";
import { clientId } from "@/lib/client-id";
import FlameScene from "@/components/flame-scene";
import AdPlacement from "@/components/ad-placement";
import { deviceBoardRevision, admitDeviceBoardMerge } from "@/lib/device-sync-admission";
import { ProfilePanel } from "@/components/profile-panel";
import { COLLECTIONS, collectionProgress } from "@/lib/collections";
import { CollectionPicker } from "@/components/collection-picker";
import { EXPEDITIONS, type ExpeditionStatus } from "@/lib/expeditions";
import { resumeExpedition } from "@/lib/expedition-resume";
import { ExpeditionPicker } from "@/components/expedition-picker";
import { warmth, type Guess, type Mode, type Puzzle, type SavedGame } from "@/lib/game-types";

import { EMPTY_GAME, EMPTY_PROFILE, readLocal, writeLocal, restoreLegacyGame } from "@/lib/legacy-storage";
import { samePuzzleRef, type EvaluationResponse, type GameEffect } from "@/lib/game-contracts";
import { consumeGameFeedback, createGameFeedback, inputAfterAcceptedGuess, shouldAdmitGameFeedback } from "@/lib/game-feedback";
import { isProfileStorageKey, refreshLocalProfile, setLocalCosmetic, setLocalSound, type ProfileSnapshot } from "@/lib/profile-storage";
import { archiveDateStatus, LEGACY_ARCHIVE_START_DATE, latestArchiveDate, parisDate } from "@/lib/calendar";
import { COSMETICS, projectWeeklyRitual, type CosmeticId } from "@/lib/weekly-ritual";

import { admitTutorialReturnFocus, type TutorialReturnIntent } from "@/lib/tutorial-field";
import { canWriteGameDocument, writeAdmittedGame, recordAdmittedGameProgress } from "@/lib/game-write-admission";
import { failedPuzzleUrl, admittedPuzzleUrl, requestedGameSurface, surfaceUrl, retryPuzzleLoad, admitPuzzleLoad, type PuzzleLoad, type GameSurface } from "@/lib/game-navigation";
import { AppNavigation } from "@/components/app-navigation";
import { ArchiveCalendar } from "@/components/game-parts/archive-calendar";
import { PlayTutorial } from "@/components/game-parts/play-tutorial";
import { ResumeHub, WinSummary } from "@/components/game-parts/play-hub";
import { readLocalPlays, rememberPlayContext, resumeSuggestion, type LocalPlay, type PlayContext } from "@/lib/play-hub";
import { readEncountered, rememberEncountered } from "@/lib/free-discovery";
import { recordProductEvent, type ProductEventType, type ProductEventContext } from "@/lib/product-events";
import { formatScoreFr } from "@/lib/format-fr";
import "@/components/game-parts/game-parts.css";

type Modal = "tutorial" | "help" | "challenge" | "privacy" | "share" | null;
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
  const [surface, setSurface] = useState<GameSurface>("game");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [surface]);
  const [journey, setJourney] = useState<ExpeditionStatus | null>(null);
  const [journeyBusy, setJourneyBusy] = useState(false);
  const [journeyError, setJourneyError] = useState("");
  const journeyMemory = useRef(new Map<string, SavedGame>());
  const journeyController = useRef<AbortController | null>(null);
  const navigationEpoch = useRef(0);
  function navigate(destination: typeof surface, focus = true) {
    navigationEpoch.current++;
    journeyController.current?.abort();
    setJourneyBusy(false);
    if (surface === "game" && destination !== "game") diagnostic("gameLeft");
    setSurface(destination);
    setView(destination === "game" ? "play" : "explore");
    const url = surfaceUrl(new URL(window.location.href),destination);
    window.history.pushState(null, "", url);
    if (destination !== "game") refreshPlays();
    const focusEpoch=navigationEpoch.current;
    if(focus) requestAnimationFrame(() => {if(focusEpoch===navigationEpoch.current && modalRef.current===null) document.getElementById(destination === "game" ? "game-board" : "braise-main")?.focus({ preventScroll: true });});
  }
  const [localPlays, setLocalPlays] = useState<LocalPlay[]>([]);
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [discoveryExhausted, setDiscoveryExhausted] = useState(false);
  const discoveryPending = useRef(false);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [refusedWord, setRefusedWord] = useState("");
  const [collectionContext, setCollectionContext] = useState<string | undefined>();
  function refreshPlays() { try { setLocalPlays(readLocalPlays(localStorage)); } catch {} }
  function diagnostic(type: ProductEventType, context?: ProductEventContext) { try { recordProductEvent(localStorage, type, context ?? (journey ? "expedition" : collectionContext ? "collection" : mode)); } catch {} }
  function downloadRefusedWord() {
    if(!refusedWord) return;
    const blob = new Blob([JSON.stringify({format:"braiz-lexicon-feedback",version:1,word:refusedWord,reason:"absent-v1",createdAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), link=document.createElement("a");link.href=url;link.download="braiz-mot-refuse.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);diagnostic("refusedWordReported");
  }
  const [flamePaused, setFlamePaused] = useState(false);

  function toggleAnimations() { setFlamePaused(value => { writeLocal("animationsPaused", !value); return !value; }); }
  const [view, setView] = useState<"play" | "explore">("play");
  const viewRef = useRef<"play" | "explore">("play");
  const exploreHeadingRef = useRef<HTMLHeadingElement>(null);
  const gameBoardRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [game, setGame] = useState<SavedGame>(EMPTY_GAME);
  const [profileState, setProfileState] = useState<{snapshot: ProfileSnapshot | null; checkedAt: number}>({snapshot:null,checkedAt:0});
  const profileSnapshot = profileState.snapshot;
  function setProfileSnapshot(update: SetStateAction<ProfileSnapshot | null>) {
    // Snapshot actions can occur between clock ticks; admit their actual fresh instant.
    const checkedAt = new Date().getTime();
    setProfileState(current => ({snapshot:typeof update === "function" ? update(current.snapshot) : update,checkedAt}));
  }
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
  const modalReturnFocus = useRef<HTMLElement | null>(null);
  const tutorialReturnFocus = useRef<(TutorialReturnIntent & {owner:Element|null}) | null>(null);
  const requestRef = useRef(0);
  const submitting = useRef(false);
  const gameWriteAllowed = useRef(true);
  const inputRevisionRef = useRef(0);
  const consumedFeedbackRef = useRef(new Set<string>());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const modalRef = useRef<Modal>(null);
  const lastLoad = useRef<PuzzleLoad>({ mode: "daily", locator: "" });
  const routeRestorerRef=useRef<()=>void>(()=>{});
  const victoryRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { modalRef.current = modal; }, [modal]);

  useEffect(() => {
    const changed = viewRef.current !== view;
    viewRef.current = view;
    if (view === "explore") exploreHeadingRef.current?.focus({ preventScroll: true });
    else if (changed && modalRef.current === null && !tutorialReturnFocus.current) gameBoardRef.current?.focus({ preventScroll: true });
  }, [view]);

  const profile = profileSnapshot?.profile ?? EMPTY_PROFILE;
  const best = game.guesses.reduce<Guess | null>((winner, guess) => !winner || guess.temperature > winner.temperature ? guess : winner, null);
  const solved = Boolean(game.guesses.some(g => g.found));
  const temperature = best?.temperature ?? 0;
  const heat = warmth(temperature);
  const latest = game.guesses[game.guesses.length - 1];
  const ordered = [...game.guesses].sort((a, b) => sort === "heat" ? b.temperature - a.temperature || b.order - a.order : b.order - a.order);
  const today = now ? parisDate(new Date(now)) : "";
  // Freeze only the validation instant, not the facts: refresh for each profile/day change.
  // Reusing noon would incorrectly reject real facts recorded later that same day.
  const [ritualInput, setRitualInput] = useState({ snapshot: profileSnapshot, day: today, instant: now });
  if (ritualInput.snapshot !== profileSnapshot || ritualInput.day !== today) {
    setRitualInput({ snapshot: profileSnapshot, day: today, instant: Math.max(now, profileState.checkedAt) });
  }
  const ritual = useMemo(
    () => ritualInput.instant ? projectWeeklyRitual(ritualInput.snapshot?.activities ?? [], ritualInput.snapshot?.profile.wins ?? EMPTY_PROFILE.wins, new Date(ritualInput.instant)) : null,
    [ritualInput],
  );
  const currentCollection=COLLECTIONS.find(item=>item.id===collectionContext);
  const suggestedPlay=resumeSuggestion(localPlays.filter(play=>EXTRA_MODES_ENABLED || !play.context?.collection && !play.context?.expedition),puzzle?.id);
  const nextCollectionIndex=currentCollection ? collectionProgress(profile.wins,currentCollection).next : -1;
  const selectedCosmetic = ritual?.selectedCosmetic ?? "classic";
  const archiveMax = now ? latestArchiveDate(new Date(now)) : LEGACY_ARCHIVE_START_DATE;
  const tabMode = mode === "archive" ? "daily" : mode;
  const countdown = puzzle && now ? Math.max(0, new Date(puzzle.resetAt).getTime() - now) : 0;
  const countdownLabel = `${String(Math.floor(countdown / 3600000)).padStart(2, "0")}:${String(Math.floor(countdown / 60000) % 60).padStart(2, "0")}:${String(Math.floor(countdown / 1000) % 60).padStart(2, "0")}`;
  const isRecord = feedback?.type === "bestImproved" && feedback.puzzleRef.id === puzzle?.id;
  const isAccepted = feedback?.type === "guessAccepted" && feedback.puzzleRef.id === puzzle?.id;
  const isCelebratingWin = feedback?.type === "puzzleWon" && feedback.puzzleRef.id === puzzle?.id;
  const feedbackAnnouncement = isRecord && latest
    ? `Nouvelle meilleure piste : ${latest.word}, ${formatScoreFr(latest.temperature)} degrés.`
    : isAccepted && latest
      ? `Proposition acceptée : ${latest.word}, ${formatScoreFr(latest.temperature)} degrés.`
      : "";

  function clearDeferredUi() {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    feedbackTimerRef.current = null;
    focusFrameRef.current = null;
  }

  const deviceSyncRevisionRef=useRef<()=>string|null>(()=>null);
  const deviceSyncGameRef=useRef<()=>{id:string;game:SavedGame}|null>(()=>null);
  useLayoutEffect(()=>{deviceSyncGameRef.current=()=>puzzle?{id:puzzle.id,game}:null;});
  useLayoutEffect(()=>{deviceSyncRevisionRef.current=()=>deviceBoardRevision({busy:loading||busy||submitting.current||journeyBusy,request:requestRef.current,navigation:navigationEpoch.current,puzzle:puzzle?.id??null});});
  const deviceSyncGuard={currentGame:()=>deviceSyncGameRef.current(),revision:()=>deviceSyncRevisionRef.current(),admit:(expected:string|null)=>{
    return admitDeviceBoardMerge(expected,()=>deviceSyncRevisionRef.current(),()=>{requestRef.current++;clearDeferredUi();setFeedback(null);});
  }};
  const boardStorageRef=useRef<(key:string|null)=>void>(()=>{});
  useLayoutEffect(()=>{boardStorageRef.current=(key)=>{
    if (!puzzle || loading || key !== `braise.v1.game.${puzzle.id}`) return;
    if (!canWriteGameDocument(undefined,puzzle.id)) { gameWriteAllowed.current=false; setStorageWarning(true); return; }
    requestRef.current++; submitting.current=false; setBusy(false); clearDeferredUi(); setFeedback(null);
    setGame(restoreLegacyGame(puzzle.id)); refreshPlays();
  };});

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

  async function loadPuzzle(nextMode: Mode, locator = "", sessionSave?: SavedGame, expedition?: ExpeditionStatus, collection?: string, destination?: GameSurface) {
    if (puzzle) journeyMemory.current.set(puzzle.id, game);
    const request = ++requestRef.current;
    setJourney(expedition ?? null);
    collection=COLLECTIONS.find(item=>item.id===collection && item.seeds.includes(locator))?.id;
    setCollectionContext(collection);
    setRefusedWord("");
    setDiscoveryNote("");setDiscoveryExhausted(false);
    const descriptor: PuzzleLoad={mode:nextMode,locator,sessionSave,expedition,collection,destination};
    lastLoad.current = descriptor;
    const loadEpoch=navigationEpoch.current;
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
      const admitted=await admitPuzzleLoad(descriptor, async()=>{
        const response=await fetch(`/api/game?${query}`,{cache:"no-store"});
        const data=await response.json() as Puzzle & {error?:string;targetIdentity?:string};
        return {response,data};
      },{started:{request,navigation:loadEpoch},current:()=>({request:requestRef.current,navigation:navigationEpoch.current})},({response,data},admittedDescriptor)=>{
      if (!response.ok) { setLoadRetryable(response.status >= 500); throw new Error(data.error || "Le jeu ne répond pas. Réessayez dans un instant."); }
      gameWriteAllowed.current=false;
      try { gameWriteAllowed.current=canWriteGameDocument(undefined,data.id); } catch {}
      if(!gameWriteAllowed.current) setStorageWarning(true);
      const restored = sessionSave ?? restoreLegacyGame(data.id);
      setGame(restored);
      setMode(nextMode); setPuzzle(data);
      try {
        if(data.targetIdentity && !rememberEncountered(localStorage,[data.targetIdentity])) setStorageWarning(true);
        const context: PlayContext = {mode:nextMode,...(expedition ? {expedition:expedition.id,expeditionStep:expedition.completed+1} : {}),...(collection ? {collection} : {})};
        if(!rememberPlayContext(localStorage,data.id,context)) setStorageWarning(true);
      } catch { setStorageWarning(true); }
      refreshPlays();
      setArchiveOpen(nextMode === "archive");
      setArchiveError("");
      setArchiveStatus(nextMode === "archive" ? `Archive du ${new Date(`${data.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} chargée.` : "");
      if (gameWriteAllowed.current && restored.profileV2StartIndex !== undefined) {
        const reconciled = recordAdmittedGameProgress(data, restored, undefined, profileSnapshot ?? undefined);
        if(reconciled) setProfileSnapshot(reconciled);
        if (!reconciled?.persisted) setStorageWarning(true);
      }
      const url=admittedPuzzleUrl(new URL(window.location.href),admittedDescriptor,data);
      window.history.replaceState(null,"",url);
      if(admittedDescriptor.destination) {setSurface(admittedDescriptor.destination);setView(admittedDescriptor.destination === "game" ? "play" : "explore");}
      if (nextMode === "free") writeLocal("freeSeed", data.seed);
      },(cause,failedDescriptor)=>{
        setLoadError(cause instanceof Error ? cause.message : "Connexion impossible.");setArchiveStatus("");
        // A current failure owns the same destination as a success, so its retry is visible.
        if(failedDescriptor.destination) {
          window.history.replaceState(null,"",failedPuzzleUrl(new URL(window.location.href),failedDescriptor));
          setSurface(failedDescriptor.destination);setView(failedDescriptor.destination === "game" ? "play" : "explore");
        }
      });
      if(admitted===null && request===requestRef.current) setLoadError("Le chargement a été interrompu. Réessayez pour reprendre cette partie.");
      return admitted!==null && admitted!==false;
    } catch (err) {
      if (request === requestRef.current && loadEpoch===navigationEpoch.current) { setLoadError(err instanceof Error ? err.message : "Connexion impossible."); setArchiveStatus(""); }
      return false;
    } finally { if (request === requestRef.current) setLoading(false); }
  }

  async function openJourney(id: string, action?: "gameResumed" | "nextActivityOpened", destination: GameSurface="game") {
    journeyController.current?.abort();
    if (puzzle) journeyMemory.current.set(puzzle.id, game);
    const controller = new AbortController();
    journeyController.current = controller;
    const epoch = ++navigationEpoch.current;
    const generation = requestRef.current;
    const current = () => !controller.signal.aborted && epoch === navigationEpoch.current && generation === requestRef.current;
    setJourneyBusy(true); setJourneyError(""); setLoading(false);
    try {
      const result = await resumeExpedition(id, {
        status: async (id, proofs) => {
          const response = await fetch("/api/expeditions", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, proofs }) });
          const data = await response.json() as ExpeditionStatus & { error?: string };
          if (!response.ok) throw new Error(data.error || "Connexion impossible.");
          return data;
        },
        readGame: id => puzzle?.id === id ? game : journeyMemory.current.get(id) ?? restoreLegacyGame(id),
        isCurrent: current,
      });
      if (!result || !current()) return;
      setJourney(result.status);
      if (result.status.seed) {
        if(await loadPuzzle("challenge", result.status.seed, result.saved, result.status,undefined,destination) && action) diagnostic(action,"expedition");
      } else {
        const completedDestination=destination === "game" ? "voyage" : destination;
        const url = surfaceUrl(new URL(window.location.href),completedDestination);
        url.searchParams.set("voyage", id); url.searchParams.delete("defi"); url.searchParams.delete("archive"); url.searchParams.delete("libre"); url.searchParams.delete("collection");
        window.history.replaceState(null, "", url);
        setSurface(completedDestination); setView("explore");
      }
    } catch (cause) {
      if (current()) { setJourneyError(cause instanceof Error ? cause.message : "Connexion impossible."); const failedDestination=destination === "game" ? "voyage" : destination;setSurface(failedDestination);setView("explore");window.history.replaceState(null,"",surfaceUrl(new URL(location.href),failedDestination)); }
    } finally { if (epoch === navigationEpoch.current) setJourneyBusy(false); }
  }

  async function discover(replay = false) {
    if (busy || discoveryPending.current) return;
    discoveryPending.current=true;
    const generation = requestRef.current, epoch = navigationEpoch.current;
    setDiscoveryBusy(true); setDiscoveryNote("");
    try {
      const excluded = readEncountered(localStorage);
      if (!excluded) throw new Error("L’historique de découverte est illisible et a été conservé. Vous pouvez reprendre une partie existante.");
      const encountered: string[] = [];
      for(let i=0;i<localStorage.length;i++) { const key=localStorage.key(i); if(key?.startsWith("braise.v1.game.")) encountered.push(key.slice("braise.v1.game.".length)); }
      if(encountered.length > 3000) throw new Error("L’historique dépasse la limite de découverte. Reprenez une partie existante.");
      const response = await fetch("/api/game", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"discover",excluded,encountered,replay}) });
      const data = await response.json() as {error?:string;encountered:string[];exhausted:boolean;puzzle:(Puzzle & {targetIdentity:string}) | null};
      if(generation !== requestRef.current || epoch !== navigationEpoch.current) return;
      if(!response.ok) throw new Error(data.error || "Découverte indisponible.");
      if(!rememberEncountered(localStorage,data.encountered)) setStorageWarning(true);
      setDiscoveryExhausted(data.exhausted);
      if(!data.puzzle) { setDiscoveryNote("Vous avez rencontré les 120 cibles V1 sur cet appareil. Vous pouvez les rejouer ; aucune nouvelle cible n’est annoncée."); return; }
      navigate("game");
      const loaded=await loadPuzzle("free",data.puzzle.seed);
      if(loaded) { setDiscoveryExhausted(data.exhausted);setDiscoveryNote(replay ? "Rejeu choisi dans les 120 cibles V1. Les anciennes parties restent accessibles dans Explorer." : "Cible non rencontrée selon l’historique disponible sur cet appareil. Les parties commencées restent dans Explorer."); diagnostic("nextActivityOpened","free"); }
    } catch(cause) { if(generation === requestRef.current && epoch === navigationEpoch.current) setDiscoveryNote(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { discoveryPending.current=false;setDiscoveryBusy(false); }
  }
  async function resumePlay(play: LocalPlay) {
    navigate("game");
    if(puzzle?.id===play.id && mode===play.mode && !play.context?.expedition) {diagnostic("gameResumed",play.context?.collection ? "collection" : play.mode);return;}
    if(play.context?.expedition && EXTRA_MODES_ENABLED) { await openJourney(play.context.expedition,"gameResumed"); return; }
    const loaded=await loadPuzzle(play.mode,play.mode === "daily" ? "" : play.locator,undefined,undefined,play.context?.collection);
    if(loaded) diagnostic("gameResumed",play.context?.collection ? "collection" : play.mode);
  }
  async function nextActivity() {
    if(journey) { await openJourney(journey.id,"nextActivityOpened"); return; }
    if(currentCollection) {
      if(nextCollectionIndex >= 0) { if(await loadPuzzle("challenge",currentCollection.seeds[nextCollectionIndex],undefined,undefined,currentCollection.id)) diagnostic("nextActivityOpened","collection"); }
      else navigate("modes");
      return;
    }
    if(suggestedPlay) await resumePlay(suggestedPlay); else await discover();
  }
  function enterGame() {
    navigate("game"); setView("play");
    if (!loading && (!puzzle || journey?.reward)) void loadPuzzle("daily");
  }
  function closeHelpAndFocusGame() {
    modalReturnFocus.current = null;
    enterGame();
    setModal(null);
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    const request = requestRef.current;
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (request === requestRef.current && modalRef.current === null && viewRef.current === "play") inputRef.current?.focus({ preventScroll: true });
    });
  }

  useLayoutEffect(() => { routeRestorerRef.current=()=>{
    const params=new URLSearchParams(location.search), destination=requestedGameSurface(new URL(location.href));
    navigationEpoch.current++;journeyController.current?.abort();setJourneyBusy(false);
    setSurface(destination === "voyage" && !EXTRA_MODES_ENABLED ? "modes" : destination);setView(destination === "game" ? "play" : "explore");refreshPlays();
    const archive=params.get("archive"), challenge=params.get("defi"), free=params.get("libre"), voyage=params.get("voyage");
    if(EXTRA_MODES_ENABLED && voyage && EXPEDITIONS.some(item=>item.id===voyage)) { if(journey?.id!==voyage || !puzzle || puzzle.seed!==journey.seed) void openJourney(voyage,undefined,destination); }
    else if(archive!==null) { if(puzzle?.id!==`daily-${archive}` || mode!=="archive") void loadPuzzle("archive",archive); }
    else if(challenge && /^\d{1,10}$/.test(challenge)) { if(puzzle?.id!==`free-${challenge}` || mode!=="challenge") void loadPuzzle("challenge",challenge,undefined,undefined,EXTRA_MODES_ENABLED ? params.get("collection") ?? undefined : undefined); }
    else if(free && /^\d{1,10}$/.test(free)) { if(puzzle?.id!==`free-${free}` || mode!=="free") void loadPuzzle("free",free); }
    else if(mode!=="daily") void loadPuzzle("daily");
  }; });

  // Effect events read the latest board/profile without restarting mount subscriptions.
  const initializeBrowser = useEffectEvent(() => {
    setProfileSnapshot(current => refreshLocalProfile(current ?? undefined));
    setFlamePaused(readLocal<boolean>("animationsPaused", false));
    setArchiveDraft(latestArchiveDate());
    const params = new URLSearchParams(window.location.search);
    const archive = params.get("archive"), challenge = params.get("defi"), free = params.get("libre"), voyage = params.get("voyage");
    const requestedSurface = requestedGameSurface(new URL(window.location.href));
    if (EXTRA_MODES_ENABLED && voyage && EXPEDITIONS.some(item => item.id === voyage)) { setSurface(requestedSurface); setView(requestedSurface === "game" ? "play" : "explore"); void openJourney(voyage, undefined, requestedSurface); }
    else if (archive !== null) void loadPuzzle("archive", archive);
    else if (!voyage && challenge && /^\d{1,10}$/.test(challenge)) void loadPuzzle("challenge", challenge, undefined, undefined, EXTRA_MODES_ENABLED ? params.get("collection") ?? undefined : undefined);
    else if (free && /^\d{1,10}$/.test(free)) void loadPuzzle("free", free);
    else void loadPuzzle("daily");
    if (requestedSurface !== "game") { setSurface(requestedSurface === "voyage" && !EXTRA_MODES_ENABLED ? "modes" : requestedSurface); setView("explore"); }
    refreshPlays();
    setNow(Date.now());
  });
  const checkDailyReset = useEffectEvent(() => {
    if (mode === "daily" && puzzle && now >= Date.parse(puzzle.resetAt) && !loading && !busy && !loadError) {
      toast("Le nouveau mot du jour est arrivé !");
      void loadPuzzle("daily");
    }
  });
  useEffect(() => {
    // Defer the external browser snapshot so Strict Mode can cancel its abandoned mount.
    let active = true;
    queueMicrotask(() => { if (active) initializeBrowser(); });
    const refreshProfile = (preservePending = true) => setProfileSnapshot(current => refreshLocalProfile(preservePending ? current ?? undefined : undefined));
    const onStorage = (event: StorageEvent) => { if (isProfileStorageKey(event.key)) refreshProfile(event.key !== null); boardStorageRef.current(event.key); };
    const onVisibility = () => { if (document.visibilityState === "visible") refreshProfile(); };
    const onPopState = () => routeRestorerRef.current();
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("popstate", onPopState);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Capture ref containers, not their changing epoch values; cleanup invalidates live work.
    const journeyAbort = journeyController, navigation = navigationEpoch, request = requestRef;
    return () => {
      active = false;
      journeyAbort.current?.abort();
      navigation.current++;
      request.current++;
      submitting.current = false;
      clearInterval(tick);
      clearDeferredUi();
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) checkDailyReset(); });
    return () => { active = false; };
  }, [now, puzzle, mode, loading, busy, loadError]);

  // Device imports change durable saves; refresh the already selected board silently.
  // No navigation, input reset, focus, progress projection or gameplay effect is emitted.
  function receiveDeviceSync(snapshot: ProfileSnapshot) {
    setProfileSnapshot(snapshot);
    if (puzzle && canWriteGameDocument(undefined, puzzle.id)) setGame(restoreLegacyGame(puzzle.id));
    refreshPlays();
  }
  function saveGame(next: SavedGame) {
    setGame(next);
    if (puzzle && (!gameWriteAllowed.current || !writeAdmittedGame(undefined,puzzle.id,next))) setStorageWarning(true);
    refreshPlays();
  }
  function saveSound(value: boolean) {
    const next = setLocalSound(value, new Date().toISOString(), clientId(), undefined, profileSnapshot ?? undefined);
    setProfileSnapshot(next);
    if (!next.persisted) setStorageWarning(true);
  }
  function selectCosmetic(value: CosmeticId) {
    if (!ritual?.unlockedCosmetics.includes(value)) return;
    const next = setLocalCosmetic(value, new Date().toISOString(), clientId(), undefined, profileSnapshot ?? undefined);
    setProfileSnapshot(next);
    if (!next.persisted) setStorageWarning(true);
    toast.success(`${COSMETICS.find(cosmetic => cosmetic.id === value)?.name ?? "Style"} équipé.`);
  }
  async function changeMode(value: string) {
    if (busy) return;
    if (value === "challenge") { setModal("challenge"); return; }
    const url = new URL(window.location.href); url.searchParams.delete("defi"); window.history.replaceState(null, "", url);
    if(value === "free") {
      const seed=readLocal<unknown>("freeSeed", "");
      if(typeof seed === "string" && /^\d{1,10}$/.test(seed) && Number(seed)<=2147483647) { if(await loadPuzzle("free",seed)) diagnostic("gameResumed","free"); }
      else await discover();
    } else if(await loadPuzzle(value as Mode)) diagnostic("gameOpened",value as Mode);
  }
  function revealArchives() {
    const latest = latestArchiveDate(now ? new Date(now) : new Date());
    setArchiveDraft(current => current || latest);
    setArchiveError("");
    setArchiveOpen(true);
  }
  async function openArchive(event: FormEvent) {
    event.preventDefault();
    const message = archiveDateError(archiveDraft, now ? new Date(now) : new Date());
    setArchiveError(message);
    if (message || busy) return;
    if(await loadPuzzle("archive", archiveDraft)) diagnostic("gameOpened","archive");
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
    submitting.current = true; setBusy(true); setError(""); setRefusedWord("");
    const request = requestRef.current;
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, seed: puzzle.seed, date: mode === "archive" ? puzzle.date : undefined, puzzleId: puzzle.id, puzzleRef: puzzle.ref, word, action: isHint ? "hint" : "guess", hintLevel: game.hints, guesses: isHint ? game.guesses.map(g => g.word) : undefined }) });
      const data = await response.json() as EvaluationResponse & { error?: string };
      if (request !== requestRef.current) return;
      if (!response.ok) {
        if(response.status === 422) { if(inputRevisionRef.current === submittedRevision) setRefusedWord(word);diagnostic("guessRejected"); }
        else if(response.status >= 500) diagnostic("networkFailed");
        throw new Error(data.error || "Impossible d’analyser ce mot.");
      }
      if (!samePuzzleRef(data.puzzleRef, puzzle.ref)) throw new Error("La réponse ne correspond pas à cette partie. Rechargez le jeu.");
      if (game.guesses.some(g => g.word === data.word)) { setError(`« ${data.word} » est déjà dans vos essais.`); return; }
      const acceptedAt = new Date().toISOString();
      const guess: Guess = { word: data.word, temperature: data.temperature, rank: data.rank, found: data.found, order: game.guesses.length + 1, hint: isHint, acceptedAt };
      const next = { ...game, guesses: [...game.guesses, guess], hints: game.hints + (isHint ? 1 : 0), profileV2StartIndex: game.profileV2StartIndex ?? game.guesses.length, ...(data.found ? { solvedAt: Date.parse(acceptedAt), completedMode: mode } : {}) };
      setInput(current => inputAfterAcceptedGuess(current, isHint, inputRevisionRef.current, submittedRevision));
      const nextFeedback = createGameFeedback(best?.temperature ?? null, guess, puzzle.ref);
      showFeedback(nextFeedback);
      // Future game documents must not project their unknown facts into profile/rewards either.
      if(gameWriteAllowed.current && canWriteGameDocument(undefined,puzzle.id)) {
        const progressed = recordAdmittedGameProgress(puzzle, next, undefined, profileSnapshot ?? undefined);
        if(progressed) setProfileSnapshot(progressed);
        if (!progressed?.persisted) setStorageWarning(true);
      }
      saveGame(next);
      diagnostic(isHint ? "hintUsed" : "guessAccepted");
      if(!isHint && game.guesses.length === 0) diagnostic("firstGuessAccepted");
      if(data.found) diagnostic("puzzleWon");
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
    } catch (err) { if (request === requestRef.current) { if(err instanceof TypeError) diagnostic("networkFailed"); if(inputRevisionRef.current === submittedRevision) setError(err instanceof Error ? err.message : "Connexion impossible. Votre saisie est conservée."); } }
    finally { if (request === requestRef.current) { submitting.current = false; setBusy(false); } }
  }

  function pin(word: string) {
    if (!game.pins.includes(word) && game.pins.length >= 3) { toast("Votre carnet accueille 3 pistes. Détachez-en une pour continuer."); return; }
    saveGame({ ...game, pins: game.pins.includes(word) ? game.pins.filter(w => w !== word) : [...game.pins, word] });
  }
  async function copy(text: string, feedback: string) {
    try { await navigator.clipboard.writeText(text); diagnostic("shareCopied"); toast.success(feedback); }
    catch { setShareText(text); setModal("share"); }
  }
  function resultText() {
    const journey = game.guesses.filter(g => !g.hint).filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 8)) === 0).slice(0, 8).map(g => g.found ? "🟩" : g.temperature >= 55 ? "🟥" : g.temperature >= 35 ? "🟧" : g.temperature >= 18 ? "🟨" : "🟦").join("");
    const url = new URL(window.location.origin);
    url.searchParams.delete("defi"); url.searchParams.delete("archive");
    if (mode === "archive" && puzzle) url.searchParams.set("archive", puzzle.date);
    else if (mode !== "daily") url.searchParams.set("defi", puzzle?.seed || "0");
    return `🔥 BRAIZ ${mode === "daily" ? `du ${puzzle?.date}` : mode === "archive" ? `· Archive du ${puzzle?.date}` : "· Défi"}\n${solved ? "Trouvé" : "En piste"} en ${game.guesses.length} essai${game.guesses.length === 1 ? "" : "s"} · ${game.hints ? `${game.hints} indice${game.hints === 1 ? "" : "s"}` : "sans indice"}\n${journey}${solved && !journey.endsWith("🟩") ? "🟩" : ""}\nVotre tour ! ${url.toString()}`;
  }
  async function shareResult() {
    const text = resultText();
    if (navigator.share) { try { await navigator.share({ title: "BRAIZ", text }); return; } catch (err) { if (err instanceof Error && err.name === "AbortError") return; } }
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

  return <div className={`app-shell focused-interface foyer-interface reference-interface approved-interface ${flamePaused ? "motion-paused" : ""} cosmetic-${selectedCosmetic}`}>
    <Toaster position="bottom-center" theme="dark" />
    <a className="skip-link" href="#braise-main">Aller au contenu</a>
    <AppNavigation active={surface === "profile" ? "profile" : surface === "modes" || surface === "voyage" ? "explore" : "play"} onNavigate={destination => navigate(destination === "play" ? "game" : destination === "explore" ? "modes" : "profile")} />
    <header className="site-header reference-header">
      <button aria-label="Accueil" className="brand" onClick={() => navigate("game")}>BRAIZ</button>
      <div className="reference-header-actions"><button className="icon-button" aria-label="Comment jouer" onClick={event => { modalReturnFocus.current = event.currentTarget; setModal("help"); diagnostic("helpOpened"); }}><CircleHelp size={23}/></button><DropdownMenu>
        <DropdownMenuTrigger asChild><button className="icon-button" aria-label="Ouvrir le menu"><Menu size={23}/></button></DropdownMenuTrigger>
        <DropdownMenuContent className="braise-navigation" align="end" sideOffset={10}>
          <DropdownMenuLabel>Changer de partie</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={busy || loading} onSelect={() => { navigate("game"); setView("play"); void changeMode("daily"); }}><span>Mot du jour<small>Le même mot pour tous, jusqu’à minuit.</small></span></DropdownMenuItem>
            <DropdownMenuItem disabled={busy || loading} onSelect={() => { navigate("game"); setView("play"); void changeMode("free"); }}>Partie libre</DropdownMenuItem>
            <DropdownMenuItem disabled={busy || loading} onSelect={() => { navigate("game"); setView("play"); revealArchives(); }}>Archives</DropdownMenuItem>
            {EXTRA_MODES_ENABLED && <DropdownMenuItem onSelect={() => navigate("modes")}>Autres modes</DropdownMenuItem>}
          </DropdownMenuGroup>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={() => navigate("profile")}>Profil</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { navigate(surface); setModal("help"); }}>Comment jouer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu></div>
    </header>

    <main id="braise-main" tabIndex={-1} className={`main-shell surface-${surface}`}>
      {surface === "modes" && <section aria-label="Explorer"><ResumeHub plays={localPlays} currentId={puzzle?.id} onResume={play=>void resumePlay(play)} onDiscover={()=>void discover()} /><div className="play-hub"><a className="secondary-button" href="/entrainement">Entraînement guidé · 3 parcours et pack hors ligne</a><button className="secondary-button" onClick={()=>{ navigate("game");revealArchives(); }}>Explorer les archives</button><button className="secondary-button" onClick={event=>{modalReturnFocus.current=event.currentTarget;setModal("tutorial");diagnostic("helpOpened");}}>Essayer le tutoriel</button>{discoveryNote && <p role="status">{discoveryNote}</p>}{discoveryExhausted && <button className="secondary-button" onClick={()=>void discover(true)}>Rejouer une cible</button>}</div></section>}
      {EXTRA_MODES_ENABLED && surface === "modes" && <section className="reference-modes" aria-label="Autres modes"><button className="reference-mode selected" onClick={() => {setView("play");navigate("game");void changeMode("daily");}}><span><strong>Le mot du jour</strong><small>Un mot à découvrir chaque jour</small></span></button><button className="reference-mode" onClick={() => {setView("explore");navigate("voyage");}}><span><strong>Voyage</strong><small>Des chapitres à votre rythme</small></span></button><a className="reference-mode" href="/duels"><span><strong>Entre amis</strong><small>Un défi, chacun son tour</small></span></a></section>}
      {EXTRA_MODES_ENABLED && surface === "modes" && <nav className="play-hub" aria-label="Parcours avancés"><a className="secondary-button" href="/espace">Mes parties en ligne</a><a className="secondary-button" href="/cercles">Mes cercles</a><a className="secondary-button" href="/studio">Studio · créer et partager</a><a className="secondary-button" href="/laboratoire">Laboratoire · L’intrus et Deux braises</a><a className="secondary-button" href="/integration">Intégration du jeu</a></nav>}
      {surface === "profile" && (profileSnapshot && now ? <ProfilePanel snapshot={profileSnapshot} ritual={ritual} now={new Date(now).toISOString()} busy={busy || loading} flamePaused={flamePaused} onSound={saveSound} onAnimations={toggleAnimations} onCosmetic={selectCosmetic} onSnapshot={setProfileSnapshot} onDeviceSync={receiveDeviceSync} deviceSyncGuard={deviceSyncGuard} onBack={() => navigate("game")} /> : <section className="reference-profile"><h1>Votre progression</h1><p role="status">Chargement du profil…</p></section>)}

      <div hidden={surface !== "game"} className={`play-view ${journey ? "voyage-play" : ""}`}>
      {currentCollection && <div className="voyage-game-heading"><button className="text-action" onClick={()=>navigate("voyage")}>Collections</button><h1>{currentCollection.title}</h1><p>Énigme {currentCollection.seeds.indexOf(puzzle?.seed ?? "")+1} sur {currentCollection.seeds.length}</p></div>}
      {journey && !journey.reward && <div className="voyage-game-heading"><button className="text-action" onClick={() => { navigate("voyage"); setView("explore"); }}>Voyage</button><h1>{EXPEDITIONS.find(item => item.id === journey.id)?.title}</h1><p>Épreuve {journey.completed + 1} sur {journey.length}</p><progress value={journey.completed + (solved ? 1 : 0)} max={journey.length} aria-label="Progression du chapitre"/></div>}
      <Tabs value={tabMode} onValueChange={changeMode} className="mode-tabs"><TabsList aria-label="Mode de jeu" className="mode-list"><TabsTrigger value="daily" disabled={busy}><Flame />Quotidien</TabsTrigger><TabsTrigger value="free" disabled={busy}><InfinityIcon />Libre</TabsTrigger>{EXTRA_MODES_ENABLED && <TabsTrigger value="challenge" disabled={busy}><Users />Entre amis</TabsTrigger>}</TabsList>

      <TabsContent value={tabMode} className="game-tab-content">
      <section className={`archive-access ${archiveOpen || mode === "archive" ? "is-open" : ""}`} aria-label="Archives des mots quotidiens">
        {!archiveOpen && mode !== "archive" ? <button className="archive-reveal" type="button" onClick={revealArchives} disabled={busy}><CalendarDays size={18} /><span><strong>Archives</strong><small>Rejouer un ancien mot</small></span></button> : <form className="archive-form" onSubmit={openArchive}>
          <label htmlFor="archive-date">Date du mot</label>
          <input id="archive-date" type="date" min={LEGACY_ARCHIVE_START_DATE} max={archiveMax} value={archiveDraft} onChange={event => { setArchiveDraft(event.target.value); setArchiveError(""); }} aria-invalid={Boolean(archiveError)} aria-describedby={archiveError ? "archive-error" : undefined} disabled={busy || loading} />
          <button className="secondary-button" type="submit" disabled={busy || loading}>Ouvrir</button>
          {mode === "archive" ? <button className="archive-today" type="button" onClick={() => loadPuzzle("daily")} disabled={busy || loading}>Revenir au mot du jour</button> : <button className="archive-close" type="button" aria-label="Fermer les archives" onClick={() => { setArchiveOpen(false); setArchiveError(""); }}><X size={18} /></button>}
          {archiveError && <p id="archive-error" className="archive-error">{archiveError}</p>}
          {mode === "archive" && <p className="archive-rule">Une archive enrichit votre progression, sans prolonger votre série quotidienne.</p>}
        </form>}
        {archiveOpen && <ArchiveCalendar max={archiveMax} selected={archiveDraft} plays={localPlays} disabled={busy || loading} onOpen={date=>{setArchiveDraft(date);void loadPuzzle("archive",date).then(loaded=>{if(loaded) diagnostic("gameOpened","archive");});}} />}
        <span className="archive-status" role="status" aria-live="polite" aria-atomic="true">{archiveStatus}</span>
      </section>
      <div className="play-layout">
        <div className="play-column">
          <section id="game-board" ref={gameBoardRef} tabIndex={-1} className={`game-panel ${isAccepted ? "is-accepted" : ""} ${isRecord ? "is-record" : ""} ${solved ? "is-won" : ""} ${isCelebratingWin ? "is-celebrating" : ""}`} aria-label="Plateau de jeu">
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{feedbackAnnouncement}</p>
            <div className="game-topline"><div><span className="game-kicker">{mode === "daily" ? "LE MOT DU JOUR" : mode === "archive" ? "ARCHIVE" : mode === "free" ? "À VOTRE RYTHME" : "LE DÉFI EST LANCÉ"}</span><span className="edition">{puzzle ? `N° ${String(puzzle.number).padStart(3, "0")}` : "…"}</span></div><span className="daily-pill">{mode === "daily" || mode === "archive" ? <><Clock3 size={13} />{puzzle ? new Date(`${puzzle.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(mode === "archive" ? { year: "numeric" as const } : {}), timeZone: "UTC" }) : mode === "archive" ? "Archive" : "Aujourd’hui"}</> : <><InfinityIcon size={15} />{mode === "challenge" ? "Même mot, même défi" : "Sans limite de temps"}</>}</span></div>
<h1 className="approved-game-title">{mode === "daily" ? "Devinez le mot secret du jour." : mode === "archive" ? "Retrouvez le mot de cette archive." : "Devinez le mot secret."}</h1>
{surface === "game" && <FlameScene temperature={temperature} celebrating={isCelebratingWin} paused={flamePaused} solved={solved} revealMotion={isAccepted || isRecord || isCelebratingWin} />}
            <div className={`foyer-reading ${best ? "" : "no-guess"}`} aria-live="polite">{best && <><strong>{formatScoreFr(temperature)}°</strong><span>Meilleure piste : {best.word} · {heat.label}</span></>}</div>
            <button className="foyer-motion" type="button" aria-pressed={flamePaused} onClick={toggleAnimations}>{flamePaused ? "Animer la flamme" : "Mettre la flamme en pause"}</button>
<div className="approved-play-surface">{loadError ? <div className="load-error" role="alert"><CircleHelp size={34} /><h2>{mode === "archive" ? "Archive indisponible." : "Une petite pause imprévue."}</h2><p>{loadError}</p>{loadRetryable && <button className="primary-button" onClick={() => retryPuzzleLoad(lastLoad.current,loadPuzzle,"game")}>Réessayer</button>}{mode === "archive" && <button className="text-action" onClick={() => loadPuzzle("daily")}>Revenir au mot du jour</button>}</div> : <>
              {mode === "free" && <p className="free-discovery-note">Libre · 120 cibles V1. Vos parties commencées restent dans Explorer. Les anciens liens conservent leur mot.</p>}
              {discoveryNote && <p className="free-discovery-note" role="status">{discoveryNote}</p>}
              {discoveryExhausted && <button className="secondary-button" disabled={discoveryBusy} onClick={()=>void discover(true)}>Rejouer une cible</button>}
              {solved ? <div className="victory-box"><span className="victory-eyebrow">Bien joué.</span><h2 ref={victoryRef} tabIndex={-1} aria-label={`Bravo, le mot était ${best?.word}`}>{best?.word}</h2><p>{game.guesses.length} essai{game.guesses.length === 1 ? "" : "s"}, {game.hints ? `${game.hints} indice${game.hints > 1 ? "s" : ""}` : "aucun indice"}. Vous avez trouvé votre chemin.</p><details onToggle={event=>{if(event.currentTarget.open) diagnostic("summaryOpened");}}><summary>Voir le bilan de mon chemin</summary><WinSummary game={game}/></details>{!journey && !currentCollection && suggestedPlay && <p>Cette partie commencée attend votre prochain mot.</p>}<div className="victory-actions"><button className="primary-button" onClick={shareResult}><Share2 size={17} />Partager ma réussite</button><button className="secondary-button" onClick={() => void copy(resultText(), "Résultat copié, sans révéler le mot.")}>Copier mon résultat</button><button className="secondary-button" disabled={journeyBusy || discoveryBusy} onClick={()=>void nextActivity()}>{journeyBusy ? "Chargement…" : journey ? journey.completed + 1 < journey.length ? "Épreuve suivante" : "Terminer le chapitre" : discoveryBusy ? "Recherche…" : "Continuer à jouer"}</button></div>{isCelebratingWin && <span className="xp-award"><Sparkles size={14} />Mot trouvé</span>}</div> : <div className="guess-area"><p className="game-guidance">Le sens compte, pas les lettres. Plus la température monte, plus le sens est proche. <button className="text-action" type="button" onClick={event=>{modalReturnFocus.current=event.currentTarget;setModal("tutorial");diagnostic("helpOpened");}}>Essayer en 3 étapes</button></p><form onSubmit={submit} className="guess-form" aria-busy={busy}><label className="sr-only" htmlFor="guess">Votre proposition</label><input id="guess" ref={inputRef} value={input} onChange={e => { inputRevisionRef.current += 1; setInput(e.target.value); setError(""); setRefusedWord(""); }} placeholder="Proposez un mot" lang="fr" autoComplete="off" autoCorrect="on" autoCapitalize="none" spellCheck={true} enterKeyHint="send" maxLength={50} aria-describedby="guess-feedback proximity-rule" aria-invalid={Boolean(error)} disabled={loading} /><button type="submit" className="guess-button" aria-label={busy ? "Analyse en cours" : "Proposer ce mot"} disabled={!puzzle || loading || busy || journeyBusy || !input.trim()}>{busy ? <>Analyse…</> : "Proposer"}</button></form><div className={`input-feedback ${error ? "error" : ""}`} id="guess-feedback" aria-live="polite">{error || (loading ? "Chargement du mot…" : latest ? <span><span style={{ color: warmth(latest.temperature).color }}>Dernier essai : {latest.word} : {formatScoreFr(latest.temperature)}°</span><span> {warmth(latest.temperature).label.toLowerCase()}.</span></span> : null)}</div></div>}
              {refusedWord && <div className="refused-word-report"><p>Ce refus concerne le lexique V1. Votre mot reste dans le champ. Vous pouvez télécharger volontairement une fiche contenant « {refusedWord} » pour une revue ultérieure ; aucun envoi automatique.</p><button className="secondary-button" onClick={downloadRefusedWord}>Télécharger le signalement</button></div>}
              <p id="proximity-rule" className="game-guidance">La température mesure une proximité, pas une probabilité. Le rang 1 est le meilleur sur {puzzle?.vocabularySize.toLocaleString("fr-FR") ?? "le dictionnaire"} mots.</p>
              {best && <div className={`heat-summary ${isRecord ? "heat-record" : ""}`} style={{ "--heat-color": heat.color } as CSSProperties}>
                <div><span>Meilleure piste</span><strong>{best.word}</strong></div>
                <div className="heat-reading"><strong>{formatScoreFr(temperature)}°</strong><span>{heat.label}</span></div>
                <div className="heat-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, temperature))}%` }} /></div>
                {isRecord && <span className="compact-record">Nouvelle meilleure piste</span>}
              </div>}
              <div className="game-bottom"><span><Target size={16} /><b>{game.guesses.length}</b> essai{game.guesses.length > 1 ? "s" : ""}</span><span className="rank-info">{best ? <><Flame size={16} /><b>{best.rank <= 1000 ? `#${best.rank}` : "Hors top 1 000"}</b><span className="rank-suffix">{best.rank <= 1000 ? "en proximité" : ""}</span></> : <><Sparkles size={16} />Tous les chemins sont ouverts</>}</span><button className="hint-button" onClick={() => submit(undefined, true)} disabled={loading || busy || solved || game.hints >= 3 || game.guesses.length < 5} title={solved ? "Cette partie est terminée" : game.guesses.length < 5 ? "Votre premier indice se débloque après 5 essais" : "Ajouter une piste proche du mot secret"}><Lightbulb size={16} /><span>Indice</span><span className="hint-count">{3 - game.hints}</span></button></div>
              {!solved && <p className="hint-progress" role="status">{game.guesses.length < 5 ? `Indice après 5 essais · ${game.guesses.length}/5 · encore ${5-game.guesses.length} essai${5-game.guesses.length === 1 ? "" : "s"}.` : `${3-game.hints} indice${3-game.hints === 1 ? "" : "s"} restant${3-game.hints === 1 ? "" : "s"} sur 3. Les indices ajoutent une piste identifiée dans l’historique.`}</p>}
            </>}
          </div></section>

          {game.pins.length > 0 && <section className="notebook-card"><div className="section-topline"><h2><Pin size={17} />Mon carnet</h2><span className="muted-count">{game.pins.length}/3</span></div><p>Gardez vos pistes pour rebondir.</p><div className="notebook-pins">{game.pins.map(word => <button key={word} disabled={busy || loading} onClick={() => { pin(word); if (game.pins.length === 1) inputRef.current?.focus(); }} aria-label={`Détacher ${word}`} title="Détacher cette piste">{word}<X size={13} /></button>)}{Array.from({ length: 3 - game.pins.length }, (_, i) => <span className="empty-pin" key={i}><Plus size={14} /></span>)}</div>{!game.pins.length && <span className="notebook-note">Épinglez un mot dans vos explorations.</span>}</section>}
          <section className="history-panel"><div className="section-topline"><h2>Vos essais<span>{game.guesses.length}</span></h2><button className="sort-button" onClick={() => setSort(sort === "heat" ? "recent" : "heat")}>{sort === "heat" ? "Tri : proximité · passer aux récents" : "Tri : récent · passer à la proximité"}</button></div>
            {ordered.length > 0 && <p className="pin-guidance">Épinglez jusqu’à 3 pistes avec le bouton nommé de chaque mot. Elles restent dans votre carnet.</p>}
            {ordered.length ? <div className="guess-list"><div className="list-labels"><span>ESSAI</span><span>VOTRE MOT</span><span>TEMPÉRATURE</span><span className="pin-label">PISTE</span></div>{ordered.map(g => <div key={g.word} className={`guess-row ${latest?.word === g.word ? "latest-guess" : ""} ${feedback && latest?.word === g.word ? "is-new-guess" : ""}`} style={{ "--row-color": warmth(g.temperature).color, "--row-fill": `${Math.max(0, Math.min(100, g.temperature))}%` } as CSSProperties}><span className="guess-index">{String(g.order).padStart(2, "0")}</span><div className="guess-word"><strong>{g.word}</strong>{latest?.word === g.word && <span className="latest-tag">DERNIER</span>}{g.found && <Check size={15} />}{g.hint && <Lightbulb size={13} aria-label="Indice" />}{g.word === best?.word && !g.found && <span className="best-tag">MEILLEUR</span>}</div><div className="guess-score"><div className="mini-heat"><i style={{ width: `${Math.max(2, g.temperature)}%` }} /></div><span>{formatScoreFr(g.temperature)}°<small className="approved-rank">rang {g.rank.toLocaleString("fr-FR")}</small></span></div><button aria-label={`${game.pins.includes(g.word) ? "Détacher" : "Épingler"} ${g.word}`} aria-pressed={game.pins.includes(g.word)} className={`pin-button ${game.pins.includes(g.word) ? "pinned" : ""}`} disabled={busy || loading} onClick={() => pin(g.word)}><Pin size={15} /></button></div>)}</div> : null}
          </section>
        </div>


      </div>

      <div className="reset-note" hidden={Boolean(journey)}><Clock3 size={14} /><span>{mode === "daily" ? <>Prochain mot dans <b>{countdownLabel}</b><small>Minuit, heure de Paris</small></> : mode === "archive" ? <>Cette archive reste disponible<button disabled={busy} onClick={() => loadPuzzle("daily")}>Revenir au mot du jour </button></> : <>Envie d’une autre piste ?<button disabled={busy} onClick={() => void discover()}>Découvrir un autre mot </button></>}</span></div>
      </TabsContent></Tabs>
      </div>
      {EXTRA_MODES_ENABLED && <section className="explore-view reference-voyage" hidden={surface !== "voyage"} aria-labelledby="explore-heading">
        <button className="reference-back" onClick={() => navigate("modes")}>Tous les modes</button>
        <section className="explore-group" aria-label="Voyage">
      <ExpeditionPicker disabled={busy || loading || journeyBusy} journey={journey} currentStageSolved={Boolean(journey?.seed && journey.seed === puzzle?.seed && solved)} error={journeyError} onContinue={id => void openJourney(id,"gameResumed")} />
      <div className="reference-extra"><CollectionPicker wins={profile.wins} seed={mode === "challenge" || mode === "free" ? puzzle?.seed : undefined} disabled={busy || loading} onSelect={(seed, collection) => {
        const url = new URL(window.location.href); url.searchParams.delete("archive"); url.searchParams.set("defi", seed);
        window.history.replaceState(null, "", url); setView("play"); navigate("game"); void loadPuzzle("challenge", seed, undefined, undefined, collection);
      }} />

          <a className="explore-link" href="/laboratoire"><span><strong>Laboratoire</strong><small>L’intrus et Deux braises</small></span></a></div>
        </section>
      </section>}
      {(storageWarning || profileSnapshot && ["partial", "corrupt", "unsupported", "conflict", "memory-only"].includes(profileSnapshot.status)) && <p className="storage-warning" role="status" aria-live="polite" aria-atomic="true">{profileSnapshot?.status === "unsupported" ? "Cette sauvegarde provient d’une version plus récente de BRAIZ. Elle n’a pas été modifiée." : profileSnapshot?.status === "corrupt" ? "La sauvegarde locale est illisible. Les données existantes ont été conservées sans être remplacées." : profileSnapshot?.status === "conflict" ? "Deux anciennes sauvegardes différentes ont été détectées. Elles ont été conservées sans fusion automatique." : profileSnapshot?.status === "partial" ? "Une partie de votre ancienne sauvegarde n’a pas pu être reprise. Les éléments valides restent disponibles." : "La sauvegarde est indisponible dans ce navigateur. Vous pouvez continuer à jouer, mais votre progression risque d’être perdue en quittant ou en rechargeant cette page."}</p>}
      <AdPlacement />
      <footer className="site-footer"><button className="footer-brand" type="button" onClick={() => navigate("game")}>braiz.</button><div><button onClick={() => setModal("privacy")}>Confidentialité</button><button onClick={() => setModal("help")}>Les règles</button></div></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => !open && setModal(null)}><DialogContent className="braise-dialog" onCloseAutoFocus={event => {
      const intent=tutorialReturnFocus.current;tutorialReturnFocus.current=null;
      if(intent) {
        event.preventDefault();modalReturnFocus.current=null;
        if(admitTutorialReturnFocus(intent,{request:requestRef.current,navigation:navigationEpoch.current,playing:surface==="game",modalClosed:modalRef.current===null,focusUnmoved:document.activeElement===intent.owner || document.activeElement===document.body})) {
          (inputRef.current && !inputRef.current.disabled ? inputRef.current : gameBoardRef.current)?.focus({preventScroll:true});
        }
        return;
      }
      const target = modalReturnFocus.current; modalReturnFocus.current = null; if (target?.isConnected) { event.preventDefault(); target.focus({ preventScroll:true }); } }}><DialogHeader><span className="modal-symbol">{modal === "challenge" ? <Users /> : modal === "privacy" ? <LockKeyhole /> : <Flame />}</span><DialogTitle>{modal === "tutorial" ? "Un essai pour comprendre" : modal === "help" ? "Un mot. Et le déclic." : modal === "challenge" ? "Passez le mot. Pas la réponse." : modal === "privacy" ? "Votre partie vous appartient." : modal === "share" ? "À vous de partager." : ""}</DialogTitle><DialogDescription>{modal === "tutorial" ? "Tutoriel facultatif en trois étapes." : modal === "help" ? "La règle tient en trois petites étapes." : modal === "challenge" ? "Créez un lien : chaque personne cherchera exactement le même mot." : modal === "privacy" ? "Le fonctionnement de cette première version." : modal === "share" ? "Copiez ce texte pour le partager avec vos amis." : ""}</DialogDescription></DialogHeader>
      {modal === "tutorial" && <PlayTutorial onClose={()=>{
        const owner=document.activeElement;
        if(surface!=="game") navigate("game",false);
        tutorialReturnFocus.current={request:requestRef.current,navigation:navigationEpoch.current,owner};
        setModal(null);
      }}/>}
      {modal === "help" && <><ol className="rules-list"><li><span>01</span><div><h3>Suivez une intuition.</h3><p>Proposez un mot français. Les noms, adjectifs et verbes à l’infinitif sont de bonnes pistes.</p></div></li><li><span>02</span><div><h3>Prenez la température.</h3><p>Plus le score est élevé, plus le sens est proche. 100° : c’est le mot secret. Le rang #1 est le plus proche.</p></div></li><li><span>03</span><div><h3>Changez de perspective.</h3><p>Explorez des associations. Après 5 essais, vous disposez de 3 indices gratuits. Ils sont signalés dans le résultat partagé.</p></div></li></ol><div className="modal-note">La température traduit une proximité calculée, pas une probabilité. Un contraire peut être proche. Les accents manquants sont acceptés si le mot est identifiable.</div><button className="primary-button full-width" onClick={closeHelpAndFocusGame}>J’ai compris, à moi de jouer</button></>}
      {modal === "challenge" && <><div className="challenge-example"><span>VOUS</span><div><Target size={34} /><b>?</b></div><span>VOS AMIS</span></div><p className="modal-copy">Qui trouvera le mot en le moins d’essais ? Le lien ouvre une partie indépendante pour chacun. Partagez ensuite vos résultats pour comparer.</p><button className="primary-button full-width" disabled={busy || loading} onClick={createChallenge}>Créer et copier le lien<Copy size={17} /></button>{mode === "challenge" && <button className="secondary-button full-width" onClick={() => copy(window.location.href, "Lien du défi copié.")}>Copier le défi actuel<Share2 size={16} /></button>}<p className="modal-note">Pas de compte requis. Aucun classement en direct : chacun conserve sa partie sur son appareil.</p></>}
      {modal === "privacy" && <div className="legal-copy"><h3>Une sauvegarde dans votre navigateur</h3><p>Les modes personnels conservent vos essais, victoires, pistes et préférences dans ce navigateur. Les onglets y partagent la même progression. L’export de profil ne contient pas les parties en cours ni les épingles. Effacer les données du site efface cette progression locale et ses copies de secours.</p><h3>Transfert et synchronisation facultative</h3><p>L’export de profil contient vos faits personnels validés, dont les mots de vos essais, sans les parties classiques en cours ni leurs épingles. Une synchronisation explicitement confirmée peut envoyer au serveur une copie du profil et des parties classiques en cours, avec leurs mots, scores, indices, épingles et contextes. Elle n’est pas chiffrée de bout en bout ; sa suppression distante se confirme dans le profil. Les parties partagées ont leur propre identité et leurs résultats serveur.</p><h3>Le calcul des mots</h3><p>Dans les modes connectés, vos propositions sont envoyées au serveur pour calculer leur proximité. Le pack d’entraînement téléchargé calcule ses parcours finis sur cet appareil. Les résultats personnels ne deviennent pas automatiquement des résultats compétitifs. L’hébergeur peut conserver les journaux techniques nécessaires au service.</p><h3>La publicité</h3><p>Le code AdSense est chargé pour vérifier le site. Aucun emplacement publicitaire ni demande d’annonce n’est actuellement activé.</p><h3>Hors connexion</h3><p>Un écran de secours neutre est mis en cache. Vous pouvez aussi télécharger volontairement un pack d’entraînement fini et vérifié : son interface, son lexique et ses parcours permettent de jouer hors connexion. Sa progression reste séparée du profil classique, sur cet appareil. Les pages quotidiennes et privées demandent une connexion ; elles ne sont pas mises en cache avec vos propositions ou résultats.</p></div>}
      {modal === "share" && <><p role="status">La copie automatique n’a pas abouti. Sélectionnez le texte ci-dessous et copiez-le manuellement.</p><textarea className="share-fallback" readOnly value={shareText} onFocus={e => e.currentTarget.select()} aria-label="Texte à copier" /><button className="secondary-button" onClick={() => setModal(null)}>Fermer<Check size={16} /></button></>}
    </DialogContent></Dialog>
  </div>;
}



