// No semantic data: shared Paris calendar helpers remain cheap to import.
export function parisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}

export function nextParisMidnight(now = new Date()) {
  // Preserve the V1 search and its one-second precision, including DST days.
  const today = parisDate(now);
  let lo = now.getTime(); let hi = lo + 27 * 3600000;
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (parisDate(new Date(mid)) === today) lo = mid; else hi = mid; }
  return new Date(Math.ceil(hi / 1000) * 1000).toISOString();
}
