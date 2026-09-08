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
export const circles = sqliteTable("braise_circles", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => guests.id),
  name: text("name").notNull(), createdAt: integer("created_at").notNull(),
});
export const studioDrafts = sqliteTable("braise_studio_drafts", {
  id: text("id").primaryKey(), guestId: text("guest_id").notNull().references(() => guests.id),
  title: text("title").notNull(), entries: text("entries").notNull(), revision: integer("revision").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const studioEditions = sqliteTable("braise_studio_editions", {
  id: text("id").primaryKey(), draftId: text("draft_id").notNull().references(() => studioDrafts.id),
  guestId: text("guest_id").notNull().references(() => guests.id), revision: integer("revision").notNull(),
  title: text("title").notNull(), entries: text("entries").notNull(), state: text("state").notNull().default("active"), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("braise_studio_edition_revision").on(table.draftId, table.revision), check("braise_studio_edition_state", sql`${table.state} IN ('active','withdrawn')`)]);
export const studioGames = sqliteTable("braise_studio_games", {
  gameId: text("game_id").primaryKey().references(() => serverGames.id),
  editionId: text("edition_id").notNull().references(() => studioEditions.id),
  guestId: text("guest_id").notNull().references(() => guests.id), step: integer("step").notNull(),
}, table => [uniqueIndex("braise_studio_participation").on(table.editionId, table.guestId, table.step)]);
export const duels = sqliteTable("braise_duels", {
  id: text("id").primaryKey(), hostId: text("host_id").notNull().references(() => guests.id),
  opponentId: text("opponent_id").references(() => guests.id), tokenHash: text("token_hash").notNull().unique(),
  targets: text("targets").notNull(), rules: text("rules").notNull().default("duel-v1"),
  state: text("state").notNull().default("pending"), createdAt: integer("created_at").notNull(),
  inviteExpires: integer("invite_expires").notNull(), deadline: integer("deadline"), forfeiter: text("forfeiter"),
}, table => [check("braise_duel_state", sql`${table.state} IN ('pending','active','cancelled','forfeit')`), check("braise_duel_players", sql`${table.opponentId} IS NULL OR ${table.hostId}<>${table.opponentId}`)]);
export const duelGuesses = sqliteTable("braise_duel_guesses", {
  id: text("id").primaryKey(), duelId: text("duel_id").notNull().references(() => duels.id),
  guestId: text("guest_id").notNull().references(() => guests.id), round: integer("round").notNull(),
  requestId: text("request_id").notNull(), word: text("word").notNull(), ordinal: integer("ordinal").notNull(),
  temperature: integer("temperature").notNull(), rank: integer("rank").notNull(), found: integer("found").notNull(), acceptedAt: integer("accepted_at").notNull(),
}, table => [uniqueIndex("braise_duel_word").on(table.duelId, table.guestId, table.round, table.word), uniqueIndex("braise_duel_request").on(table.duelId, table.guestId, table.requestId), uniqueIndex("braise_duel_ordinal").on(table.duelId, table.guestId, table.round, table.ordinal), check("braise_duel_guess_bounds", sql`${table.round} BETWEEN 0 AND 2 AND ${table.ordinal} BETWEEN 1 AND 30 AND ${table.rank} BETWEEN 1 AND 30000 AND ${table.found} IN (0,1) AND ${table.temperature} BETWEEN -1000000 AND 1000000`)]);
export const circleMembers = sqliteTable("braise_circle_members", {
  id: text("id").primaryKey(), circleId: text("circle_id").notNull().references(() => circles.id),
  guestId: text("guest_id").notNull().references(() => guests.id),
  state: text("state").notNull().default("active"), joinedAt: integer("joined_at").notNull(),
}, table => [uniqueIndex("braise_circle_member").on(table.circleId, table.guestId), check("braise_member_state", sql`${table.state} IN ('active','excluded')`)]);
export const circleInvites = sqliteTable("braise_circle_invites", {
  tokenHash: text("token_hash").primaryKey(), circleId: text("circle_id").notNull().references(() => circles.id),
  expiresAt: integer("expires_at").notNull(), revoked: integer("revoked").notNull().default(0),
  uses: integer("uses").notNull().default(0),
}, table => [check("braise_invite_uses", sql`${table.uses} BETWEEN 0 AND 20`)]);
export const circleChallenges = sqliteTable("braise_circle_challenges", {
  id: text("id").primaryKey(), circleId: text("circle_id").notNull().references(() => circles.id),
  week: text("week").notNull(), seed: text("seed").notNull(), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("braise_circle_week").on(table.circleId, table.week)]);
export const circleGames = sqliteTable("braise_circle_games", {
  gameId: text("game_id").primaryKey().references(() => serverGames.id),
  challengeId: text("challenge_id").notNull().references(() => circleChallenges.id),
  guestId: text("guest_id").notNull().references(() => guests.id),
}, table => [uniqueIndex("braise_circle_participation").on(table.challengeId, table.guestId)]);
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
