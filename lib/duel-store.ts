import type { GuestSession } from "./server-store";
import type { WordEvaluation } from "./game-contracts";
import { tokenHash } from "./server-security";
import { compareRound, roundFacts, type DuelGuess } from "./duel-rules";
type Duel = { id: string; host_id: string; opponent_id: string | null; targets: string; rules: string; state: string; invite_expires: number; deadline: number | null; forfeiter: string | null };
const ACTIVE = "EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=? AND s.revoked=0 AND s.expires_at>?)";
export class DuelStore {
  constructor(private db: D1Database) {}
  async list(guest: string) { return (await this.db.prepare("SELECT id,state,deadline,invite_expires FROM braise_duels WHERE host_id=? OR opponent_id=? ORDER BY created_at DESC LIMIT 50").bind(guest, guest).all()).results; }
  async get(guest: string, id: string) { return this.db.prepare("SELECT * FROM braise_duels WHERE id=? AND (host_id=? OR opponent_id=?)").bind(id, guest, guest).first<Duel>(); }
  async create(session: GuestSession, id: string, token: string, targets: number[], now = Date.now()) {
    if (targets.length !== 3 || new Set(targets).size !== 3 || targets.some(target => !Number.isInteger(target) || target < 0 || target >= 120)) throw new Error("invalid-targets");
    await this.db.prepare(`INSERT OR IGNORE INTO braise_duels (id,host_id,token_hash,targets,rules,state,created_at,invite_expires)
      SELECT ?,?,?,?,'duel-v1','pending',?,? WHERE ${ACTIVE}
      AND (SELECT count(*) FROM braise_duels quota WHERE (host_id=? OR opponent_id=?) AND ((state='pending' AND invite_expires>?) OR (state='active' AND deadline>? AND (SELECT count(*) FROM (SELECT guest_id,round FROM braise_duel_guesses WHERE duel_id=quota.id GROUP BY guest_id,round HAVING max(found)=1 OR count(*)=30))<6)))<10`).bind(id, session.guest_id, await tokenHash(token), JSON.stringify(targets), now, now + 7 * 86400000, session.token_hash, session.guest_id, now, session.guest_id, session.guest_id, now, now).run();
    return this.get(session.guest_id, id);
  }
  async accept(session: GuestSession, token: string, now = Date.now()) {
    const hash = await tokenHash(token);
    await this.db.prepare(`UPDATE braise_duels SET opponent_id=?,state='active',deadline=? WHERE token_hash=? AND state='pending' AND opponent_id IS NULL AND host_id<>? AND invite_expires>? AND ${ACTIVE}
      AND (SELECT count(*) FROM braise_duels quota WHERE (host_id=? OR opponent_id=?) AND ((state='pending' AND invite_expires>?) OR (state='active' AND deadline>? AND (SELECT count(*) FROM (SELECT guest_id,round FROM braise_duel_guesses WHERE duel_id=quota.id GROUP BY guest_id,round HAVING max(found)=1 OR count(*)=30))<6)))<10`).bind(session.guest_id, now + 48 * 3600000, hash, session.guest_id, now, session.token_hash, session.guest_id, now, session.guest_id, session.guest_id, now, now).run();
    return this.db.prepare(`SELECT id FROM braise_duels WHERE token_hash=? AND opponent_id=? AND ${ACTIVE}`).bind(hash, session.guest_id, session.token_hash, session.guest_id, now).first<{ id: string }>();
  }
  async end(session: GuestSession, id: string, forfeit: boolean, now = Date.now()) {
    if (forfeit) {
      await this.db.prepare(`UPDATE braise_duels SET state='forfeit',forfeiter=? WHERE id=? AND state='active' AND deadline>? AND (host_id=? OR opponent_id=?) AND ${ACTIVE}
        AND (SELECT count(*) FROM (SELECT guest_id,round FROM braise_duel_guesses WHERE duel_id=? GROUP BY guest_id,round HAVING max(found)=1 OR count(*)=30))<6`).bind(session.guest_id, id, now, session.guest_id, session.guest_id, session.token_hash, session.guest_id, now, id).run();
    } else await this.db.prepare(`UPDATE braise_duels SET state='cancelled' WHERE id=? AND host_id=? AND state='pending' AND ${ACTIVE}`).bind(id, session.guest_id, session.token_hash, session.guest_id, now).run();
  }
  async submit(session: GuestSession, id: string, round: number, revision: number, requestId: string, evaluation: WordEvaluation, now = Date.now()) {
    const prior = await this.db.prepare("SELECT word,round FROM braise_duel_guesses WHERE duel_id=? AND guest_id=? AND request_id=?").bind(id, session.guest_id, requestId).first<{ word: string; round: number }>();
    if (prior) return prior.word === evaluation.word && prior.round === round ? "replayed" : "conflict";
    const result = await this.db.prepare(`INSERT OR IGNORE INTO braise_duel_guesses (id,duel_id,guest_id,round,request_id,word,ordinal,temperature,rank,found,accepted_at)
      SELECT ?,d.id,?,?,?,?,?,?,?,?,? FROM braise_duels d WHERE d.id=? AND d.state='active' AND d.deadline>? AND (d.host_id=? OR d.opponent_id=?) AND ${ACTIVE}
      AND (SELECT count(*) FROM braise_duel_guesses WHERE duel_id=d.id AND guest_id=? AND round=?)=?
      AND ?<30 AND NOT EXISTS (SELECT 1 FROM braise_duel_guesses WHERE duel_id=d.id AND guest_id=? AND round=? AND found=1)`).bind(crypto.randomUUID(), session.guest_id, round, requestId, evaluation.word, revision + 1, Math.round(evaluation.temperature * 10000), evaluation.rank, evaluation.found ? 1 : 0, now, id, now, session.guest_id, session.guest_id, session.token_hash, session.guest_id, now, session.guest_id, round, revision, revision, session.guest_id, round).run();
    if (result.meta.changes) return "accepted";
    const replay = await this.db.prepare("SELECT word,round FROM braise_duel_guesses WHERE duel_id=? AND guest_id=? AND request_id=?").bind(id, session.guest_id, requestId).first<{ word: string; round: number }>();
    return replay?.word === evaluation.word && replay.round === round ? "replayed" : "conflict";
  }
  async view(guest: string, id: string, now = Date.now()) {
    // One SQL snapshot includes lifecycle and accepted facts.
    const row = await this.db.prepare(`SELECT d.*, (SELECT json_group_array(json_object('guest_id',g.guest_id,'round',g.round,'word',g.word,'ordinal',g.ordinal,'temperature',g.temperature/10000.0,'rank',g.rank,'found',g.found)) FROM (SELECT * FROM braise_duel_guesses WHERE duel_id=d.id ORDER BY round,ordinal) g) AS facts FROM braise_duels d WHERE d.id=? AND (d.host_id=? OR d.opponent_id=?)`).bind(id, guest, guest).first<Duel & { facts: string }>();
    if (!row) return null;
    const guesses = JSON.parse(row.facts) as DuelGuess[];
    const rounds = [0, 1, 2].map(round => ({ host: roundFacts(guesses, row.host_id, round), opponent: roundFacts(guesses, row.opponent_id ?? "", round) }));
    const closed = row.state === "forfeit" || (row.state === "active" && ((row.deadline ?? 0) <= now || rounds.every(round => round.host.closed && round.opponent.closed)));
    const state = row.state === "pending" && row.invite_expires <= now ? "expired" : closed ? "finished" : row.state;
    const decisions = closed ? rounds.map(round => compareRound(round.host, round.opponent)) : null;
    return { id: row.id, state, rules: row.rules, deadline: row.deadline, inviteExpires: row.invite_expires, role: guest === row.host_id ? "host" : "opponent", forfeiter: row.forfeiter === null ? null : row.forfeiter === row.host_id ? "host" : "opponent", guesses: guesses.filter(guess => guess.guest_id === guest).map(({ guest_id: _guest, ...guess }) => guess), rounds: closed ? rounds : rounds.map(round => ({ own: guest === row.host_id ? round.host : round.opponent })), decisions };
  }
}
