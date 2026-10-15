CREATE TABLE `braise_duel_guesses_v2` (
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
	CONSTRAINT "braise_duel_v2_bounds" CHECK("braise_duel_guesses_v2"."round" BETWEEN 0 AND 2 AND "braise_duel_guesses_v2"."ordinal" BETWEEN 1 AND 30 AND "braise_duel_guesses_v2"."rank" BETWEEN 1 AND 155562 AND "braise_duel_guesses_v2"."found" IN (0,1) AND "braise_duel_guesses_v2"."temperature" BETWEEN -1000000 AND 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_v2_word` ON `braise_duel_guesses_v2` (`duel_id`,`guest_id`,`round`,`word`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_v2_request` ON `braise_duel_guesses_v2` (`duel_id`,`guest_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `braise_duel_v2_ordinal` ON `braise_duel_guesses_v2` (`duel_id`,`guest_id`,`round`,`ordinal`);--> statement-breakpoint
CREATE TABLE `braise_duel_rematches` (
	`duel_id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`invitee_id` text NOT NULL,
	FOREIGN KEY (`duel_id`) REFERENCES `braise_duels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `braise_duels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitee_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
