// Deliberately independent of daily games, profiles, XP and shared-game APIs.
import info from "../public/training/pack-info.json";

export const TRAINING_INFO = info;
export type TrainingScore = { word: string; temperature: number; rank: number; found: boolean };
export type TrainingPuzzle = { id: string; level: "Facile" | "Standard" | "Exploration"; definition: string; hints: string[]; scores: TrainingScore[] };
export type TrainingPack = { schema: 1; id: string; sourceCommit: string; corpusSha256: string; rankScope: number; vocabulary: string[]; puzzles: TrainingPuzzle[] };
export type TrainingProgress = { schema: 1; packSha256: string; selected: string; games: Record<string, { words: string[]; hints: number }> };
export const TRAINING_STORAGE_KEY = `braiz.training.progress.v1.${info.sha256}`;
export const OUTSIDE_PACK = "Ce mot est hors du vocabulaire de ce petit pack. Aucun score ni essai ajouté. Cela ne signifie pas qu’il est absent du jeu en ligne.";

export async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
}

export async function decodeTrainingPack(bytes: ArrayBuffer): Promise<TrainingPack> {
  if (bytes.byteLength !== info.bytes || await sha256(bytes) !== info.sha256) throw new Error("Le pack est incomplet ou altéré. Aucun score disponible.");
  const pack = JSON.parse(new TextDecoder().decode(bytes));
  if (!validTrainingPack(pack)) throw new Error("Version du pack non prise en charge. Données conservées.");
  return pack;
}

export function validTrainingPack(value: unknown): value is TrainingPack {
  if (!value || typeof value !== "object") return false;
  const p = value as TrainingPack;
  if (p.schema !== 1 || p.id !== info.id || p.sourceCommit !== info.sourceCommit || p.corpusSha256 !== info.corpusSha256 || p.rankScope !== 30000 || !Array.isArray(p.vocabulary) || p.vocabulary.length !== info.wordCount || new Set(p.vocabulary).size !== p.vocabulary.length || !p.vocabulary.every(w => typeof w === "string" && w.length > 0 && w.length < 60) || !Array.isArray(p.puzzles) || p.puzzles.length !== 3) return false;
  return p.puzzles.every((puzzle, index) => puzzle && puzzle.id === `${p.id}-${index + 1}` && puzzle.level === ["Facile", "Standard", "Exploration"][index] && typeof puzzle.definition === "string" && puzzle.definition.length > 0 && Array.isArray(puzzle.hints) && puzzle.hints.length === 3 && puzzle.hints.every(hint => typeof hint === "string" && hint.length > 0 && hint.length < 300) && Array.isArray(puzzle.scores) && puzzle.scores.length === p.vocabulary.length && puzzle.scores.filter(s => s?.found === true).length === 1 && puzzle.scores.every((s, i) => s && s.word === p.vocabulary[i] && Number.isFinite(s.temperature) && s.temperature >= -100 && s.temperature <= 100 && Number.isInteger(s.rank) && s.rank >= 1 && s.rank <= p.rankScope && typeof s.found === "boolean" && (s.found ? s.temperature === 100 && s.rank === 1 : s.temperature < 100)));
}

// Exact normalized spellings only: a finite subset cannot disambiguate aliases
// against all 30,000 words. Never invent an accent-insensitive match.
export function trainingScore(puzzle: TrainingPuzzle, input: string) {
  const normalized = input.trim().toLocaleLowerCase("fr").normalize("NFC").replace(/’/g, "'");
  return puzzle.scores.find(score => score.word === normalized) ?? null;
}

export function emptyTrainingProgress(pack: TrainingPack): TrainingProgress {
  return { schema: 1, packSha256: info.sha256, selected: pack.puzzles[0].id, games: Object.fromEntries(pack.puzzles.map(p => [p.id, { words: [], hints: 0 }])) };
}

