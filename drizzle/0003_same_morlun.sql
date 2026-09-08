CREATE TABLE `braise_duel_guesses` (
	`id` text PRIMARY KEY NOT NULL,
	`duel_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`round` integer NOT NULL,
	`request_id` text NOT NULL,
	`word` text NOT NULL,
	`ordinal` integer NOT NULL,
	`temperature` integer NOT NULL,
	`rank` integer NOT NULL,
	`found` integer NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`duel_id`) REFERENCES `braise_duels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_duel_guess_bounds" CHECK("braise_duel_guesses"."round" BETWEEN 0 AND 2 AND "braise_duel_guesses"."ordinal" BETWEEN 1 AND 30 AND "braise_duel_guesses"."rank" BETWEEN 1 AND 30000 AND "braise_duel_guesses"."found" IN (0,1) AND "braise_duel_guesses"."temperature" BETWEEN -1000000 AND 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_word` ON `braise_duel_guesses` (`duel_id`,`guest_id`,`round`,`word`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_request` ON `braise_duel_guesses` (`duel_id`,`guest_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_ordinal` ON `braise_duel_guesses` (`duel_id`,`guest_id`,`round`,`ordinal`);--> statement-breakpoint
CREATE TABLE `braise_duels` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`opponent_id` text,
	`token_hash` text NOT NULL,
	`targets` text NOT NULL,
	`rules` text DEFAULT 'duel-v1' NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`invite_expires` integer NOT NULL,
	`deadline` integer,
	`forfeiter` text,
	FOREIGN KEY (`host_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opponent_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_duel_state" CHECK("braise_duels"."state" IN ('pending','active','cancelled','forfeit')),
	CONSTRAINT "braise_duel_players" CHECK("braise_duels"."opponent_id" IS NULL OR "braise_duels"."host_id"<>"braise_duels"."opponent_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duels_token_hash_unique` ON `braise_duels` (`token_hash`);