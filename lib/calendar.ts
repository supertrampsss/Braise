// No semantic data: shared Paris calendar helpers remain cheap to import.
export const LEGACY_ARCHIVE_START_DATE = "2026-09-07";

const PARIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDate(now = new Date()) {
  const parts = PARIS_DATE_FORMATTER.formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftCalendarDate(value: string, days: number) {
  if (!isCalendarDate(value) || !Number.isSafeInteger(days)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function latestArchiveDate(now = new Date()) {
  return shiftCalendarDate(parisDate(now), -1)!;
}

export type ArchiveDateStatus = "available" | "invalid" | "before-start" | "today-or-future";
export function archiveDateStatus(value: unknown, now = new Date()): ArchiveDateStatus {
  if (!isCalendarDate(value)) return "invalid";
  if (value < LEGACY_ARCHIVE_START_DATE) return "before-start";
  if (value >= parisDate(now)) return "today-or-future";
  return "available";
}

export function nextParisMidnight(now = new Date()) {
  // Preserve the V1 search and its one-second precision, including DST days.
  const today = parisDate(now);
  let lo = now.getTime(); let hi = lo + 27 * 3600000;
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (parisDate(new Date(mid)) === today) lo = mid; else hi = mid; }
  return new Date(Math.ceil(hi / 1000) * 1000).toISOString();
}
