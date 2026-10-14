import { z } from 'zod';
import { WORD2VEC_SIZE, isWord2vecRef, word2vecDate, word2vecRef } from './word2vec-contract';
import type { SavedGame } from './game-types';
const guess=z.object({word:z.string().min(1).max(50),temperature:z.number().min(-100).max(100),rank:z.number().int().min(1).max(WORD2VEC_SIZE),found:z.boolean(),order:z.number().int().min(1).max(3000),hint:z.boolean().optional(),acceptedAt:z.string().datetime().optional()}).strict();
export const word2vecGameSchema=z.object({guesses:z.array(guess).max(3000),pins:z.array(z.string().min(1).max(50)).max(3),hints:z.number().int().min(0).max(3),startedAt:z.number().int().nonnegative(),solvedAt:z.number().int().nonnegative().optional(),completedMode:z.enum(['daily','archive','free','challenge']).optional(),profileV2StartIndex:z.number().int().nonnegative().optional()}).strict();
const document=z.object({schemaVersion:z.literal(3),puzzleRef:z.custom<import('./game-contracts').PuzzleRef>(isWord2vecRef),game:word2vecGameSchema}).strict();
export function parseWord2vecDocument(value:unknown,id:string):SavedGame|null{
  const result=document.safeParse(value);if(!result.success||result.data.puzzleRef.id!==id)return null;
  const game=result.data.game;
  if(game.hints!==game.guesses.filter(g=>g.hint).length||new Set(game.guesses.map(g=>g.word)).size!==game.guesses.length||new Set(game.guesses.map(g=>g.order)).size!==game.guesses.length||(game.profileV2StartIndex??0)>game.guesses.length||game.guesses.some(g=>g.found?(g.temperature!==100||g.rank!==1):(g.temperature>=100||g.rank===1)))return null;
  return game;
}
export function word2vecDocument(id:string,game:SavedGame){const value={schemaVersion:3,puzzleRef:word2vecRef(id,word2vecDate(id)?'daily':'free'),game};if(!parseWord2vecDocument(value,id))throw new Error('word2vec-save-invalid');return value;}
