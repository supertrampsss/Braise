import { validateStudioMetadata } from "./studio-metadata";
// Server-only approved choices. Participants never receive the future entry list.
import { COLLECTIONS } from "./collections";
export const STUDIO_TITLES = ["Ma promenade sémantique", "Trois étincelles", "Le grand détour", "Les mots du cercle", "Une pause BRAIZ"] as const;
export const STUDIO_ENTRIES = COLLECTIONS.flatMap(collection => collection.seeds.map((seed, index) => ({ id: `${collection.id}:${index}`, label: `${collection.title} · énigme ${index + 1}`, seed })));
export function validateStudio(title: unknown, entries: unknown, description: unknown = "", visual: unknown = "ember"): entries is string[] {
  return validateStudioMetadata(title, description, visual) && Array.isArray(entries) && entries.length >= 1 && entries.length <= 12 && new Set(entries).size === entries.length && entries.every(id => typeof id === "string" && STUDIO_ENTRIES.some(item => item.id === id));
}
