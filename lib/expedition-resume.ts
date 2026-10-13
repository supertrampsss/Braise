import { EXPEDITIONS, type ExpeditionStatus } from "./expeditions";
import type { SavedGame } from "./game-types";
import type { ClassicEdition } from './word2vec-contract';

// No writes or counters: replay the contiguous prefix of actual saved discoveries.
export async function resumeExpedition(id: string, dependencies: {
  status: (id: string, proofs: string[]) => Promise<ExpeditionStatus>;
  readGame: (id: string) => SavedGame;
  isCurrent: () => boolean;
  edition?: ClassicEdition;
}) {
  const edition = EXPEDITIONS.find(item => item.id === id);
  if (!edition) throw new Error("Parcours inconnu.");
  const proofs: string[] = [];
  let tries = 0; let hints = 0;
  for (let step = 0; step <= edition.length; step++) {
    const status = await dependencies.status(id, [...proofs]);
    if (!dependencies.isCurrent()) return null;
    if (!status.seed) return { status, tries, hints, saved: undefined, edition:undefined };
    const modern=dependencies.readGame(`free-w2v-${status.seed}`);
    const historical=dependencies.readGame(`free-${status.seed}`);
    // Completed proofs belong to the shared journey; edition chooses its open stage.
    const completed=modern.guesses.some(guess=>guess.found)?modern:historical.guesses.some(guess=>guess.found)?historical:null;
    const legacy=completed?completed===historical:dependencies.edition==='classic-v1'||dependencies.edition!=='word2vec-v1'&&!modern.guesses.length&&!modern.pins.length&&(historical.guesses.length>0||historical.pins.length>0||historical.hints>0);
    const saved=legacy?historical:modern;
    const edition=legacy?'classic-v1' as const:'word2vec-v1' as const;
    const found = saved.guesses.find(guess => guess.found);
    if (!found) return { status, tries, hints, saved, edition };
    proofs.push(found.word); tries += saved.guesses.length; hints += saved.hints;
  }
  throw new Error("Le parcours ne correspond plus à son édition.");
}
