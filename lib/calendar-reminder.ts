import { isCalendarDate, shiftCalendarDate } from "./calendar";

export const CALENDAR_REMINDER_KEY = "braiz.calendar-reminder.v1";
export type ReminderOptions = { startDate: string; time: string; timeZone: string; days: number };
export type CalendarReminder = ReminderOptions & { version: 1; uid: string; endDate: string; instants: string[]; createdAt: string; cancelled: boolean };
type ReminderStorage = Pick<Storage, "getItem" | "setItem">;
export type ReminderRead = { status: "ready"; reminder: CalendarReminder | null } | { status: "unavailable" };

function zoneFormatter(timeZone: string) {
  if (!/^[A-Za-z0-9_+/-]{1,80}$/.test(timeZone)) throw new Error("Choisissez un fuseau IANA valide, par exemple Europe/Paris.");
  try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }); }
  catch { throw new Error("Ce fuseau IANA n’est pas reconnu sur cet appareil."); }
}
function parts(formatter: Intl.DateTimeFormat, instant: number) {
  const fields = Object.fromEntries(formatter.formatToParts(instant).filter(item => item.type !== "literal").map(item => [item.type, item.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}`, asUTC: Date.UTC(+fields.year, +fields.month - 1, +fields.day, +fields.hour, +fields.minute, +fields.second) };
}
export function dateInReminderZone(now: Date, timeZone: string): string { return parts(zoneFormatter(timeZone), now.getTime()).date; }
function utcWallTime(date: string, time: string, formatter: Intl.DateTimeFormat): string {
  const wall = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set<number>();
  // Observe both sides of any nearby DST change, including fractional-hour offsets.
  for (let hour = -36; hour <= 36; hour += 6) {
    const sample = wall + hour * 3600000;
    offsets.add(parts(formatter, sample).asUTC - sample);
  }
  const matches = [...offsets].map(offset => wall - offset).filter(instant => { const local = parts(formatter, instant); return local.date === date && local.time === time; }).sort((a, b) => a - b);
  if (!matches.length) throw new Error(`L’heure ${time} n’existe pas le ${date} dans ce fuseau (changement d’heure). Choisissez une autre heure.`);
  // The first occurrence is the explicit policy for an overlapping wall time.
  return new Date(matches[0]).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
export function createCalendarReminder(options: ReminderOptions, id: string, now = new Date()): CalendarReminder {
  if (!isCalendarDate(options.startDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(options.time) || !Number.isInteger(options.days) || options.days < 1 || options.days > 90 || !/^[A-Za-z0-9-]{1,80}$/.test(id) || !Number.isFinite(now.getTime())) throw new Error("Choisissez une date valide, une heure et une durée de 1 à 90 jours.");
  const formatter = zoneFormatter(options.timeZone);
  const dates = Array.from({ length: options.days }, (_, index) => shiftCalendarDate(options.startDate, index)!);
  const instants = dates.map(date => utcWallTime(date, options.time, formatter));
  return { ...options, version: 1, uid: `braiz-${id}@braiz.io`, endDate: dates[dates.length - 1], instants, createdAt: now.toISOString(), cancelled: false };
}
export function escapeCalendarText(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
export function foldCalendarLine(line: string): string {
  let result = "", bytes = 0;
  for (const character of line) {
    const length = new TextEncoder().encode(character).length;
    if (bytes + length > 75) { result += "\r\n "; bytes = 1; }
    result += character; bytes += length;
  }
  return result;
}
/** Standalone RFC5545 snapshot: no scheduling METHOD, organizer, attendee or invitation. */
export function calendarReminderFile(reminder: CalendarReminder, cancel = false, now = new Date()): string {
  const description = `Rappel choisi à ${reminder.time} (${reminder.timeZone}), du ${reminder.startDate} au ${reminder.endDate}. ${reminder.days} jours. En cas d’heure doublée, première occurrence. Pour arrêter, supprimez la série dans votre calendrier. Le fichier d’arrêt ne garantit pas sa suppression.`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BRAIZ//Rappel personnel 1//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${reminder.uid}`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`, `SEQUENCE:${cancel ? 1 : 0}`, `DTSTART:${reminder.instants[0]}`, "DURATION:PT5M", ...(reminder.instants.length > 1 ? [`RDATE:${reminder.instants.slice(1).join(",")}`] : []), "SUMMARY:Votre mot du jour — BRAIZ", `DESCRIPTION:${escapeCalendarText(description)}`, "URL:https://braiz.io/", "TRANSP:TRANSPARENT", `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`, ...(!cancel ? ["BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0S", "DESCRIPTION:Votre mot du jour — BRAIZ", "END:VALARM"] : []), "END:VEVENT", "END:VCALENDAR"];
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
function validReminder(value: unknown): value is CalendarReminder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as CalendarReminder;
  if (Object.keys(item).sort().join(",") !== ["version", "uid", "startDate", "endDate", "time", "timeZone", "days", "instants", "createdAt", "cancelled"].sort().join(",") || item.version !== 1 || typeof item.cancelled !== "boolean" || typeof item.uid !== "string" || !/^braiz-[A-Za-z0-9-]{1,80}@braiz\.io$/.test(item.uid) || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) || !Array.isArray(item.instants)) return false;
  try {
    const regenerated = createCalendarReminder(item, item.uid.slice(6, -9), new Date(item.createdAt));
    return item.endDate === regenerated.endDate && item.instants.length === regenerated.instants.length && item.instants.every((instant, index) => instant === regenerated.instants[index]);
  } catch { return false; }
}
export function readCalendarReminder(storage: Pick<Storage, "getItem">): ReminderRead {
  try {
    const raw = storage.getItem(CALENDAR_REMINDER_KEY);
    if (raw === null) return { status: "ready", reminder: null };
    if (new TextEncoder().encode(raw).length > 16000) return { status: "unavailable" };
    const reminder: unknown = JSON.parse(raw);
    return validReminder(reminder) ? { status: "ready", reminder } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export function writeCalendarReminder(storage: ReminderStorage, reminder: CalendarReminder): boolean {
  const current = readCalendarReminder(storage);
  if (current.status === "unavailable" || !validReminder(reminder) || current.reminder && !current.reminder.cancelled && current.reminder.uid !== reminder.uid) return false;
  try { const raw = JSON.stringify(reminder); storage.setItem(CALENDAR_REMINDER_KEY, raw); return storage.getItem(CALENDAR_REMINDER_KEY) === raw; }
  catch { return false; }
}
