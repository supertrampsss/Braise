import type {GuestSession} from './server-store';
import type {WordEvaluation} from './game-contracts';
import {tokenHash} from './server-security';
import {compareRound,roundFacts,type DuelGuess} from './duel-rules';
import {duelTargetWord} from './duel-engine.server';
import {DUEL_WORD2VEC_RULES,duelOutcome} from './duel-presentation';
import {WORD2VEC_SIZE} from './word2vec-contract';

type Duel={id:string;host_id:string;opponent_id:string|null;token_hash:string;targets:string;rules:string;state:string;created_at:number;invite_expires:number;deadline:number|null;forfeiter:string|null};
type Snapshot=Duel&{hostName:string;opponentName:string|null;facts:string;parent_id:string|null;invitee_id:string|null};
const ACTIVE='EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=? AND s.revoked=0 AND s.expires_at>?)';
const GUESSES='(SELECT * FROM braise_duel_guesses UNION ALL SELECT * FROM braise_duel_guesses_v2)';
const complete=(alias:string)=>`(SELECT count(*) FROM (SELECT guest_id,round FROM ${GUESSES} WHERE duel_id=${alias}.id GROUP BY guest_id,round HAVING max(found)=1 OR count(*)=30))`;
const quota=`(SELECT count(*) FROM braise_duels quota WHERE (host_id=? OR opponent_id=?) AND ((state='pending' AND invite_expires>?) OR (state='active' AND deadline>? AND ${complete('quota')}<6)))<10`;
const SNAPSHOT=`SELECT d.*, (SELECT name FROM braise_guests WHERE id=d.host_id) AS hostName,
 (SELECT name FROM braise_guests WHERE id=coalesce(d.opponent_id,rm.invitee_id)) AS opponentName,rm.parent_id,rm.invitee_id,
 (SELECT json_group_array(json_object('guest_id',g.guest_id,'round',g.round,'word',g.word,'ordinal',g.ordinal,'temperature',g.temperature/10000.0,'rank',g.rank,'found',g.found)) FROM (SELECT * FROM ${GUESSES} WHERE duel_id=d.id ORDER BY round,ordinal) g) AS facts
 FROM braise_duels d LEFT JOIN braise_duel_rematches rm ON rm.duel_id=d.id`;
const ACCESS="(d.host_id=? OR d.opponent_id=? OR (d.state='pending' AND rm.invitee_id=?))";

function project(row:Snapshot,guest:string,now:number){
 const guesses=JSON.parse(row.facts) as DuelGuess[];
 const facts=[0,1,2].map(round=>({host:roundFacts(guesses,row.host_id,round),opponent:roundFacts(guesses,row.opponent_id??'',round)}));
 const terminal=row.state==='forfeit'||row.state==='active'&&((row.deadline??0)<=now||facts.every(f=>f.host.closed&&f.opponent.closed));
 const state=row.state==='pending'&&row.invite_expires<=now?'expired':terminal?'finished':row.state;
 const host=guest===row.host_id,role=host?'host':'opponent';
 const rounds=facts.map((fact,round)=>{
  const revealed=terminal||row.state==='active'&&fact.host.closed&&fact.opponent.closed;
  return {own:{...(host?fact.host:fact.opponent),closed:terminal||(host?fact.host:fact.opponent).closed},
   opponent:row.opponent_id?{...(host?fact.opponent:fact.host),closed:terminal||(host?fact.opponent:fact.host).closed}:null,
   revealed,...(revealed?{answer:duelTargetWord(row,round)}:{}),decision:revealed?compareRound(fact.host,fact.opponent):null};
 });
 const publicGuess=({round,word,ordinal,temperature,rank,found}:DuelGuess)=>({round,word,ordinal,temperature,rank,found});
 const decisions=terminal?facts.map(f=>compareRound(f.host,f.opponent)):null;
 const score={won:0,lost:0,drawn:0};for(const round of rounds)if(round.decision!==null){if(round.decision===0)score.drawn++;else if(round.decision===(host?-1:1))score.won++;else score.lost++;}
 return {id:row.id,hostName:row.hostName,opponentName:row.opponentName,state,rules:row.rules,vocabularySize:row.rules===DUEL_WORD2VEC_RULES?WORD2VEC_SIZE:30000,
  deadline:row.deadline,inviteExpires:row.invite_expires,role,forfeiter:row.forfeiter===null?null:row.forfeiter===row.host_id?'host':'opponent',
  guesses:guesses.filter(g=>g.guest_id===guest).map(publicGuess),
  opponentGuesses:guesses.filter(g=>g.guest_id!==guest&&rounds[g.round]?.revealed).map(publicGuess),rounds,decisions,score,
  rematchOf:row.parent_id,canAcceptRematch:state==='pending'&&row.invitee_id===guest};
}

