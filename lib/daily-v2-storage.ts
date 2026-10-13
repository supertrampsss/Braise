import { z } from 'zod';
import { DAILY_V2_DICTIONARY_SIZE, dailyV2Date, dailyV2Ref, isDailyV2Ref } from './daily-v2-contract';
import type { SavedGame } from './game-types';
const guess = z.object({ word: z.string().min(1).max(50), temperature: z.number().min(-100).max(100), rank: z.number().int().min(1).max(DAILY_V2_DICTIONARY_SIZE), found: z.boolean(), order: z.number().int().min(1).max(3000), hint: z.boolean().optional(), acceptedAt: z.string().datetime().optional() }).strict();
export const dailyV2GameSchema = z.object({ guesses: z.array(guess).max(3000), pins: z.array(z.string().min(1).max(50)).max(3), hints: z.number().int().min(0).max(3), startedAt: z.number().int().nonnegative(), solvedAt: z.number().int().nonnegative().optional(), completedMode: z.enum(['daily','archive']).optional(), profileV2StartIndex: z.number().int().nonnegative().optional() }).strict();
const document = z.object({ schemaVersion: z.literal(2), puzzleRef: z.unknown(), game: dailyV2GameSchema }).strict();
export function parseDailyV2Document(value: unknown, id: string): SavedGame | null {
  const result = document.safeParse(value);
  if (!result.success || !isDailyV2Ref(result.data.puzzleRef) || result.data.puzzleRef.id !== id) return null;
  const game = result.data.game;
  if (new Set(game.guesses.map(g => g.word)).size !== game.guesses.length || new Set(game.guesses.map(g => g.order)).size !== game.guesses.length || (game.profileV2StartIndex ?? 0) > game.guesses.length) return null;
  return game;
}
export function dailyV2Document(id: string, game: SavedGame) {
  const date = dailyV2Date(id);
  if (!date) throw new Error('daily-v2-save-identity');
  const result = { schemaVersion: 2, puzzleRef: dailyV2Ref(date, 'daily'), game };
  if (!parseDailyV2Document(result, id)) throw new Error('daily-v2-save-invalid');
  return result;
}
