import { nextParisMidnight } from './calendar';
import { WORD2VEC_START, word2vecRef } from './word2vec-contract';
import { getLegacyPuzzle } from './legacy-puzzles';
import { evaluateWord2vec, word2vecHint, word2vecTargets, word2vecLegacyTargets, word2vecMetadata } from './word2vec.server';
import type { Mode, Puzzle } from './game-types';
export function dailyWord2vecTarget(date:string){
  if(date===WORD2VEC_START)return 'assiette';
  let hash=2166136261;for(const character of `paris-daily-word2vec-v1:${date}`)hash=Math.imul(hash^character.charCodeAt(0),16777619);
  return word2vecTargets[(hash>>>0)%word2vecTargets.length];
}
export async function openWord2vec(mode:Mode,seed:string,date:string,now:Date){
  const daily=mode==='daily'||mode==='archive';
  const legacy=daily?undefined:getLegacyPuzzle(mode,seed,now);
  const targetWord=daily?dailyWord2vecTarget(date):word2vecLegacyTargets[legacy!.legacyIndex];
  // A GET confirms that the exact immutable target column can be read.
  await evaluateWord2vec(targetWord,targetWord);
  const id=daily?`daily-w2v-${date}`:`free-w2v-${seed}`;
  const publicPuzzle:Puzzle={id,mode,seed:daily?date:seed,date,number:daily?Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-09-07T00:00:00Z'))/86400000)+1:legacy!.legacyIndex+1,vocabularySize:word2vecMetadata.vocabularySize,resetAt:nextParisMidnight(now),ref:word2vecRef(id,mode)};
  return {publicPuzzle,targetWord,requiresVersion:true,evaluate:(word:string)=>evaluateWord2vec(targetWord,word),hint:(level:number,guesses:string[],_bestWord?:string)=>word2vecHint(targetWord,level,guesses),close(){}};
}
