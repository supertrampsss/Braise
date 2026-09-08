// Server only. Never import into a client component.
import { EXPEDITIONS, type ExpeditionStatus } from "./expeditions";
import { getPuzzle, evaluateWord, findWord } from "./semantic";

const STEPS: Record<string, readonly string[]> = {
  "sous-bois-v1": ["1700000049", "1700000121", "1700000029"],
  "fourneaux-v1": ["1700000008", "1700000076", "1700000066"],
  "depart-v1": ["1700000578", "1700000235", "1700000048"],
  "interieur-v1": ["1700000079", "1700000063", "1700000016"],
  "scene-v1": ["1700000135", "1700000000", "1700000200"],
  "horizon-v1": ["1700000105", "1700000137", "1700000062"],
};

export async function expeditionStatus(id: unknown, proofs: unknown): Promise<ExpeditionStatus> {
  const edition = EXPEDITIONS.find(item => item.id === id);
  if (!edition || !Array.isArray(proofs) || proofs.length > edition.length || !proofs.every(word => typeof word === "string" && word.length <= 50)) throw new Error("invalid-expedition");
  const steps = STEPS[edition.id];
  for (let i = 0; i < proofs.length; i++) {
    const word = findWord(proofs[i]);
    if (word === undefined || !(await evaluateWord(getPuzzle("challenge", steps[i]).targetIndex, word)).found) throw new Error("invalid-proof");
  }
  const completed = proofs.length;
  return { id: edition.id, completed, length: edition.length,
    ...(completed === edition.length ? { reward: `expedition:${edition.id}:completed` } : { seed: steps[completed] }) };
}
