/** Local support ledger. No network, tracking identity, user text or game reference. */
export const PRODUCT_EVENTS_KEY = "braiz.diagnostics.v1";
export const PRODUCT_EVENTS_CAP = 100;
export const PRODUCT_EVENTS_MAX_BYTES = 32768;
export const PRODUCT_EVENT_TYPES = ["gameOpened", "firstGuessAccepted", "guessAccepted", "guessRejected", "networkFailed", "hintUsed", "puzzleWon", "gameResumed", "gameLeft", "helpOpened", "summaryOpened", "shareCopied", "nextActivityOpened", "profileExported", "profileImported", "refusedWordReported", "offlinePackDownloaded", "offlinePackOpened"] as const;
export const PRODUCT_EVENT_CONTEXTS = ["daily", "archive", "free", "challenge", "collection", "expedition", "intruder", "two-braises", "circle", "duel", "studio", "training", "offline", "profile"] as const;
export type ProductEventType = typeof PRODUCT_EVENT_TYPES[number];
export type ProductEventContext = typeof PRODUCT_EVENT_CONTEXTS[number];
export type ProductEvent = { type: ProductEventType; context: ProductEventContext; occurredAt: string };
export type DiagnosticStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type ProductEventLedger = { version: 1; events: ProductEvent[] };
export type LedgerRead = { status: "ready"; ledger: ProductEventLedger } | { status: "unavailable"; reason: "storage" | "incompatible" };
const size = (value: string) => new TextEncoder().encode(value).byteLength;
const hasExactKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
function validEvent(value: unknown): value is ProductEvent {
  if (!value || typeof value !== "object" || Array.isArray(value) || !hasExactKeys(value, ["type", "context", "occurredAt"])) return false;
  const event = value as ProductEvent;
  return PRODUCT_EVENT_TYPES.includes(event.type) && PRODUCT_EVENT_CONTEXTS.includes(event.context) && typeof event.occurredAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.occurredAt) && Number.isFinite(Date.parse(event.occurredAt)) && new Date(event.occurredAt).toISOString() === event.occurredAt;
}
export function readProductEvents(storage: DiagnosticStorage): LedgerRead {
  try {
    const raw = storage.getItem(PRODUCT_EVENTS_KEY);
    if (raw === null) return { status: "ready", ledger: { version: 1, events: [] } };
    if (size(raw) > PRODUCT_EVENTS_MAX_BYTES) return { status: "unavailable", reason: "incompatible" };
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || !hasExactKeys(value, ["version", "events"]) || value.version !== 1 || !Array.isArray(value.events) || value.events.length > PRODUCT_EVENTS_CAP || !value.events.every(validEvent)) return { status: "unavailable", reason: "incompatible" };
    return { status: "ready", ledger: value };
  } catch { return { status: "unavailable", reason: "storage" }; }
}
/** Only call from a real accepted action; never from restoration, import or rendering. */
export function recordProductEvent(storage: DiagnosticStorage, type: ProductEventType, context: ProductEventContext, now = new Date()): boolean {
  const state = readProductEvents(storage);
  if (state.status !== "ready" || !Number.isFinite(now.getTime())) return false;
  // Build the envelope ourselves; runtime objects with extra sensitive fields cannot enter it.
  const event: ProductEvent = { type, context, occurredAt: now.toISOString() };
  if (!validEvent(event)) return false;
  const raw = JSON.stringify({ version: 1, events: [...state.ledger.events, event].slice(-PRODUCT_EVENTS_CAP) });
  if (size(raw) > PRODUCT_EVENTS_MAX_BYTES) return false;
  try { storage.setItem(PRODUCT_EVENTS_KEY, raw); return true; } catch { return false; }
}
/** Produces a file only when the player explicitly requests an export. */
export function exportProductDiagnostics(storage: DiagnosticStorage, now = new Date()): string | null {
  const state = readProductEvents(storage);
  if (state.status !== "ready" || !Number.isFinite(now.getTime())) return null;
  return JSON.stringify({ format: "braiz-local-diagnostics", version: 1, exportedAt: now.toISOString(), scope: "Cet appareil uniquement ; 100 dernières actions observées, sans identifiant, mots ni scores. Aucune mesure d’audience ou de compréhension.", events: state.ledger.events }, null, 2);
}
export function clearProductDiagnostics(storage: DiagnosticStorage): boolean {
  try { storage.removeItem(PRODUCT_EVENTS_KEY); return true; } catch { return false; }
}
