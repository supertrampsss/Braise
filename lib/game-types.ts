import type { PuzzleRef, WordEvaluation } from "./game-contracts";
export type Mode = "daily" | "archive" | "free" | "challenge";
export type Guess = WordEvaluation & { hint?: boolean; order: number; acceptedAt?: string };
export type Puzzle = { id: string; mode: Mode; seed: string; date: string; number: number; vocabularySize: number; resetAt: string; ref: PuzzleRef };
export type SavedGame = { guesses: Guess[]; pins: string[]; hints: number; startedAt: number; solvedAt?: number; completedMode?: Mode; profileV2StartIndex?: number };
export type Win = { id: string; date: string; mode: Mode; tries: number; hints: number; completedAt?: string };
export type Profile = { wins: Win[]; guesses: number; sound: boolean };
export function warmth(temperature: number) {
  if (temperature >= 100) return { label: "Trouvé !", color: "#bddd8a", emoji: "✨" };
  if (temperature >= 55) return { label: "Ça brûle !", color: "#ff754d", emoji: "🔥" };
  if (temperature >= 35) return { label: "Ça chauffe", color: "#f7b665", emoji: "☀️" };
  if (temperature >= 18) return { label: "Une petite étincelle", color: "#c4c5b7", emoji: "🌤️" };
  return { label: "Encore froid", color: "#89b9df", emoji: "❄️" };
}
export function getStreak(wins: Win[], today: string) {
  const days = new Set(wins.filter(w => w.mode === "daily").map(w => w.date));
  let cursor = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}
