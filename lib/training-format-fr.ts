const number = new Intl.NumberFormat("fr-FR");
const score = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

/** Frozen historical training shell: preserve its byte-reproducible formatting. */
export function formatNumberFr(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? number.format(value) : "Non disponible";
}
export function formatScoreFr(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? score.format(value) : "Non disponible";
}
export function formatDateFr(value: string | Date | null | undefined, includeTime = false): string {
  if (value == null) return "Date inconnue";
  const instant = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value)) return "Date inconnue";
  return Number.isFinite(instant.getTime()) ? (includeTime ? dateTime : date).format(instant) : "Date inconnue";
}
export const ACTION_LABELS = { propose: "Proposer", resume: "Reprendre", retry: "Réessayer", backToGame: "Revenir au jeu", publish: "Publier cette version", nextStage: "Étape suivante", refresh: "Actualiser" } as const;
