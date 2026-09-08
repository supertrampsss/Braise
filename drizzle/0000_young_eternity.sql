CREATE TABLE `braise_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `braise_server_games` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`seed` text NOT NULL,
	`corpus` text NOT NULL,
	`rules` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_game_state" CHECK("braise_server_games"."state" IN ('open','won')),
	CONSTRAINT "braise_game_revision" CHECK("braise_server_games"."revision" BETWEEN 0 AND 3000)
);
--> statement-breakpoint
CREATE INDEX `braise_games_guest_created` ON `braise_server_games` (`guest_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `braise_server_guesses` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`request_id` text NOT NULL,
	`word` text NOT NULL,
	`ordinal` integer NOT NULL,
	`temperature` integer NOT NULL,
	`rank` integer NOT NULL,
	`found` integer NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `braise_server_games`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_guess_bounds" CHECK("braise_server_guesses"."ordinal" BETWEEN 1 AND 3000 AND "braise_server_guesses"."found" IN (0,1) AND "braise_server_guesses"."rank" BETWEEN 1 AND 30000 AND "braise_server_guesses"."temperature" BETWEEN -1000000 AND 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_guess_word` ON `braise_server_guesses` (`game_id`,`word`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_guess_request` ON `braise_server_guesses` (`game_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_guess_ordinal` ON `braise_server_guesses` (`game_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `braise_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`csrf_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER `braise_guess_applies_revision` AFTER INSERT ON `braise_server_guesses`
BEGIN
  UPDATE `braise_server_games`
  SET `revision` = NEW.ordinal,
      `state` = CASE WHEN NEW.found = 1 THEN 'won' ELSE 'open' END,
      `completed_at` = CASE WHEN NEW.found = 1 THEN NEW.accepted_at ELSE NULL END
  WHERE `id` = NEW.game_id;
END;
