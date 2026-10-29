"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type SetStateAction } from "react";
import { Check, CircleHelp, Clock3, Copy, Flame, Infinity as InfinityIcon, Lightbulb, LockKeyhole, Share2, Target, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { EXTRA_MODES_ENABLED } from "@/lib/release";
import { clientId } from "@/lib/client-id";
import { ProximityMeter } from "@/components/proximity-meter";
import FlameScene from '@/components/flame-scene';
import {AcceptedGuessFlight} from '@/components/accepted-guess-flight';
import { MAX_CLASSIC_HINTS } from '@/lib/classic-hints';
import AdPlacement from "@/components/ad-placement";
import { deviceBoardRevision, admitDeviceBoardMerge } from "@/lib/device-sync-admission";
import { ProfilePanel } from "@/components/profile-panel";
import { COLLECTIONS, collectionProgress } from "@/lib/collections";
import { CollectionPicker } from "@/components/collection-picker";
import { EXPEDITIONS, type ExpeditionStatus } from "@/lib/expeditions";
import { resumeExpedition } from "@/lib/expedition-resume";
import { ExpeditionPicker } from "@/components/expedition-picker";
import { type Guess, type Mode, type Puzzle, type SavedGame } from "@/lib/game-types";

import { classicDailyIdentity, classicFreeIdentity, classicEdition, type ClassicEdition } from "@/lib/word2vec-contract";
import { EMPTY_GAME, EMPTY_PROFILE, readLocal, writeLocal, restoreLegacyGame } from "@/lib/legacy-storage";
import { samePuzzleRef, type EvaluationResponse, type GameEffect } from "@/lib/game-contracts";
import { consumeGameFeedback, createGameFeedback, inputAfterAcceptedGuess, shouldAdmitGameFeedback } from "@/lib/game-feedback";
import { isProfileStorageKey, refreshLocalProfile, setLocalCosmetic, setLocalSound, type ProfileSnapshot } from "@/lib/profile-storage";
import { archiveDateStatus, LEGACY_ARCHIVE_START_DATE, latestArchiveDate, parisDate } from "@/lib/calendar";
import { COSMETICS, projectWeeklyRitual, type CosmeticId } from "@/lib/weekly-ritual";

import { admitTutorialReturnFocus, type TutorialReturnIntent } from "@/lib/tutorial-field";
import { canWriteGameDocument, writeAdmittedGame, recordAdmittedGameProgress } from "@/lib/game-write-admission";
import { classicPuzzleMatchesLoad, failedPuzzleUrl, admittedPuzzleUrl, requestedGameSurface, surfaceUrl, retryPuzzleLoad, admitPuzzleLoad, type PuzzleLoad, type GameSurface } from "@/lib/game-navigation";
import { AppNavigation } from "@/components/app-navigation";
import { ArchiveCalendar } from "@/components/game-parts/archive-calendar";
import { PlayTutorial } from "@/components/game-parts/play-tutorial";
import { WinSummary } from "@/components/game-parts/play-hub";
import { PartiesPanel } from "@/components/game-parts/parties-panel";
import { readLocalPlays, rememberPlayContext, resumeSuggestion, type LocalPlay, type PlayContext } from "@/lib/play-hub";
import { readEncountered, rememberEncountered, collectDiscoveryHistory } from "@/lib/free-discovery";
import { recordProductEvent, type ProductEventType, type ProductEventContext } from "@/lib/product-events";
import { formatNumberFr } from "@/lib/format-fr";
import { proximityFill, proximityColor, formatRankFr } from "@/lib/proximity-presentation";
import { countLabel } from "@/lib/game-copy";
import { requestJson, RequestTimeoutError } from '@/lib/request-json';
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
  const [collectionContext, setCollectionContext] = useState<string | undefined>();
  function refreshPlays() { try { setLocalPlays(readLocalPlays(localStorage)); } catch {} }
  function diagnostic(type: ProductEventType, context?: ProductEventContext) { try { recordProductEvent(localStorage, type, context ?? (journey ? "expedition" : collectionContext ? "collection" : mode)); } catch {} }
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
  const [modal, setModal] = useState<Modal>(null);
  const [now, setNow] = useState(0);
  const [shareText, setShareText] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [archiveDraft, setArchiveDraft] = useState("");
  const [archiveError, setArchiveError] = useState("");
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
  const best = game.guesses.reduce<Guess | null>((winner, guess) => !winner || guess.rank < winner.rank ? guess : winner, null);
  const solved = Boolean(game.guesses.some(g => g.found));
  const vocabularySize = puzzle?.vocabularySize;
  const latest = game.guesses[game.guesses.length - 1];
  const ordered = [...game.guesses].sort((a, b) => a.rank - b.rank || b.order - a.order);
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
  const countdown = puzzle && now ? Math.max(0, new Date(puzzle.resetAt).getTime() - now) : 0;
  const countdownLabel = `${String(Math.floor(countdown / 3600000)).padStart(2, "0")}:${String(Math.floor(countdown / 60000) % 60).padStart(2, "0")}:${String(Math.floor(countdown / 1000) % 60).padStart(2, "0")}`;
  const isRecord = feedback?.type === "bestImproved" && feedback.puzzleRef.id === puzzle?.id;
  const isAccepted = feedback?.type === "guessAccepted" && feedback.puzzleRef.id === puzzle?.id;
  const isCelebratingWin = feedback?.type === "puzzleWon" && feedback.puzzleRef.id === puzzle?.id;
  const feedbackAnnouncement = isRecord && latest
    ? `Nouvelle meilleure piste : ${latest.word}, rang ${formatNumberFr(latest.rank)}.`
    : isAccepted && latest
      ? `Proposition acceptée : ${latest.word}, rang ${formatNumberFr(latest.rank)}.`
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

  async function loadPuzzle(nextMode: Mode, locator = "", sessionSave?: SavedGame, expedition?: ExpeditionStatus, collection?: string, destination?: GameSurface, edition?:ClassicEdition) {
    if (puzzle) journeyMemory.current.set(puzzle.id, game);
    const request = ++requestRef.current;
    setJourney(expedition ?? null);
    collection=COLLECTIONS.find(item=>item.id===collection && item.seeds.includes(locator))?.id;
    if(collection&&!edition)try{edition=readLocalPlays(localStorage).find(play=>play.locator===locator&&!play.game.guesses.some(g=>g.found))?.edition;}catch{}
    setCollectionContext(collection);

    setDiscoveryNote("");setDiscoveryExhausted(false);
    const descriptor: PuzzleLoad={mode:nextMode,locator,sessionSave,expedition,collection,destination,edition};
    lastLoad.current = descriptor;
    const loadEpoch=navigationEpoch.current;
    clearDeferredUi();
    consumedFeedbackRef.current.clear();
    inputRevisionRef.current += 1;
    setMode(nextMode); setGame(EMPTY_GAME); setPuzzle(null); setLoadRetryable(true);
    if (nextMode === "archive") setArchiveDraft(locator);
    setLoading(true); setLoadError(""); setError(""); setInput(""); setFeedback(null);
    setBusy(false); submitting.current = false;
    try {
      const query = (nextMode === "archive" ? `mode=archive&date=${encodeURIComponent(locator)}` : `mode=${nextMode}&seed=${encodeURIComponent(locator)}`)+(edition?`&edition=${encodeURIComponent(edition)}`:'');
      const admitted=await admitPuzzleLoad(descriptor, async()=>{
        return requestJson<Puzzle & {error?:string;targetIdentity?:string}>(`/api/game?${query}`,{cache:"no-store"});
      },{started:{request,navigation:loadEpoch},current:()=>({request:requestRef.current,navigation:navigationEpoch.current})},({response,data},admittedDescriptor)=>{
      if (!response.ok) { setLoadRetryable(response.status >= 500); throw new Error(data.error || "Le jeu ne répond pas. Réessayez dans un instant."); }
      if(!classicPuzzleMatchesLoad(data,admittedDescriptor))throw new Error('La version de cette partie ne correspond plus. Rechargez le jeu pour reprendre.');
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
      setArchiveError("");

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
        setLoadError(cause instanceof Error ? cause.message : "Connexion impossible.");
        // A current failure owns the same destination as a success, so its retry is visible.
        if(failedDescriptor.destination) {
          window.history.replaceState(null,"",failedPuzzleUrl(new URL(window.location.href),failedDescriptor));
          setSurface(failedDescriptor.destination);setView(failedDescriptor.destination === "game" ? "play" : "explore");
        }
      });
      if(admitted===null && request===requestRef.current) setLoadError("Le chargement a été interrompu. Réessayez pour reprendre cette partie.");
      return admitted!==null && admitted!==false;
    } catch (err) {
      if (request === requestRef.current && loadEpoch===navigationEpoch.current) { setLoadError(err instanceof Error ? err.message : "Connexion impossible.");  }
      return false;
    } finally { if (request === requestRef.current) setLoading(false); }
  }

  async function openJourney(id: string, action?: "gameResumed" | "nextActivityOpened", destination: GameSurface="game", edition?:ClassicEdition) {
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
        edition,
        status: async (id, proofs) => {
          const {response,data} = await requestJson<ExpeditionStatus & {error?:string}>("/api/expeditions", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, proofs }) });
          if (!response.ok) throw new Error(data.error || "Connexion impossible.");
          return data;
        },
        readGame: id => puzzle?.id === id ? game : journeyMemory.current.get(id) ?? restoreLegacyGame(id),
        isCurrent: current,
      });
      if (!result || !current()) return;
      setJourney(result.status);
      if (result.status.seed) {
        if(await loadPuzzle("challenge", result.status.seed, result.saved, result.status,undefined,destination,result.edition) && action) diagnostic(action,"expedition");
      } else {
        const completedDestination=destination === "game" ? "voyage" : destination;
        const url = surfaceUrl(new URL(window.location.href),completedDestination);
        url.searchParams.set("voyage", id); url.searchParams.delete("defi"); url.searchParams.delete("archive"); if(puzzle) url.searchParams.set("edition",puzzle.ref.rulesVersion); url.searchParams.delete("libre"); url.searchParams.delete("collection");
        window.history.replaceState(null, "", url);
        setSurface(completedDestination); setView("explore");
      }
    } catch (cause) {
      if (current()) { setJourneyError(cause instanceof Error ? cause.message : "Connexion impossible."); const failedDestination=destination === "game" ? "voyage" : destination;setSurface(failedDestination);setView("explore");window.history.replaceState(null,"",surfaceUrl(new URL(location.href),failedDestination)); }
    } finally { if (epoch === navigationEpoch.current) setJourneyBusy(false); }
  }

  async function discover(replay = false) {
    if (busy || discoveryPending.current) return;
    navigate("game");
    discoveryPending.current=true;
    const generation = requestRef.current, epoch = navigationEpoch.current;
    setDiscoveryBusy(true); setDiscoveryNote("");
    try {
      const excluded = readEncountered(localStorage);
      if (!excluded) throw new Error("L’historique de découverte est illisible et a été conservé. Vous pouvez reprendre une partie existante.");
      const encountered = collectDiscoveryHistory(localStorage, profileSnapshot);
      const {response,data} = await requestJson<{error?:string;encountered:string[];exhausted:boolean;puzzle:(Puzzle & {targetIdentity:string}) | null}>("/api/game", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"discover",excluded,encountered,replay}) });
      if(generation !== requestRef.current || epoch !== navigationEpoch.current) return;
      if(!response.ok) throw new Error(data.error || "Découverte indisponible.");
      if(!rememberEncountered(localStorage,data.encountered)) setStorageWarning(true);
      setDiscoveryExhausted(data.exhausted);
      if(!data.puzzle) { setDiscoveryNote("Vous avez rencontré tous les mots disponibles en libre sur cet appareil. Vous pouvez les rejouer."); return; }
      const loaded=await loadPuzzle("free",data.puzzle.seed);
      if(loaded) { setDiscoveryExhausted(data.exhausted);diagnostic("nextActivityOpened","free"); }
    } catch(cause) { if(generation === requestRef.current && epoch === navigationEpoch.current) setDiscoveryNote(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { discoveryPending.current=false;setDiscoveryBusy(false); }
  }
  async function resumePlay(play: LocalPlay) {
    navigate("game");
    if(puzzle?.id===play.id && mode===play.mode && !play.context?.expedition) {diagnostic("gameResumed",play.context?.collection ? "collection" : play.mode);return;}
    if(play.context?.expedition && EXTRA_MODES_ENABLED) { await openJourney(play.context.expedition,"gameResumed","game",play.edition); return; }
    const loaded=await loadPuzzle(play.mode,play.mode === "daily" ? "" : play.locator,undefined,undefined,play.context?.collection,undefined,play.edition);
    if(loaded) diagnostic("gameResumed",play.context?.collection ? "collection" : play.mode);
  }
  async function nextActivity() {
    if(journey) { await openJourney(journey.id,"nextActivityOpened","game",classicEdition(puzzle?.ref.rulesVersion)); return; }
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
    const edition=classicEdition(params.get('edition'));
    if(EXTRA_MODES_ENABLED && voyage && EXPEDITIONS.some(item=>item.id===voyage)) { if(journey?.id!==voyage || !puzzle || puzzle.seed!==journey.seed||edition&&puzzle.ref.rulesVersion!==edition) void openJourney(voyage,undefined,destination,edition); }
    else if(archive!==null) { if(puzzle?.id!==classicDailyIdentity(archive,edition) || mode!=="archive") void loadPuzzle("archive",archive,undefined,undefined,undefined,undefined,edition); }
    else if(challenge && /^\d{1,10}$/.test(challenge)) { if(puzzle?.id!==classicFreeIdentity(challenge,edition) || mode!=="challenge") void loadPuzzle("challenge",challenge,undefined,undefined,EXTRA_MODES_ENABLED ? params.get("collection") ?? undefined : undefined,undefined,edition); }
    else if(free && /^\d{1,10}$/.test(free)) { if(puzzle?.id!==classicFreeIdentity(free,edition) || mode!=="free") void loadPuzzle("free",free,undefined,undefined,undefined,undefined,edition); }
    else if(params.get('mode')==='free') void discover();
    else if(mode!=="daily"||puzzle?.ref.rulesVersion!==edition&&edition!==undefined) void loadPuzzle("daily",'',undefined,undefined,undefined,undefined,edition);
  }; });

  // Effect events read the latest board/profile without restarting mount subscriptions.
  const initializeBrowser = useEffectEvent(() => {
    setProfileSnapshot(current => refreshLocalProfile(current ?? undefined));
    setFlamePaused(readLocal<boolean>("animationsPaused", false));
    setArchiveDraft(latestArchiveDate());
    const params = new URLSearchParams(window.location.search);
    const archive = params.get("archive"), challenge = params.get("defi"), free = params.get("libre"), voyage = params.get("voyage");
    const edition=classicEdition(params.get('edition'));
    const requestedSurface = requestedGameSurface(new URL(window.location.href));
    if (EXTRA_MODES_ENABLED && voyage && EXPEDITIONS.some(item => item.id === voyage)) { setSurface(requestedSurface); setView(requestedSurface === "game" ? "play" : "explore"); void openJourney(voyage, undefined, requestedSurface,edition); }
    else if (archive !== null) void loadPuzzle("archive", archive,undefined,undefined,undefined,undefined,edition);
    else if (!voyage && challenge && /^\d{1,10}$/.test(challenge)) void loadPuzzle("challenge", challenge, undefined, undefined, EXTRA_MODES_ENABLED ? params.get("collection") ?? undefined : undefined,undefined,edition);
    else if (free && /^\d{1,10}$/.test(free)) void loadPuzzle("free", free,undefined,undefined,undefined,undefined,edition);
    else if (params.get('mode')==='free') { setLoading(false); void discover(); }
    else void loadPuzzle("daily",'',undefined,undefined,undefined,undefined,edition);
    if(params.get('regles')==='1') { setModal('help'); const url=new URL(window.location.href);url.searchParams.delete('regles');window.history.replaceState(null,'',url); }
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
  function revealArchives() {
    const latest = latestArchiveDate(now ? new Date(now) : new Date());
    setArchiveDraft(current => current || latest);
    setArchiveError("");
    navigate("modes");
  }
  async function openArchive(event: FormEvent) {
    event.preventDefault();
    const message = archiveDateError(archiveDraft, now ? new Date(now) : new Date());
    setArchiveError(message);
    if (message || busy) return;
    navigate("game");
    if(await loadPuzzle("archive", archiveDraft)) diagnostic("gameOpened","archive");
  }
  async function submit(event: FormEvent, hint = false) {
    event.preventDefault();
    if (!puzzle || loading || discoveryBusy || submitting.current || solved) return;
    if (hint && (game.hints >= MAX_CLASSIC_HINTS || best?.rank === 2)) return;
    const word = input.trim().toLocaleLowerCase("fr");
    const submittedRevision = inputRevisionRef.current;
    const focusOwner = document.activeElement;
    const shouldReturnFocus = focusOwner === inputRef.current || event.currentTarget.contains(focusOwner);
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = null;
    if (!hint && !word) { inputRef.current?.focus(); return; }
    if (!hint && game.guesses.some(g => g.word === word)) { setError(`« ${word} » est déjà dans vos essais.`); inputRef.current?.select(); return; }
    submitting.current = true; setBusy(true); setError("");
    const request = requestRef.current;
    try {
      const {response,data} = await requestJson<EvaluationResponse & {error?:string}>("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, seed: puzzle.seed, date: mode === "archive" ? puzzle.date : undefined, puzzleId: puzzle.id, puzzleRef: puzzle.ref, word, action: hint ? 'hint' : 'guess', ...(hint ? {hintLevel:game.hints,guesses:game.guesses.map(g=>g.word),bestWord:best?.word} : {}) }) });
      if (request !== requestRef.current) return;
      if (!response.ok) {
        if(response.status === 422) diagnostic("guessRejected");
        else if(response.status >= 500) diagnostic("networkFailed");
        throw new Error(data.error || "Impossible d’analyser ce mot.");
      }
      if (!samePuzzleRef(data.puzzleRef, puzzle.ref)) throw new Error("La réponse ne correspond pas à cette partie. Rechargez le jeu.");
      if (hint && (data.found || data.rank >= (best?.rank ?? puzzle.vocabularySize) || game.hints >= MAX_CLASSIC_HINTS)) throw new Error('Aucun indice disponible.');
      if (game.guesses.some(g => g.word === data.word)) { setError(`« ${data.word} » est déjà dans vos essais.`); return; }
      const acceptedAt = new Date().toISOString();
      const guess: Guess = { word: data.word, temperature: data.temperature, rank: data.rank, found: data.found, order: game.guesses.length + 1, hint, acceptedAt };
      const next = { ...game, guesses: [...game.guesses, guess], hints:game.hints + Number(hint), profileV2StartIndex: game.profileV2StartIndex ?? game.guesses.length, ...(data.found ? { solvedAt: Date.parse(acceptedAt), completedMode: mode } : {}) };
      setInput(current => inputAfterAcceptedGuess(current, hint, inputRevisionRef.current, submittedRevision));
      const nextFeedback = createGameFeedback(best?.rank ?? null, guess, puzzle.ref);
      showFeedback(nextFeedback);
      // Future game documents must not project their unknown facts into profile/rewards either.
      if(gameWriteAllowed.current && canWriteGameDocument(undefined,puzzle.id)) {
        const progressed = recordAdmittedGameProgress(puzzle, next, undefined, profileSnapshot ?? undefined);
        if(progressed) setProfileSnapshot(progressed);
        if (!progressed?.persisted) setStorageWarning(true);
      }
      saveGame(next);
      diagnostic("guessAccepted");
      if (hint) diagnostic('hintUsed');
      if(game.guesses.length === 0) diagnostic("firstGuessAccepted");
      if(data.found) diagnostic("puzzleWon");
      if (profile.sound && nextFeedback.type !== "guessAccepted") playTone(data.found);
      if (shouldReturnFocus) {
        focusFrameRef.current = requestAnimationFrame(() => {
          focusFrameRef.current = null;
          if (request !== requestRef.current || modalRef.current !== null || viewRef.current !== "play") return;
          if (document.activeElement !== focusOwner && document.activeElement !== document.body) return;
          (data.found ? victoryRef.current : inputRef.current)?.focus({ preventScroll: true });
        });
      }
    } catch (err) { if (request === requestRef.current) { if(err instanceof TypeError || err instanceof RequestTimeoutError) diagnostic("networkFailed"); if(inputRevisionRef.current === submittedRevision) setError(err instanceof Error ? err.message : "Connexion impossible. Votre saisie est conservée."); } }
    finally { if (request === requestRef.current) { submitting.current = false; setBusy(false); } }
  }

  async function copy(text: string, feedback: string) {
    try { await navigator.clipboard.writeText(text); diagnostic("shareCopied"); toast.success(feedback); }
    catch { setShareText(text); setModal("share"); }
  }
  function resultText() {
    const journey = game.guesses.filter(g => !g.hint).filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 8)) === 0).slice(0, 8).map(g => g.found ? "🟩" : g.rank <= 100 ? "🟥" : g.rank <= 1000 ? "🟧" : g.rank <= 5000 ? "🟨" : "🟦").join("");
    const url = new URL(window.location.origin);
    url.searchParams.delete("defi"); url.searchParams.delete("archive"); if(puzzle) url.searchParams.set("edition",puzzle.ref.rulesVersion);
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

  return <div className={`app-shell focused-interface foyer-interface reference-interface approved-interface proximity-interface ${flamePaused ? "motion-paused" : ""} cosmetic-${selectedCosmetic}`}>
    <Toaster position="bottom-center" theme="dark" />
    <a className="skip-link" href="#braise-main">Aller au contenu</a>
    <AppNavigation active={surface === "profile" ? "profile" : surface === "modes" ? "archives" : surface === "game" && !journey && !currentCollection && (mode === "daily" || mode === "free") ? mode : "play"} onNavigate={destination => {
      if(destination==='archives') revealArchives();
      else if(destination==='profile') navigate('profile');
      else if(destination==='free') void discover();
      else { navigate('game'); if(destination==='daily' && (mode!=='daily' || !puzzle || journey || currentCollection)) void loadPuzzle('daily').then(loaded=>{if(loaded) diagnostic('gameOpened','daily');}); }
    }} onHelp={returnFocus=>{modalReturnFocus.current=returnFocus;setModal("help");diagnostic("helpOpened");}} />

    <main id="braise-main" tabIndex={-1} className={`main-shell surface-${surface}`}>
      {surface === "modes" && <>
        <PartiesPanel plays={localPlays} disabled={busy || loading || journeyBusy || discoveryBusy} onResume={play=>void resumePlay(play)}>
        <section className="parties-archives" id="parties-archives" aria-label="Choisir une archive">
          <form className="archive-form" onSubmit={openArchive}>
            <label htmlFor="archive-date">Date</label><input id="archive-date" type="date" min={LEGACY_ARCHIVE_START_DATE} max={archiveMax} value={archiveDraft} onChange={event=>{setArchiveDraft(event.target.value);setArchiveError("");}} aria-invalid={Boolean(archiveError)} aria-describedby={archiveError ? "archive-error" : undefined} disabled={busy || loading}/>
            <button className="secondary-button" disabled={busy || loading}>Jouer</button>
            {archiveError && <p id="archive-error" className="archive-error" role="alert">{archiveError}</p>}
          </form>
          <ArchiveCalendar max={archiveMax} selected={archiveDraft} plays={localPlays} disabled={busy || loading} onOpen={date=>{setArchiveDraft(date);navigate("game");void loadPuzzle("archive",date).then(loaded=>{if(loaded) diagnostic("gameOpened","archive");});}}/>
        </section>
        </PartiesPanel>
      </>}
      {surface === "profile" && (profileSnapshot && now ? <ProfilePanel snapshot={profileSnapshot} ritual={ritual} now={new Date(now).toISOString()} busy={busy || loading} flamePaused={flamePaused} onSound={saveSound} onAnimations={toggleAnimations} onCosmetic={selectCosmetic} onSnapshot={setProfileSnapshot} onDeviceSync={receiveDeviceSync} deviceSyncGuard={deviceSyncGuard} onBack={() => navigate("game")} /> : <section className="reference-profile"><h1>Votre progression</h1><p role="status">Chargement du profil…</p></section>)}

      <div hidden={surface !== "game"} className={`play-view ${journey ? "voyage-play" : ""}`}>
      {currentCollection && <div className="voyage-game-heading"><button className="text-action" onClick={()=>navigate("voyage")}>Collections</button><h1>{currentCollection.title}</h1><p>Énigme {currentCollection.seeds.indexOf(puzzle?.seed ?? "")+1} sur {currentCollection.seeds.length}</p></div>}
      {journey && !journey.reward && <div className="voyage-game-heading"><button className="text-action" onClick={() => { navigate("voyage"); setView("explore"); }}>Voyage</button><h1>{EXPEDITIONS.find(item => item.id === journey.id)?.title}</h1><p>Épreuve {journey.completed + 1} sur {journey.length}</p><progress value={journey.completed + (solved ? 1 : 0)} max={journey.length} aria-label="Progression du chapitre"/></div>}
      <div className="game-tab-content">
        {discoveryBusy && <p className="parties-notice" role="status">Recherche d’un mot…</p>}
        {discoveryNote && <p className="parties-notice" role="status">{discoveryNote}</p>}
      <div className="play-layout">
        <div className="play-column">
          <section id="game-board" ref={gameBoardRef} tabIndex={-1} className={`game-panel ${isAccepted ? "is-accepted" : ""} ${isRecord ? "is-record" : ""} ${solved ? "is-won" : ""} ${isCelebratingWin ? "is-celebrating" : ""}`} aria-label="Plateau de jeu">
            <AcceptedGuessFlight key={puzzle?.id??'loading'} receipt={feedback&&latest?{id:feedback.id,word:latest.word,rank:latest.rank,found:latest.found}:null} inputId="guess" paused={flamePaused||surface!=='game'||modal!==null}/>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{feedbackAnnouncement}</p>
            <div className="game-topline"><div><span className="game-kicker">{journey ? "VOTRE VOYAGE" : currentCollection ? "VOTRE COLLECTION" : mode === "daily" ? "Mot du jour" : mode === "archive" ? "ARCHIVE" : mode === "free" ? "Libre" : "Défi"}</span><span className="edition">{puzzle ? `N° ${String(puzzle.number).padStart(3, "0")}` : "…"}</span></div><span className="daily-pill">{mode === "daily" || mode === "archive" ? <><Clock3 size={13} />{puzzle ? new Date(`${puzzle.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(mode === "archive" ? { year: "numeric" as const } : {}), timeZone: "UTC" }) : mode === "archive" ? "Archive" : "Aujourd’hui"}</> : <><InfinityIcon size={15} />{journey ? journey.reward ? "Chapitre terminé" : `Parcours personnel · étape ${journey.completed + 1}/${journey.length}` : currentCollection ? "Collection personnelle · à votre rythme" : mode === "challenge" ? "Même mot, même défi" : "Sans limite de temps"}</>}</span><span className="game-trials">{countLabel(game.guesses.length,"essai")}</span></div>
<h1 className="sr-only">{mode === "daily" ? "Mot du jour" : "Mot à trouver"}</h1>
{surface === "game" && !solved && <ProximityMeter rank={puzzle ? best?.rank ?? null : null} vocabularySize={vocabularySize} solved={solved} celebrating={isCelebratingWin} paused={flamePaused} revealMotion={isAccepted || isRecord || isCelebratingWin}/>}
<div className="approved-play-surface">{loadError ? <div className="load-error" role="alert"><CircleHelp size={34} /><h2>{mode === "archive" ? "Archive indisponible." : "Une petite pause imprévue."}</h2><p>{loadError}</p>{loadRetryable && <button className="primary-button" onClick={() => retryPuzzleLoad(lastLoad.current,loadPuzzle,"game")}>Réessayer</button>}{mode === "archive" && <button className="text-action" onClick={() => loadPuzzle("daily")}>Revenir au mot du jour</button>}</div> : <>
              {discoveryNote && <p className="free-discovery-note" role="status">{discoveryNote}</p>}
              {discoveryExhausted && <button className="secondary-button" disabled={discoveryBusy} onClick={()=>void discover(true)}>Rejouer une cible</button>}
              {solved ? <div className="victory-box">
                <FlameScene level={1} rank={1} solved celebrating={isCelebratingWin} paused={flamePaused} revealMotion={isCelebratingWin}/>
                <span className="victory-eyebrow">Trouvé</span>
                <h2 ref={victoryRef} tabIndex={-1} data-flight-word={best?.word} aria-label={`Mot trouvé : ${best?.word}`}>{best?.word}</h2>
                <p>{countLabel(game.guesses.length,'essai')} · {countLabel(game.hints,'indice')}</p>
                <div className="victory-actions">
                  <button className="primary-button" disabled={journeyBusy || discoveryBusy} onClick={()=>void nextActivity()}>{journeyBusy ? 'Chargement…' : journey ? journey.completed + 1 < journey.length ? 'Épreuve suivante' : 'Terminer le chapitre' : discoveryBusy ? 'Recherche…' : 'Continuer à jouer'}</button>
                  <button className="secondary-button" onClick={shareResult}><Share2 size={17}/>Partager</button>
                </div>
                <details onToggle={event=>{if(event.currentTarget.open) diagnostic('summaryOpened');}}><summary>Voir les essais</summary><WinSummary game={game}/></details>
              </div> : <div className="guess-area">
                <form onSubmit={submit} className="guess-form" data-hints="true" aria-busy={busy}>
                  <label className="sr-only" htmlFor="guess">Mot</label>
                  <input id="guess" ref={inputRef} value={input} onChange={e => { inputRevisionRef.current += 1; setInput(e.target.value); setError(""); }} placeholder="Mot" lang="fr" autoComplete="off" autoCorrect="on" autoCapitalize="none" spellCheck={true} enterKeyHint="send" maxLength={50} aria-describedby="guess-feedback" aria-invalid={Boolean(error)} disabled={loading || discoveryBusy} />
                  <button type="submit" className="guess-button" aria-label={busy ? "Analyse en cours" : "Envoyer"} disabled={!puzzle || loading || busy || journeyBusy || discoveryBusy || !input.trim()}>{busy ? "Analyse…" : "Envoyer"}</button>
                  <button type="button" className="classic-hint-button" title={`Indice · ${MAX_CLASSIC_HINTS-game.hints} restant${MAX_CLASSIC_HINTS-game.hints === 1 ? "" : "s"}`} aria-label={`Indice, ${MAX_CLASSIC_HINTS-game.hints} disponible${MAX_CLASSIC_HINTS-game.hints === 1 ? "" : "s"}`} disabled={!puzzle || busy || loading || discoveryBusy || journeyBusy || game.hints >= MAX_CLASSIC_HINTS || best?.rank === 2} onClick={event=>void submit(event,true)}>
                    <Lightbulb size={17} aria-hidden="true"/><span className="hint-label">Indice</span><span className="hint-remaining" aria-hidden="true">{MAX_CLASSIC_HINTS-game.hints}</span>
                  </button>
                </form>
                <div className={`input-feedback ${error ? "error" : ""}`} id="guess-feedback" aria-live="polite">{error || (loading ? "Chargement du mot…" : null)}</div>
              </div>}
            </>}
          </div></section>

          {puzzle && ordered.length > 0 && <section className="history-panel"><h2 className="sr-only">Essais</h2>
            {puzzle && ordered.length ? <div className="guess-list"><div className="list-labels"><span>Mot</span><span>Proximité</span></div>{ordered.map(g => <div key={g.word} data-flight-word={g.word} className={`guess-row ${latest?.word === g.word ? "latest-guess" : ""} ${feedback && latest?.word === g.word ? "is-new-guess" : ""}`} style={{ "--row-color": proximityColor(g.rank) } as CSSProperties}><div className="guess-word"><strong>{g.word}</strong>{latest?.word === g.word && <span className="latest-tag">DERNIER</span>}{g.hint && <span className="hint-tag">Indice</span>}{g.found && <Check size={15}/>}</div><div className="guess-score"><div className="mini-heat" aria-hidden="true"><i style={{ width: `${proximityFill(g.rank,vocabularySize)*100}%` }}/></div><span>{g.found ? "Trouvé" : formatRankFr(g.rank)}</span></div></div>)}</div> : null}
          </section>}
        </div>


      </div>

      <div className="reset-note" hidden={Boolean(journey)}><Clock3 size={14} /><span>{mode === "daily" ? <>Prochain mot dans <b>{countdownLabel}</b><small>Minuit, heure de Paris</small></> : mode === "archive" ? <>Cette archive reste disponible<button disabled={busy} onClick={() => loadPuzzle("daily")}>Revenir au mot du jour </button></> : <>Envie d’une autre piste ?<button disabled={busy} onClick={() => void discover()}>Découvrir un autre mot </button></>}</span></div>
      </div>
      </div>
      {EXTRA_MODES_ENABLED && surface === "voyage" && <section className="explore-view reference-voyage" aria-labelledby="explore-heading">
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
      <footer className="site-footer"><button className="footer-brand" type="button" onClick={() => navigate("game")}>braiz.</button><div><a href="/a-propos">À propos</a><a href="/confidentialite">Confidentialité</a></div></footer>
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
      const target = modalReturnFocus.current; modalReturnFocus.current = null; if (target?.isConnected) { event.preventDefault(); target.focus({ preventScroll:true }); } }}><DialogHeader><span className="modal-symbol">{modal === "challenge" ? <Users /> : modal === "privacy" ? <LockKeyhole /> : <Flame />}</span><DialogTitle>{modal === "tutorial" ? "Un essai pour comprendre" : modal === "help" ? "Règles" : modal === "challenge" ? "Passez le mot. Pas la réponse." : modal === "privacy" ? "Votre partie vous appartient." : modal === "share" ? "Partager" : ""}</DialogTitle><DialogDescription>{modal === "tutorial" ? "Tutoriel facultatif en trois étapes." : modal === "help" ? "Trouvez le mot secret." : modal === "challenge" ? "Créez un lien : chaque personne cherchera exactement le même mot." : modal === "privacy" ? "Le fonctionnement de cette première version." : modal === "share" ? "Copiez ce texte pour le partager avec vos amis." : ""}</DialogDescription></DialogHeader>
      {modal === "tutorial" && <PlayTutorial onClose={()=>{
        const owner=document.activeElement;
        if(surface!=="game") navigate("game",false);
        tutorialReturnFocus.current={request:requestRef.current,navigation:navigationEpoch.current,owner};
        setModal(null);
      }}/>}
      {modal === "help" && <><ol className="rules-list"><li><span>01</span><div><h3>Envoyez un mot.</h3><p>Entrez un mot français : nom, adjectif ou verbe à l’infinitif.</p></div></li><li><span>02</span><div><h3>Suivez la progression.</h3><p>La flamme et le pourcentage gardent votre meilleure progression. Les essais sont classés du plus proche au moins proche.</p></div></li><li><span>03</span><div><h3>Trouvez le mot.</h3><p>Les essais sont illimités. Vous disposez de trois indices : chacun donne un mot mieux placé.</p></div></li></ol><button className="primary-button full-width" onClick={closeHelpAndFocusGame}>Jouer</button><button className="secondary-button full-width" onClick={()=>setModal("tutorial")}>Essayer le tutoriel</button></>}
      {modal === "challenge" && <><div className="challenge-example"><span>VOUS</span><div><Target size={34} /><b>?</b></div><span>VOS AMIS</span></div><p className="modal-copy">Qui trouvera le mot en le moins d’essais ? Le lien ouvre une partie indépendante pour chacun. Partagez ensuite vos résultats pour comparer.</p><button className="primary-button full-width" disabled={busy || loading} onClick={createChallenge}>Créer et copier le lien<Copy size={17} /></button>{mode === "challenge" && <button className="secondary-button full-width" onClick={() => copy(window.location.href, "Lien du défi copié.")}>Copier le défi actuel<Share2 size={16} /></button>}<p className="modal-note">Pas de compte requis. Aucun classement en direct : chacun conserve sa partie sur son appareil.</p></>}
      {modal === "privacy" && <div className="legal-copy"><h3>Une sauvegarde dans votre navigateur</h3><p>Les modes personnels conservent vos essais, victoires, pistes et préférences dans ce navigateur. Les onglets y partagent la même progression. L’export de profil ne contient pas les parties en cours ni les épingles. Effacer les données du site efface cette progression locale et ses copies de secours.</p><h3>Transfert et synchronisation facultative</h3><p>L’export de profil contient vos faits personnels validés, dont les mots de vos essais, sans les parties classiques en cours ni leurs épingles. Une synchronisation explicitement confirmée peut envoyer au serveur une copie du profil et des parties classiques en cours, avec leurs mots, scores, indices, épingles et contextes. Elle n’est pas chiffrée de bout en bout ; sa suppression distante se confirme dans le profil. Les parties partagées ont leur propre identité et leurs résultats serveur.</p><h3>Le calcul des mots</h3><p>Les données linguistiques sont mises à disposition par <a href="https://fauconnier.github.io/#data" target="_blank" rel="noopener noreferrer">Jean-Philippe Fauconnier</a>, sous licence <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.</p><p>Dans les modes connectés, vos propositions sont envoyées au serveur pour calculer leur proximité. Le pack d’entraînement téléchargé calcule ses parcours finis sur cet appareil. Les résultats personnels ne deviennent pas automatiquement des résultats compétitifs. L’hébergeur peut conserver les journaux techniques nécessaires au service.</p><h3>La publicité</h3><p>Une balise et un fichier ads.txt permettent de vérifier le compte AdSense sans charger le programme publicitaire. Aucun emplacement ni demande d’annonce n’est actuellement activé.</p><h3>Hors connexion</h3><p>Un écran de secours neutre est mis en cache. Vous pouvez aussi télécharger volontairement un pack d’entraînement fini et vérifié : son interface, son lexique et ses parcours permettent de jouer hors connexion. Sa progression reste séparée du profil classique, sur cet appareil. Les pages quotidiennes et privées demandent une connexion ; elles ne sont pas mises en cache avec vos propositions ou résultats.</p></div>}
      {modal === "share" && <><p role="status">La copie automatique n’a pas abouti. Sélectionnez le texte ci-dessous et copiez-le manuellement.</p><textarea className="share-fallback" readOnly value={shareText} onFocus={e => e.currentTarget.select()} aria-label="Texte à copier" /><button className="secondary-button" onClick={() => setModal(null)}>Fermer<Check size={16} /></button></>}
    </DialogContent></Dialog>
  </div>;
}



