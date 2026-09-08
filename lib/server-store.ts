import { tokenHash } from "./server-security";
import type { WordEvaluation } from "./game-contracts";

export type GuestSession = { guest_id: string; name: string; token_hash: string; csrf_hash: string; expires_at: number };
type ServerGame = { id: string; guest_id: string; seed: string; corpus: string; rules: string; state: string; revision: number; created_at: number; completed_at: number | null };
// Applies to every general-game entry point as well as circle-specific routes.
const CIRCLE_ACCESS = `NOT EXISTS (SELECT 1 FROM braise_circle_games cg JOIN braise_circle_challenges cc ON cc.id=cg.challenge_id
  WHERE cg.game_id=g.id AND NOT EXISTS (SELECT 1 FROM braise_circle_members cm WHERE cm.circle_id=cc.circle_id AND cm.guest_id=g.guest_id AND cm.state='active'))
  AND NOT EXISTS (SELECT 1 FROM braise_studio_games st JOIN braise_studio_editions se ON se.id=st.edition_id WHERE st.game_id=g.id AND se.state<>'active')`;
export class ServerStore {
  constructor(private db: D1Database) {}
  async session(token: string, now = Date.now()) {
    return this.db.prepare("SELECT s.*, g.name FROM braise_sessions s JOIN braise_guests g ON g.id=s.guest_id WHERE s.token_hash=? AND s.revoked=0 AND s.expires_at>?").bind(await tokenHash(token), now).first<GuestSession>();
  }
  async createGuest(name: string, token: string, csrf: string, now = Date.now()) {
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare("INSERT INTO braise_guests (id,name,created_at) SELECT ?,?,? WHERE (SELECT count(*) FROM braise_guests)<1000").bind(id, name, now),
      this.db.prepare("INSERT INTO braise_sessions (token_hash,guest_id,csrf_hash,expires_at,revoked) VALUES (?,?,?,?,0)").bind(await tokenHash(token), id, await tokenHash(csrf), now + 30 * 86400000),
    ]);
    return { id, name };
  }
  async listGames(guest: string) {
    return (await this.db.prepare(`SELECT id,state,revision,created_at,completed_at FROM braise_server_games g WHERE guest_id=? AND ${CIRCLE_ACCESS} ORDER BY created_at DESC LIMIT 50`).bind(guest).all()).results;
  }
  async revokeSession(session: GuestSession) {
    await this.db.prepare("UPDATE braise_sessions SET revoked=1 WHERE token_hash=? AND guest_id=?").bind(session.token_hash, session.guest_id).run();
  }
  async setRecoveryCode(session: GuestSession, code: string, now = Date.now()) {
    const result = await this.db.prepare(`INSERT INTO braise_recovery_codes (guest_id,pending_code_hash,created_at)
      SELECT guest_id,?,? FROM braise_sessions WHERE token_hash=? AND guest_id=? AND revoked=0 AND expires_at>?
      ON CONFLICT(guest_id) DO UPDATE SET pending_code_hash=excluded.pending_code_hash,created_at=excluded.created_at`).bind(await tokenHash(code), now, session.token_hash, session.guest_id, now).run();
    return Boolean(result.meta.changes);
  }
  async confirmRecoveryCode(session: GuestSession, code: string, now = Date.now()) {
    const hash = await tokenHash(code);
    const result = await this.db.prepare(`UPDATE braise_recovery_codes SET code_hash=?,pending_code_hash=NULL,redeemed_session_hash=NULL
      WHERE guest_id=? AND (pending_code_hash=? OR (code_hash=? AND redeemed_session_hash IS NULL))
      AND EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=braise_recovery_codes.guest_id AND s.revoked=0 AND s.expires_at>?)`).bind(hash, session.guest_id, hash, hash, session.token_hash, now).run();
    return Boolean(result.meta.changes);
  }
  async recover(code: string, token: string, csrf: string, now = Date.now()) {
    const hash = await tokenHash(code); const sessionHash = await tokenHash(token);
    const replay = await this.db.prepare("SELECT guest_id FROM braise_recovery_codes WHERE code_hash=? AND redeemed_session_hash=?").bind(hash, sessionHash).first();
    if (replay) return this.session(token, now);
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO braise_sessions (token_hash,guest_id,csrf_hash,expires_at,revoked)
        SELECT ?,guest_id,?,?,0 FROM braise_recovery_codes WHERE code_hash=? AND redeemed_session_hash IS NULL`).bind(sessionHash, await tokenHash(csrf), now + 30 * 86400000, hash),
      this.db.prepare(`UPDATE braise_sessions SET revoked=1 WHERE token_hash<>? AND guest_id IN
        (SELECT r.guest_id FROM braise_recovery_codes r JOIN braise_sessions s ON s.guest_id=r.guest_id
         WHERE r.code_hash=? AND r.redeemed_session_hash IS NULL AND s.token_hash=?)`).bind(sessionHash, hash, sessionHash),
      this.db.prepare(`UPDATE braise_recovery_codes SET redeemed_session_hash=? WHERE code_hash=? AND redeemed_session_hash IS NULL
        AND EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=braise_recovery_codes.guest_id)`).bind(sessionHash, hash, sessionHash),
    ]);
    const receipt = await this.db.prepare("SELECT guest_id FROM braise_recovery_codes WHERE code_hash=? AND redeemed_session_hash=?").bind(hash, sessionHash).first();
    return receipt ? this.session(token, now) : null;
  }
  async createAuthorizedGame(session: GuestSession, id: string, seed: string, now = Date.now()) {
    await this.db.prepare(`INSERT OR IGNORE INTO braise_server_games (id,guest_id,seed,corpus,rules,state,revision,created_at)
      SELECT ?,s.guest_id,?,'fr-fasttext-30000-v1','classic-v1','open',0,? FROM braise_sessions s
      WHERE s.token_hash=? AND s.guest_id=? AND s.revoked=0 AND s.expires_at>?
      AND (SELECT count(*) FROM braise_server_games WHERE guest_id=s.guest_id)<100`).bind(id, seed, now, session.token_hash, session.guest_id, now).run();
    const active = await this.db.prepare("SELECT guest_id FROM braise_sessions WHERE token_hash=? AND guest_id=? AND revoked=0 AND expires_at>?").bind(session.token_hash, session.guest_id, now).first();
    return active ? this.game(session.guest_id, id) : null;
  }
  async createGame(guest: string, id: string, seed: string, now = Date.now()) {
    await this.db.prepare("INSERT OR IGNORE INTO braise_server_games (id,guest_id,seed,corpus,rules,state,revision,created_at) SELECT ?,?,?,'fr-fasttext-30000-v1','classic-v1','open',0,? WHERE (SELECT count(*) FROM braise_server_games WHERE guest_id=?)<100").bind(id, guest, seed, now, guest).run();
    return this.game(guest, id);
  }
  async game(guest: string, id: string) {
    return this.db.prepare(`SELECT * FROM braise_server_games g WHERE id=? AND guest_id=? AND ${CIRCLE_ACCESS}`).bind(id, guest).first<ServerGame>();
  }
  async guesses(game: string) {
    return (await this.db.prepare("SELECT word,ordinal,temperature,rank,found,accepted_at FROM braise_server_guesses WHERE game_id=? ORDER BY ordinal").bind(game).all()).results;
  }
  async publicView(guest: string, id: string) {
    const row = await this.db.prepare(`SELECT g.id,g.state,g.revision,g.corpus,g.rules,
      (SELECT json_group_array(json_object('word',q.word,'ordinal',q.ordinal,'temperature',q.temperature/10000.0,'rank',q.rank,'found',q.found))
       FROM (SELECT word,ordinal,temperature,rank,found FROM braise_server_guesses WHERE game_id=g.id ORDER BY ordinal) q) AS guesses_json
      FROM braise_server_games g WHERE g.id=? AND g.guest_id=? AND ${CIRCLE_ACCESS}`).bind(id, guest).first<{ id: string; state: string; revision: number; corpus: string; rules: string; guesses_json: string }>();
    if (!row) return null;
    const { guesses_json, ...game } = row;
    return { game, guesses: (JSON.parse(guesses_json) as Array<{ found: number }>).map(guess => ({ ...guess, found: guess.found === 1 })) };
  }
  async submit(session: GuestSession, game: string, revision: number, requestId: string, result: WordEvaluation, now = Date.now()) {
    if (!await this.game(session.guest_id, game)) return "conflict";
    const previous = await this.db.prepare("SELECT word FROM braise_server_guesses WHERE game_id=? AND request_id=?").bind(game, requestId).first<{ word: string }>();
    if (previous) return previous.word === result.word ? "replayed" : "conflict";
    const insert = await this.db.prepare(`INSERT OR IGNORE INTO braise_server_guesses (id,game_id,request_id,word,ordinal,temperature,rank,found,accepted_at)
      SELECT ?,g.id,?,?,g.revision+1,?,?,?,? FROM braise_server_games g
      WHERE g.id=? AND g.guest_id=? AND g.revision=? AND g.state='open' AND g.revision<3000 AND ${CIRCLE_ACCESS}
      AND EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=g.guest_id AND s.revoked=0 AND s.expires_at>?)`).bind(crypto.randomUUID(), requestId, result.word, Math.round(result.temperature * 10000), result.rank, result.found ? 1 : 0, now, game, session.guest_id, revision, session.token_hash, now).run();
    if (insert.meta.changes) return "accepted";
    const retry = await this.db.prepare("SELECT word FROM braise_server_guesses WHERE game_id=? AND request_id=?").bind(game, requestId).first<{ word: string }>();
    return retry?.word === result.word ? "replayed" : "conflict";
  }
}
