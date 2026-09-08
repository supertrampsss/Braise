import { EXPEDITIONS, type ExpeditionStatus } from "./expeditions";
import type { SavedGame } from "./game-types";

// No writes or counters: replay the contiguous prefix of actual saved discoveries.
export async function resumeExpedition(id: string, dependencies: {
  status: (id: string, proofs: string[]) => Promise<ExpeditionStatus>;
  readGame: (id: string) => SavedGame;
  isCurrent: () => boolean;
}) {
  const edition = EXPEDITIONS.find(item => item.id === id);
  if (!edition) throw new Error("Parcours inconnu.");
  const proofs: string[] = [];
  let tries = 0; let hints = 0;
  for (let step = 0; step <= edition.length; step++) {
    const status = await dependencies.status(id, [...proofs]);
    if (!dependencies.isCurrent()) return null;
    if (!status.seed) return { status, tries, hints, saved: undefined };
    const saved = dependencies.readGame(`free-${status.seed}`);
    const found = saved.guesses.find(guess => guess.found);
    if (!found) return { status, tries, hints, saved };
    proofs.push(found.word); tries += saved.guesses.length; hints += saved.hints;
  }
  throw new Error("Le parcours ne correspond plus à son édition.");
}