export class DuelStore {
 constructor(private db:D1Database){}
 async list(guest:string,now=Date.now()){
  const rows=await this.db.prepare(`${SNAPSHOT} WHERE ${ACCESS} ORDER BY d.created_at DESC LIMIT 50`).bind(guest,guest,guest).all<Snapshot>();
  return rows.results.map(row=>{const view=project(row,guest,now);return {id:row.id,hostName:view.hostName,opponentName:view.opponentName,role:view.role,result:duelOutcome(view)?.title??null,created_at:row.created_at,state:view.state,abandoned:row.state==='forfeit'?1:0,deadline:row.deadline,invite_expires:row.invite_expires,score:view.score,canAcceptRematch:view.canAcceptRematch,rematchOf:row.parent_id};});
 }
 async get(guest:string,id:string){return this.db.prepare(`${SNAPSHOT} WHERE d.id=? AND ${ACCESS}`).bind(id,guest,guest,guest).first<Snapshot>();}
 async create(session:GuestSession,id:string,token:string,targets:readonly(number|string)[],now=Date.now(),options:{rules?:string;parentId?:string;inviteeId?:string}={}){
  const rules=options.rules??'duel-v1';
  if(targets.length!==3||new Set(targets).size!==3||!['duel-v1',DUEL_WORD2VEC_RULES].includes(rules)||targets.some(target=>rules==='duel-v1'?typeof target!=='number'||!Number.isInteger(target)||target<0||target>=120:typeof target!=='string'||target.length>100))throw new Error('invalid-targets');
  const hash=await tokenHash(token);
  const statements=[this.db.prepare(`INSERT OR IGNORE INTO braise_duels(id,host_id,token_hash,targets,rules,state,created_at,invite_expires)
   SELECT ?,?,?,?,?,'pending',?,? WHERE ${ACTIVE} AND ${quota}`).bind(id,session.guest_id,hash,JSON.stringify(targets),rules,now,now+7*86400000,session.token_hash,session.guest_id,now,session.guest_id,session.guest_id,now,now)];
  if(options.parentId&&options.inviteeId)statements.push(this.db.prepare(`INSERT OR IGNORE INTO braise_duel_rematches(duel_id,parent_id,invitee_id) SELECT id,?,? FROM braise_duels WHERE id=? AND host_id=? AND token_hash=? AND state='pending' AND ${ACTIVE}`).bind(options.parentId,options.inviteeId,id,session.guest_id,hash,session.token_hash,session.guest_id,now));
  await this.db.batch(statements);return this.get(session.guest_id,id);
 }
 private async acceptWhere(session:GuestSession,condition:string,values:string[],now:number){
  const allowed="NOT EXISTS (SELECT 1 FROM braise_duel_rematches r WHERE r.duel_id=d.id AND r.invitee_id<>?)";
  await this.db.prepare(`UPDATE braise_duels AS d SET opponent_id=?,state='active',deadline=? WHERE ${condition} AND state='pending' AND opponent_id IS NULL AND host_id<>? AND invite_expires>? AND ${allowed} AND ${ACTIVE} AND ${quota}`).bind(session.guest_id,now+48*3600000,...values,session.guest_id,now,session.guest_id,session.token_hash,session.guest_id,now,session.guest_id,session.guest_id,now,now).run();
  return this.db.prepare(`SELECT id FROM braise_duels d WHERE ${condition} AND opponent_id=? AND ${ACTIVE}`).bind(...values,session.guest_id,session.token_hash,session.guest_id,now).first<{id:string}>();
 }
 async accept(session:GuestSession,token:string,now=Date.now()){return this.acceptWhere(session,'token_hash=?',[await tokenHash(token)],now);}
 async acceptRematch(session:GuestSession,id:string,now=Date.now()){
  return this.acceptWhere(session,'d.id=? AND EXISTS (SELECT 1 FROM braise_duel_rematches r WHERE r.duel_id=d.id AND r.invitee_id=?)',[id,session.guest_id],now);
 }
 async rematch(session:GuestSession,parentId:string,id:string,token:string,targets:string[],now=Date.now()){
  const parent=await this.get(session.guest_id,parentId);if(!parent||!parent.opponent_id||project(parent,session.guest_id,now).state!=='finished')return null;
  const previous=[0,1,2].map(round=>duelTargetWord(parent,round));if(targets.some(word=>previous.includes(word)))return null;
  const inviteeId=parent.host_id===session.guest_id?parent.opponent_id:parent.host_id;
  return this.create(session,id,token,targets,now,{rules:DUEL_WORD2VEC_RULES,parentId,inviteeId});
 }
 async end(session:GuestSession,id:string,forfeit:boolean,now=Date.now()){
  if(forfeit)await this.db.prepare(`UPDATE braise_duels AS d SET state='forfeit',forfeiter=? WHERE id=? AND state='active' AND deadline>? AND (host_id=? OR opponent_id=?) AND ${ACTIVE} AND ${complete('d')}<6`).bind(session.guest_id,id,now,session.guest_id,session.guest_id,session.token_hash,session.guest_id,now).run();
  else await this.db.prepare(`UPDATE braise_duels SET state='cancelled' WHERE id=? AND host_id=? AND state='pending' AND ${ACTIVE}`).bind(id,session.guest_id,session.token_hash,session.guest_id,now).run();
 }
 async submit(session:GuestSession,id:string,round:number,revision:number,requestId:string,evaluation:WordEvaluation,now=Date.now()){
  const duel=await this.get(session.guest_id,id);if(!duel)return 'conflict';
  const table=duel.rules===DUEL_WORD2VEC_RULES?'braise_duel_guesses_v2':'braise_duel_guesses';
  const prior=await this.db.prepare(`SELECT word,round FROM ${table} WHERE duel_id=? AND guest_id=? AND request_id=?`).bind(id,session.guest_id,requestId).first<{word:string;round:number}>();
  if(prior)return prior.word===evaluation.word&&prior.round===round?'replayed':'conflict';
  const result=await this.db.prepare(`INSERT OR IGNORE INTO ${table}(id,duel_id,guest_id,round,request_id,word,ordinal,temperature,rank,found,accepted_at)
   SELECT ?,d.id,?,?,?,?,?,?,?,?,? FROM braise_duels d WHERE d.id=? AND d.state='active' AND d.deadline>? AND (d.host_id=? OR d.opponent_id=?) AND ${ACTIVE}
   AND (SELECT count(*) FROM ${table} WHERE duel_id=d.id AND guest_id=? AND round=?)=? AND ?<30
   AND NOT EXISTS (SELECT 1 FROM ${table} WHERE duel_id=d.id AND guest_id=? AND round=? AND found=1)`).bind(crypto.randomUUID(),session.guest_id,round,requestId,evaluation.word,revision+1,Math.round(evaluation.temperature*10000),evaluation.rank,evaluation.found?1:0,now,id,now,session.guest_id,session.guest_id,session.token_hash,session.guest_id,now,session.guest_id,round,revision,revision,session.guest_id,round).run();
  if(result.meta.changes)return 'accepted';
  const replay=await this.db.prepare(`SELECT word,round FROM ${table} WHERE duel_id=? AND guest_id=? AND request_id=?`).bind(id,session.guest_id,requestId).first<{word:string;round:number}>();
  return replay?.word===evaluation.word&&replay.round===round?'replayed':'conflict';
 }
 async view(guest:string,id:string,now=Date.now()){const row=await this.get(guest,id);return row?project(row,guest,now):null;}
}
