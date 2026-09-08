import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const guests = sqliteTable("braise_guests", {
  id: text("id").primaryKey(), name: text("name").notNull(), createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable("braise_sessions", {
  tokenHash: text("token_hash").primaryKey(), guestId: text("guest_id").notNull().references(() => guests.id),
  csrfHash: text("csrf_hash").notNull(), expiresAt: integer("expires_at").notNull(), revoked: integer("revoked").notNull().default(0),
});
export const recoveryCodes = sqliteTable("braise_recovery_codes", {
  guestId: text("guest_id").primaryKey().references(() => guests.id),
  codeHash: text("code_hash").unique(),
  pendingCodeHash: text("pending_code_hash"),
  redeemedSessionHash: text("redeemed_session_hash"),
  createdAt: integer("created_at").notNull(),
});
export const serverGames = sqliteTable("braise_server_games", {
  id: text("id").primaryKey(), guestId: text("guest_id").notNull().references(() => guests.id),
  seed: text("seed").notNull(), corpus: text("corpus").notNull(), rules: text("rules").notNull(),
  state: text("state", { enum: ["open", "won"] }).notNull().default("open"),
  revision: integer("revision").notNull().default(0), createdAt: integer("created_at").notNull(), completedAt: integer("completed_at"),
}, table => [index("braise_games_guest_created").on(table.guestId, table.createdAt), check("braise_game_state", sql`${table.state} IN ('open','won')`), check("braise_game_revision", sql`${table.revision} BETWEEN 0 AND 3000`)]);
export const serverGuesses = sqliteTable("braise_server_guesses", {
  id: text("id").primaryKey(), gameId: text("game_id").notNull().references(() => serverGames.id),
  requestId: text("request_id").notNull(), word: text("word").notNull(), ordinal: integer("ordinal").notNull(),
  temperature: integer("temperature").notNull(), rank: integer("rank").notNull(), found: integer("found").notNull(), acceptedAt: integer("accepted_at").notNull(),
}, table => [uniqueIndex("braise_guess_word").on(table.gameId, table.word), uniqueIndex("braise_guess_request").on(table.gameId, table.requestId), uniqueIndex("braise_guess_ordinal").on(table.gameId, table.ordinal), check("braise_guess_bounds", sql`${table.ordinal} BETWEEN 1 AND 3000 AND ${table.found} IN (0,1) AND ${table.rank} BETWEEN 1 AND 30000 AND ${table.temperature} BETWEEN -1000000 AND 1000000`)]);
