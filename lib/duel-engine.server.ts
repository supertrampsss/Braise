// Server only: target identities and corpus readers never enter the browser graph.
import {evaluateWord,findWord,legacyTargetWord} from './semantic';
import {evaluateWord2vec,word2vecAvailable,word2vecTargets} from './word2vec.server';
import {DUEL_WORD2VEC_RULES} from './duel-presentation';
type Edition={rules:string;targets:string};
export function duelTargetWord(duel:Edition,round:number):string {
 const targets=JSON.parse(duel.targets) as unknown[];
 if(!Number.isInteger(round)||round<0||round>2||targets.length!==3)throw new Error('invalid-duel-targets');
 const target=targets[round];
 if(duel.rules==='duel-v1'&&Number.isInteger(target)&&Number(target)>=0&&Number(target)<120)return legacyTargetWord(Number(target));
 if(duel.rules===DUEL_WORD2VEC_RULES&&typeof target==='string'&&word2vecAvailable(target))return target;
 throw new Error('unsupported-duel-edition');
}
export async function evaluateDuelWord(duel:Edition,round:number,word:string){
 const target=duelTargetWord(duel,round);
 if(duel.rules===DUEL_WORD2VEC_RULES)return evaluateWord2vec(target,word);
 const id=findWord(word);return id===undefined?null:evaluateWord((JSON.parse(duel.targets) as number[])[round],id);
}
export async function newDuelTargets(excluded:readonly string[]=[]){
 const available=word2vecTargets.filter(word=>!excluded.includes(word)),selected:string[]=[];
 if(available.length<3)throw new Error('duel-targets-unavailable');
 while(selected.length<3){const at=crypto.getRandomValues(new Uint32Array(1))[0]%available.length;selected.push(available.splice(at,1)[0]);}
 for(const word of selected)await evaluateWord2vec(word,word);
 return selected;
}
