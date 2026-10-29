import test from "node:test";
import assert from "node:assert/strict";
import { createCalendarReminder, calendarReminderFile, foldCalendarLine, escapeCalendarText, readCalendarReminder, writeCalendarReminder } from "../lib/calendar-reminder";

const now = new Date("2026-10-12T12:00:00Z");
const options = { startDate: "2026-10-24", time: "19:00", timeZone: "Europe/Paris", days: 3 };
test("bounded RDATE recurrence keeps local time through Paris autumn DST", () => {
  const reminder = createCalendarReminder(options, "test-id", now);
  assert.deepEqual(reminder.instants, ["20261024T170000Z", "20261025T180000Z", "20261026T180000Z"]);
  assert.equal(reminder.endDate, "2026-10-26");
  const content = calendarReminderFile(reminder, false, now);
  assert.match(content, /DTSTART:20261024T170000Z\r\n/);
  assert.match(content, /RDATE:20261025T180000Z,20261026T180000Z/);
  assert.doesNotMatch(content, /RRULE|TZID|ORGANIZER|ATTENDEE|METHOD:/);
  assert.match(content, /BEGIN:VALARM/); assert.match(content, /TRIGGER:PT0S/);
});
test("spring DST, fractional timezone and ambiguous wall time have deterministic exact instants", () => {
  assert.deepEqual(createCalendarReminder({ ...options, startDate: "2027-03-27", days: 2 }, "spring", now).instants, ["20270327T180000Z", "20270328T170000Z"]);
  assert.deepEqual(createCalendarReminder({ ...options, timeZone: "Asia/Kathmandu", days: 1 }, "fraction", now).instants, ["20261024T131500Z"]);
  assert.deepEqual(createCalendarReminder({ ...options, startDate: "2026-10-25", time: "02:30", days: 1 }, "overlap", now).instants, ["20261025T003000Z"]);
  assert.throws(() => createCalendarReminder({ ...options, startDate: "2027-03-28", time: "02:30", days: 1 }, "gap", now), /existe pas/);
});
test("calendar input rejects invalid IANA zones, injection, impossible dates and unbounded horizons", () => {
  for (const change of [{ timeZone: "Fake/Zone" }, { startDate: "2026-02-30" }, { time: "25:00" }, { days: 0 }, { days: 91 }, { days: 2.5 }]) {
    assert.throws(() => createCalendarReminder({ ...options, ...change }, "id", now));
  }
  assert.throws(() => createCalendarReminder(options, "id\r\nATTENDEE:a", now));
});
test("cancellation retains UID and recurrence, increments sequence and removes alarm without sending", () => {
  const reminder = createCalendarReminder(options, "same", now);
  const active = calendarReminderFile(reminder, false, now);
  const cancelled = calendarReminderFile(reminder, true, new Date("2026-10-13T12:00:00Z"));
  assert.equal(active.match(/UID:(.+)\r\n/)?.[1], cancelled.match(/UID:(.+)\r\n/)?.[1]);
  assert.match(active, /SEQUENCE:0/); assert.match(cancelled, /SEQUENCE:1/);
  assert.match(cancelled, /STATUS:CANCELLED/); assert.doesNotMatch(cancelled, /VALARM/);
  assert.equal(active.match(/RDATE:(.+)\r\n/)?.[1], cancelled.match(/RDATE:(.+)\r\n/)?.[1]);
  for (const content of [active, cancelled]) assert.doesNotMatch(content, /(?:^|\r\n)(?:METHOD|ORGANIZER|ATTENDEE):/);
});
test("RFC content uses CRLF, escaped TEXT and UTF8 folding at 75 octets without broken code points", () => {
  const line = "DESCRIPTION:" + "Été 🔥, ligne;\\\n".repeat(30);
  const escaped = escapeCalendarText("a,b;c\\d\r\ne"); assert.equal(escaped, "a\\,b\\;c\\\\d\\ne");
  const folded = foldCalendarLine(line.replace(/\n/g, "\\n"));
  assert.equal(folded.replace(/\r\n /g, ""), line.replace(/\n/g, "\\n"));
  for (const part of folded.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
  const content = calendarReminderFile(createCalendarReminder(options, "utf", now), false, now);
  assert.doesNotMatch(content.replace(/\r\n/g, ""), /[\r\n]/);
  for (const part of content.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
});
test("local reminder receipt restores silently, preserves incompatible storage and cancellation identities", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const reminder = createCalendarReminder(options, "stored", now);
  assert.equal(writeCalendarReminder(storage, reminder), true);
  assert.deepEqual(readCalendarReminder(storage), { status: "ready", reminder });
  assert.equal(writeCalendarReminder(storage, { ...reminder, cancelled: true }), true);
  const cancelled = readCalendarReminder(storage); assert.equal(cancelled.status, "ready");
  assert.equal(cancelled.status === "ready" && cancelled.reminder?.uid, reminder.uid);
  const key = [...values.keys()][0]; values.set(key, '{"version":99}');
  assert.equal(readCalendarReminder(storage).status, "unavailable");
  assert.equal(writeCalendarReminder(storage, reminder), false); assert.equal(values.get(key), '{"version":99}');
});
test("a second tab cannot overwrite another prepared reminder and malformed receipts are preserved", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createCalendarReminder(options, "first", now);
  const second = createCalendarReminder(options, "second", now);
  assert.equal(writeCalendarReminder(storage, first), true);
  assert.equal(writeCalendarReminder(storage, second), false);
  assert.deepEqual(readCalendarReminder(storage), { status: "ready", reminder: first });
  assert.equal(writeCalendarReminder(storage, { ...first, cancelled: true }), true);
  assert.equal(writeCalendarReminder(storage, second), true);
  assert.equal(writeCalendarReminder(storage, { ...first, cancelled: true }), false);
  const key = [...values.keys()][0];
  for (const raw of ["{", JSON.stringify({ ...second, instants: ["20261024T180000Z"] }), JSON.stringify({ ...second, arbitrary: true }), JSON.stringify({ ...second, days: 1000000 })]) {
    values.set(key, raw); assert.equal(readCalendarReminder(storage).status, "unavailable");
    assert.equal(writeCalendarReminder(storage, first), false); assert.equal(values.get(key), raw);
  }
});
