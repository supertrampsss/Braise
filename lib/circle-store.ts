import type { GuestSession } from "./server-store";
import { tokenHash } from "./server-security";

const ACTIVE = "EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=? AND s.revoked=0 AND s.expires_at>?)";
export class CircleStore {
  constructor(private db: D1Database) {}
  async list(guest: string) {
    return (await this.db.prepare("SELECT c.id,c.name,c.owner_id FROM braise_circles c JOIN braise_circle_members m ON m.circle_id=c.id WHERE m.guest_id=? AND m.state='active' ORDER BY c.created_at DESC LIMIT 50").bind(guest).all()).results;
  }
  async member(guest: string, circle: string) {
    return this.db.prepare("SELECT c.id,c.name,c.owner_id FROM braise_circles c JOIN braise_circle_members m ON m.circle_id=c.id WHERE c.id=? AND m.guest_id=? AND m.state='active'").bind(circle, guest).first<{ id: string; name: string; owner_id: string }>();
  }
  async create(session: GuestSession, id: string, name: string, now = Date.now()) {
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO braise_circles (id,owner_id,name,created_at) SELECT ?,?,?,? WHERE ${ACTIVE} AND (SELECT count(*) FROM braise_circles WHERE owner_id=?)<5`).bind(id, session.guest_id, name, now, session.token_hash, session.guest_id, now, session.guest_id),
      this.db.prepare(`INSERT OR IGNORE INTO braise_circle_members (id,circle_id,guest_id,state,joined_at) SELECT ?,id,owner_id,'active',? FROM braise_circles WHERE id=? AND owner_id=? AND ${ACTIVE}`).bind(crypto.randomUUID(), now, id, session.guest_id, session.token_hash, session.guest_id, now),
    ]);
    return this.member(session.guest_id, id);
  }
  async invite(session: GuestSession, circle: string, token: string, now = Date.now()) {
    const hash = await tokenHash(token);
    const result = await this.db.prepare(`INSERT OR IGNORE INTO braise_circle_invites (token_hash,circle_id,expires_at) SELECT ?,id,? FROM braise_circles WHERE id=? AND owner_id=? AND ${ACTIVE} AND (SELECT count(*) FROM braise_circle_invites WHERE circle_id=? AND revoked=0 AND expires_at>?)<20`).bind(hash, now + 7 * 86400000, circle, session.guest_id, session.token_hash, session.guest_id, now, circle, now).run();
    if (result.meta.changes) return true;
    return Boolean(await this.db.prepare(`SELECT i.token_hash FROM braise_circle_invites i JOIN braise_circles c ON c.id=i.circle_id WHERE i.token_hash=? AND i.circle_id=? AND c.owner_id=? AND i.revoked=0 AND i.expires_at>? AND ${ACTIVE}`).bind(hash, circle, session.guest_id, now, session.token_hash, session.guest_id, now).first());
  }
  async join(session: GuestSession, token: string, now = Date.now()) {
    const hash = await tokenHash(token); const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO braise_circle_members (id,circle_id,guest_id,state,joined_at)
        SELECT ?,i.circle_id,?,'active',? FROM braise_circle_invites i WHERE i.token_hash=? AND i.revoked=0 AND i.expires_at>? AND i.uses<20 AND ${ACTIVE}
        AND (SELECT count(*) FROM braise_circle_members WHERE circle_id=i.circle_id AND state='active')<20`).bind(id, session.guest_id, now, hash, now, session.token_hash, session.guest_id, now),
      this.db.prepare("UPDATE braise_circle_invites SET uses=uses+1 WHERE token_hash=? AND EXISTS (SELECT 1 FROM braise_circle_members WHERE id=?)").bind(hash, id),
    ]);
    // A repeated join is neutral, but a revoked invitation grants no new access.
    return this.db.prepare("SELECT m.circle_id FROM braise_circle_members m JOIN braise_circle_invites i ON i.circle_id=m.circle_id WHERE i.token_hash=? AND m.guest_id=? AND m.state='active'").bind(hash, session.guest_id).first<{ circle_id: string }>();
  }
  async exclude(session: GuestSession, circle: string, guest: string, now = Date.now()) {
    return this.db.prepare(`UPDATE braise_circle_members SET state='excluded' WHERE circle_id=? AND guest_id=? AND guest_id<>? AND EXISTS (SELECT 1 FROM braise_circles WHERE id=? AND owner_id=?) AND ${ACTIVE}`).bind(circle, guest, session.guest_id, circle, session.guest_id, session.token_hash, session.guest_id, now).run();
  }
  async revokeInvites(session: GuestSession, circle: string, now = Date.now()) {
    return this.db.prepare(`UPDATE braise_circle_invites SET revoked=1 WHERE circle_id=? AND EXISTS (SELECT 1 FROM braise_circles WHERE id=? AND owner_id=?) AND ${ACTIVE}`).bind(circle, circle, session.guest_id, session.token_hash, session.guest_id, now).run();
  }
  async details(guest: string, circle: string) {
    const membership = await this.member(guest, circle); if (!membership) return null;
    const members = (await this.db.prepare("SELECT g.id,g.name FROM braise_circle_members m JOIN braise_guests g ON g.id=m.guest_id WHERE m.circle_id=? AND m.state='active'").bind(circle).all()).results;
    const challenges = (await this.db.prepare("SELECT id,week FROM braise_circle_challenges WHERE circle_id=? ORDER BY week DESC LIMIT 104").bind(circle).all()).results;
    // Repeat authorization after reads, so exclusion never returns a stale authorized projection.
    return await this.member(guest, circle) ? { circle: membership, members, challenges } : null;
  }
  async challenge(session: GuestSession, circle: string, week: string, seed: string, now = Date.now()) {
    await this.db.prepare(`INSERT OR IGNORE INTO braise_circle_challenges (id,circle_id,week,seed,created_at)
      SELECT ?,m.circle_id,?,?,? FROM braise_circle_members m WHERE m.circle_id=? AND m.guest_id=? AND m.state='active' AND ${ACTIVE}`).bind(crypto.randomUUID(), week, seed, now, circle, session.guest_id, session.token_hash, session.guest_id, now).run();
    return this.db.prepare("SELECT c.id,c.week FROM braise_circle_challenges c JOIN braise_circle_members m ON m.circle_id=c.circle_id WHERE c.circle_id=? AND c.week=? AND m.guest_id=? AND m.state='active'").bind(circle, week, session.guest_id).first<{ id: string; week: string }>();
  }
  async enter(session: GuestSession, challenge: string, now = Date.now()) {
    // The stable ID makes retries converge; a failed batch cannot leave an orphan game.
    const game = `circle-${challenge}-${session.guest_id}`;
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO braise_server_games (id,guest_id,seed,corpus,rules,state,revision,created_at)
        SELECT ?,? ,c.seed,'fr-fasttext-30000-v1','classic-v1','open',0,? FROM braise_circle_challenges c JOIN braise_circle_members m ON m.circle_id=c.circle_id WHERE c.id=? AND m.guest_id=? AND m.state='active' AND ${ACTIVE} AND (SELECT count(*) FROM braise_server_games WHERE guest_id=m.guest_id)<100`).bind(game, session.guest_id, now, challenge, session.guest_id, session.token_hash, session.guest_id, now),
      this.db.prepare(`INSERT OR IGNORE INTO braise_circle_games (game_id,challenge_id,guest_id) SELECT id,?,guest_id FROM braise_server_games WHERE id=? AND guest_id=?`).bind(challenge, game, session.guest_id),
    ]);
    return await this.accessGame(session.guest_id, game) ? game : null;
  }
  async accessGame(guest: string, game: string) {
    return this.db.prepare("SELECT cg.game_id FROM braise_circle_games cg JOIN braise_circle_challenges c ON c.id=cg.challenge_id JOIN braise_circle_members m ON m.circle_id=c.circle_id WHERE cg.game_id=? AND cg.guest_id=? AND m.guest_id=? AND m.state='active'").bind(game, guest, guest).first();
  }
  async results(guest: string, challenge: string) {
    return (await this.db.prepare(`SELECT g.name,sg.state,sg.revision,MIN(q.rank) AS best_rank FROM braise_circle_games cg
      JOIN braise_circle_challenges c ON c.id=cg.challenge_id JOIN braise_server_games sg ON sg.id=cg.game_id
      JOIN braise_guests g ON g.id=cg.guest_id JOIN braise_circle_members m ON m.circle_id=c.circle_id AND m.guest_id=cg.guest_id AND m.state='active'
      LEFT JOIN braise_server_guesses q ON q.game_id=sg.id
      WHERE c.id=? AND EXISTS (SELECT 1 FROM braise_circle_members viewer WHERE viewer.circle_id=c.circle_id AND viewer.guest_id=? AND viewer.state='active')
      GROUP BY cg.game_id ORDER BY CASE sg.state WHEN 'won' THEN 0 ELSE 1 END, CASE sg.state WHEN 'won' THEN sg.revision ELSE 30001 END,COALESCE(MIN(q.rank),30001)`).bind(challenge, guest).all()).results;
  }
}
