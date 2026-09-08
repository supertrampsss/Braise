import { isCalendarDate, shiftCalendarDate } from "./calendar";
import { approvedEditorialTargets, validateEditorialCatalogue, type EditorialCatalogue } from "./editorial-catalogue";

export type EditorialCalendar = {
  schemaVersion: 1;
  id: string;
  catalogueId: string;
  catalogueSha256: string;
  corpusVersion: string;
  rulesVersion: "classic-v2";
  timezone: "Europe/Paris";
  status: "inactive" | "active";
  assignments: Array<{ date: string; targetId: number }>;
};

const HASH = /^[0-9a-f]{64}$/;
const stableJson = (value: unknown): string => Array.isArray(value) ? `[${value.map(stableJson).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
async function contentSha256(value: unknown) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value))))); }

export async function createInactiveEditorialCalendar(options: { id: string; catalogue: EditorialCatalogue; catalogueSha256: string; startDate: string; days?: number }) {
  const days = options.days ?? 365;
  const catalogue = validateEditorialCatalogue(options.catalogue, days); const approvedTargetIds = approvedEditorialTargets(catalogue);
  if (catalogue.status !== "ready" || !HASH.test(options.catalogueSha256) || await contentSha256(catalogue) !== options.catalogueSha256 || !Number.isInteger(days) || days < 1 || !isCalendarDate(options.startDate) || approvedTargetIds.length < days || new Set(approvedTargetIds).size !== approvedTargetIds.length) throw new Error("insufficient-approved-targets");
  return validateEditorialCalendar({ schemaVersion: 1, id: options.id, catalogueId: catalogue.id, catalogueSha256: options.catalogueSha256, corpusVersion: catalogue.corpus.id, rulesVersion: "classic-v2", timezone: "Europe/Paris", status: "inactive", assignments: approvedTargetIds.slice(0, days).map((targetId, offset) => ({ date: shiftCalendarDate(options.startDate, offset)!, targetId })) }, catalogue, days);
}

export async function validateEditorialCalendar(value: unknown, sourceCatalogue: EditorialCatalogue, days = 365): Promise<EditorialCalendar> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid-editorial-calendar");
  const calendar = value as EditorialCalendar; const catalogue = validateEditorialCatalogue(sourceCatalogue, days); const approvedTargets = new Set(approvedEditorialTargets(catalogue));
  if (calendar.schemaVersion !== 1 || typeof calendar.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(calendar.id) || calendar.catalogueId !== catalogue.id || calendar.catalogueSha256 !== await contentSha256(catalogue) || calendar.corpusVersion !== catalogue.corpus.id || calendar.rulesVersion !== "classic-v2" || calendar.timezone !== "Europe/Paris" || !["inactive", "active"].includes(calendar.status) || !Array.isArray(calendar.assignments) || calendar.assignments.length !== days) throw new Error("invalid-editorial-calendar");
  const dates = new Set<string>(); const targets = new Set<number>();
  for (let index = 0; index < calendar.assignments.length; index++) {
    const assignment = calendar.assignments[index]; const expected = index === 0 ? assignment.date : shiftCalendarDate(calendar.assignments[index - 1].date, 1);
    if (!isCalendarDate(assignment.date) || assignment.date !== expected || !approvedTargets.has(assignment.targetId) || dates.has(assignment.date) || targets.has(assignment.targetId)) throw new Error("invalid-editorial-assignment");
    dates.add(assignment.date); targets.add(assignment.targetId);
  }
  return calendar;
}
