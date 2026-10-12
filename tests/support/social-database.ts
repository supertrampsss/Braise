import { DatabaseSync } from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ServerStore} from '../../lib/server-store';
import {CircleStore} from '../../lib/circle-store';
import {DuelStore} from '../../lib/duel-store';
import {StudioStore} from '../../lib/studio-store';
export function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const statement of readFileSync("drizzle/0000_young_eternity.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0001_wakeful_zuras.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0002_colossal_spirit.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0003_same_morlun.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for (const statement of readFileSync("drizzle/0004_minor_ravenous.sql", "utf8").split("--> statement-breakpoint")) sqlite.exec(statement);
  for(const file of readdirSync('drizzle').filter(name=>/^000[5-9].*\.sql$/.test(name)))for(const statement of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))sqlite.exec(statement);
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='braise_guess_applies_revision'").get());
  function prepare(sql: string) {
    let values: Array<string | number | null> = [];
    return {
      bind(...args: typeof values) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
    };
  }
  const d1 = { prepare, async batch(statements: Array<ReturnType<typeof prepare>>) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } } as unknown as D1Database;
  return { sqlite, d1, store: new ServerStore(d1), circles: new CircleStore(d1), duels: new DuelStore(d1), studio: new StudioStore(d1) };
}