export function readTrainingProgress(raw: string | null, pack: TrainingPack): { ok: true; value: TrainingProgress } | { ok: false; message: string } {
  if (raw === null) return { ok: true, value: emptyTrainingProgress(pack) };
  try {
    const p = JSON.parse(raw) as TrainingProgress;
    if (p.schema !== 1 || p.packSha256 !== info.sha256 || !pack.puzzles.some(game => game.id === p.selected) || !p.games || Object.keys(p.games).length !== pack.puzzles.length) throw new Error();
    for (const puzzle of pack.puzzles) {
      const game = p.games[puzzle.id];
      if (!game || !Number.isInteger(game.hints) || game.hints < 0 || game.hints > puzzle.hints.length || !Array.isArray(game.words) || game.words.length > pack.vocabulary.length || new Set(game.words).size !== game.words.length) throw new Error();
      for (let i = 0; i < game.words.length; i++) {
        if (typeof game.words[i] !== "string") throw new Error();
        const score = trainingScore(puzzle, game.words[i]);
        if (!score || score.word !== game.words[i] || (score.found && i !== game.words.length - 1)) throw new Error();
      }
    }
    return { ok: true, value: p };
  } catch { return { ok: false, message: "La sauvegarde d’entraînement est incompatible ou altérée. Elle est conservée ; aucune écriture ne sera faite." }; }
}

export function saveTrainingProgress(storage: Pick<Storage, "getItem" | "setItem">, previousRaw: string | null, value: TrainingProgress, pack: TrainingPack) {
  if (!readTrainingProgress(previousRaw, pack).ok) throw new Error("Sauvegarde incompatible ou altérée : données conservées.");
  if (!readTrainingProgress(JSON.stringify(value), pack).ok) throw new Error("Progression invalide : sauvegarde conservée.");
  if (storage.getItem(TRAINING_STORAGE_KEY) !== previousRaw) throw new Error("La sauvegarde a changé dans un autre onglet. Rechargez pour la reprendre ; elle est conservée.");
  const raw = JSON.stringify(value);
  storage.setItem(TRAINING_STORAGE_KEY, raw);
  return raw;
}

export type OfflineTrainingStatus = { ready: boolean; bytes: number; wordCount: number; puzzleCount: number; packSha256: string; olderVersions: number; storedVersions: number };
export async function trainingWorkerRequest(action: "status" | "download" | "remove"): Promise<OfflineTrainingStatus> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) throw new Error("Le stockage hors ligne nécessite un navigateur compatible et une connexion sécurisée.");
  let preparationTimer: ReturnType<typeof setTimeout> | undefined;
  const preparation = new AbortController();
  const prepare = async () => {
    const registration = await navigator.serviceWorker.register("/sw.js").catch(() => { throw new Error("Le service hors ligne est indisponible. Reconnectez-vous puis rechargez pour réessayer."); });
    if (preparation.signal.aborted) throw new Error("Préparation du service hors ligne interrompue.");
    // Register can resolve an existing registration before any update is found.
    // Update resolves after the script check (with installing already assigned
    // when changed); it does not wait for installation or activate the worker.
    if (!registration.waiting && !registration.installing && navigator.onLine !== false) {
      await registration.update().catch(() => {
        // A failed network check must not hide an already installed offline pack.
      });
      if (preparation.signal.aborted) throw new Error("Préparation du service hors ligne interrompue.");
    }
    // A previously installed neutral worker does not speak the training protocol.
    // Talk to the new waiting worker without activating it or disturbing clients.
    const installing = registration.installing;
    if (installing) await new Promise<void>((resolve, reject) => {
      const cleanup = () => { installing.removeEventListener("statechange", changed); preparation.signal.removeEventListener("abort", aborted); };
      const aborted = () => { cleanup(); reject(new Error("Préparation du service hors ligne interrompue.")); };
      const changed = () => {
        if (installing.state === "redundant") { cleanup(); reject(new Error("L’installation du service hors ligne a échoué. Réessayez en ligne.")); }
        else if (installing.state === "installed" || installing.state === "activated") { cleanup(); resolve(); }
      };
      installing.addEventListener("statechange", changed);
      preparation.signal.addEventListener("abort", aborted, { once: true });
      changed();
    });
    return registration.waiting ?? installing ?? registration.active ?? (await navigator.serviceWorker.ready).active;
  };
  let active: ServiceWorker | null;
  try {
    active = await Promise.race([prepare(), new Promise<never>((_, reject) => { preparationTimer = setTimeout(() => { preparation.abort(); reject(new Error("Le service hors ligne n’est pas prêt. Réessayez en ligne.")); }, 15000); })]);
  } finally { clearTimeout(preparationTimer); }
  if (!active) throw new Error("Le service hors ligne se prépare. Réessayez dans un instant.");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Le téléchargement n’a pas été confirmé. Réessayez en ligne.")); }, 45000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data?.error) reject(new Error(event.data.error));
      else resolve(event.data as OfflineTrainingStatus);
    };
    active.postMessage({ type: "training", action, packSha256: info.sha256 }, [channel.port2]);
  });
}
