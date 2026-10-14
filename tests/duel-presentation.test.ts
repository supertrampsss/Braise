import test from 'node:test';
import assert from 'node:assert/strict';
import {duelRound,duelOutcome,invitationToken,type DuelView} from '../lib/duel-presentation';
const view:DuelView={id:'duel',hostName:'A',opponentName:'B',inviteExpires:1000,state:'active',deadline:5000,role:'host',forfeiter:null,decisions:null,guesses:[]};
test('duel proximity orders exact ranks, isolates rounds and never rewrites the saved facts',()=>{
  const data={...view,guesses:[{round:0,word:'route',ordinal:1,rank:281,temperature:23.4,found:0},{round:1,word:'bol',ordinal:1,rank:2,temperature:45.4,found:0},{round:0,word:'chemin',ordinal:2,rank:61,temperature:23.4,found:0},{round:0,word:'taxe',ordinal:3,rank:26000,temperature:9,found:0}]};
  const original=JSON.stringify(data),round=duelRound(data,0,4000);
  assert.deepEqual(round.ordered.map(guess=>guess.word),['chemin','route','taxe']);assert.equal(round.best?.rank,61);assert.equal(round.guesses.length,3);assert.equal(round.closed,false);assert.equal(JSON.stringify(data),original);
});
test('real wins, the attempt cap and the exact deadline close only the relevant round',()=>{
  assert.equal(duelRound(view,0,4999).closed,false);assert.equal(duelRound(view,0,5000).expired,true);
  const guess={round:0,word:'mot',ordinal:1,rank:1,temperature:100,found:1};assert.equal(duelRound({...view,guesses:[guess]},0,4000).won,true);assert.equal(duelRound({...view,guesses:[guess]},1,4000).won,false);
  assert.equal(duelRound({...view,guesses:Array.from({length:30},(_,i)=>({...guess,ordinal:i+1,rank:100+i,found:0}))},0,4000).closed,true);
});
test('duel summary uses server decisions for each role and preserves ties and forfeits',()=>{
  assert.equal(duelOutcome(view),null);assert.deepEqual(duelOutcome({...view,state:'finished',decisions:[-1,0,1]}),{title:'Égalité',note:'1 — 1'});
  assert.equal(duelOutcome({...view,state:'finished',decisions:[-1,-1,1]})!.title,'Duel remporté');assert.equal(duelOutcome({...view,state:'finished',role:'opponent',decisions:[-1,-1,1]})!.title,'Duel perdu');
  assert.equal(duelOutcome({...view,state:'finished',forfeiter:'opponent'})!.title,'Duel remporté');assert.throws(()=>duelOutcome({...view,state:'finished'}),/incomplet/);
});
test('joining accepts the actual private link or its existing token without making up an invitation',()=>{
  const token='a'.repeat(64);assert.equal(invitationToken('https://braiz.io/duels#invitation='+token),token);assert.equal(invitationToken(token),token);assert.equal(invitationToken('bad link'),'bad link');
});
