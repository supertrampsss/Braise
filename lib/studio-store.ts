import type { GuestSession } from "./server-store";
import { STUDIO_ENTRIES, validateStudio } from "./studio-catalogue";
type Draft = { id: string; guest_id: string; title: string; entries: string; revision: number };
type Edition = Draft & { state: string; draft_id: string };
const ACTIVE = "EXISTS (SELECT 1 FROM braise_sessions s WHERE s.token_hash=? AND s.guest_id=? AND s.revoked=0 AND s.expires_at>?)";
export class StudioStore {
  constructor(private db: D1Database) {}
  async list(guest: string) { return (await this.db.prepare("SELECT id,title,revision FROM braise_studio_drafts WHERE guest_id=? ORDER BY created_at DESC LIMIT 50").bind(guest).all()).results; }
  async draft(guest: string, id: string) { return this.db.prepare("SELECT * FROM braise_studio_drafts WHERE id=? AND guest_id=?").bind(id, guest).first<Draft>(); }
  async save(session: GuestSession, id: string, revision: number, title: string, entries: string[], now = Date.now()) {
    if (!validateStudio(title, entries)) return null;
    if (revision === -1) await this.db.prepare(`INSERT OR IGNORE INTO braise_studio_drafts (id,guest_id,title,entries,revision,created_at) SELECT ?,?,?,?,0,? WHERE ${ACTIVE} AND (SELECT count(*) FROM braise_studio_drafts WHERE guest_id=?)<50`).bind(id, session.guest_id, title, JSON.stringify(entries), now, session.token_hash, session.guest_id, now, session.guest_id).run();
    else await this.db.prepare(`UPDATE braise_studio_drafts SET title=?,entries=?,revision=revision+1 WHERE id=? AND guest_id=? AND revision=? AND ${ACTIVE}`).bind(title, JSON.stringify(entries), id, session.guest_id, revision, session.token_hash, session.guest_id, now).run();
    const draft = await this.draft(session.guest_id, id);
    // Lost-response replay is accepted only when the resulting content is identical.
    return draft && draft.title === title && draft.entries === JSON.stringify(entries) && draft.revision === revision + 1 ? draft : null;
  }
  async publish(session: GuestSession, id: string, revision: number, now = Date.now()) {
    const draft = await this.draft(session.guest_id, id); if (!draft || draft.revision !== revision || !validateStudio(draft.title, JSON.parse(draft.entries))) return null;
    await this.db.prepare(`INSERT OR IGNORE INTO braise_studio_editions (id,draft_id,guest_id,revision,title,entries,state,created_at)
      SELECT ?,id,guest_id,revision,title,?,'active',? FROM braise_studio_drafts WHERE id=? AND guest_id=? AND revision=? AND ${ACTIVE}`).bind(crypto.randomUUID(), JSON.stringify((JSON.parse(draft.entries) as string[]).map(id => { const entry = STUDIO_ENTRIES.find(item => item.id === id)!; return { id: entry.id, seed: entry.seed }; })), now, id, session.guest_id, revision, session.token_hash, session.guest_id, now).run();
    return this.db.prepare("SELECT id,state FROM braise_studio_editions WHERE draft_id=? AND guest_id=? AND revision=?").bind(id, session.guest_id, revision).first<{ id: string; state: string }>();
  }
  async editions(guest: string, draft: string) { return (await this.db.prepare("SELECT id,revision,state FROM braise_studio_editions WHERE draft_id=? AND guest_id=? ORDER BY revision DESC LIMIT 50").bind(draft, guest).all()).results; }
  async withdraw(session: GuestSession, id: string, now = Date.now()) { await this.db.prepare(`UPDATE braise_studio_editions SET state='withdrawn' WHERE id=? AND guest_id=? AND ${ACTIVE}`).bind(id, session.guest_id, session.token_hash, session.guest_id, now).run(); }
  async edition(id: string) { return this.db.prepare("SELECT * FROM braise_studio_editions WHERE id=? AND state='active'").bind(id).first<Edition>(); }
  async progress(guest: string, id: string) {
    const edition = await this.edition(id); if (!edition) return null;
    const games = (await this.db.prepare("SELECT sg.step,g.state,g.id FROM braise_studio_games sg JOIN braise_server_games g ON g.id=sg.game_id WHERE sg.edition_id=? AND sg.guest_id=? ORDER BY sg.step").bind(id, guest).all<{ step: number; state: string; id: string }>()).results;
    const entries = JSON.parse(edition.entries) as string[]; let completed = 0;
    for (const game of games) { if (game.step !== completed || game.state !== "won") break; completed++; }
    return await this.edition(id) ? { id, title: edition.title, length: entries.length, completed, game: games.find(game => game.step === completed)?.id ?? null } : null;
  }
  async enter(session: GuestSession, id: string, now = Date.now()) {
    const edition = await this.edition(id); const progress = await this.progress(session.guest_id, id);
    if (!edition || !progress || progress.completed >= progress.length) return null;
    const entry = (JSON.parse(edition.entries) as Array<{ id: string; seed: string }>)[progress.completed]; if (!entry) return null;
    const game = `studio-${id}-${session.guest_id}-${progress.completed}`;
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO braise_server_games (id,guest_id,seed,corpus,rules,state,revision,created_at)
        SELECT ?,?,?, 'fr-fasttext-30000-v1','classic-v1','open',0,? WHERE ${ACTIVE}
        AND EXISTS (SELECT 1 FROM braise_studio_editions WHERE id=? AND state='active')
        AND (SELECT count(*) FROM braise_studio_games sg JOIN braise_server_games g ON g.id=sg.game_id WHERE sg.edition_id=? AND sg.guest_id=? AND sg.step<? AND g.state='won')=?
        AND (SELECT count(*) FROM braise_server_games WHERE guest_id=?)<100`).bind(game, session.guest_id, entry.seed, now, session.token_hash, session.guest_id, now, id, id, session.guest_id, progress.completed, progress.completed, session.guest_id),
      this.db.prepare("INSERT OR IGNORE INTO braise_studio_games (game_id,edition_id,guest_id,step) SELECT id,?,guest_id,? FROM braise_server_games WHERE id=? AND guest_id=?").bind(id, progress.completed, game, session.guest_id),
    ]);
    return (await this.progress(session.guest_id, id))?.game ?? null;
  }
}
