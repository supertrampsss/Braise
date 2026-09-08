// Server-only approved choices. Participants never receive the future entry list.
import { COLLECTIONS } from "./collections";
export const STUDIO_TITLES = ["Ma promenade sémantique", "Trois étincelles", "Le grand détour", "Les mots du cercle", "Une pause Braise"] as const;
export const STUDIO_ENTRIES = COLLECTIONS.flatMap(collection => collection.seeds.map((seed, index) => ({ id: `${collection.id}:${index}`, label: `${collection.title} · énigme ${index + 1}`, seed })));
export function validateStudio(title: unknown, entries: unknown): entries is string[] {
  return typeof title === "string" && STUDIO_TITLES.some(item => item === title) && Array.isArray(entries) && entries.length >= 1 && entries.length <= 12 && new Set(entries).size === entries.length && entries.every(id => typeof id === "string" && STUDIO_ENTRIES.some(item => item.id === id));
}
