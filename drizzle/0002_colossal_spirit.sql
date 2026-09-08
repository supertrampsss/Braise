CREATE TABLE `braise_circle_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`week` text NOT NULL,
	`seed` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `braise_circles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_circle_week` ON `braise_circle_challenges` (`circle_id`,`week`);--> statement-breakpoint
CREATE TABLE `braise_circle_games` (
	`game_id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`guest_id` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `braise_server_games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `braise_circle_challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_circle_participation` ON `braise_circle_games` (`challenge_id`,`guest_id`);--> statement-breakpoint
CREATE TABLE `braise_circle_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `braise_circles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_invite_uses" CHECK("braise_circle_invites"."uses" BETWEEN 0 AND 20)
);
--> statement-breakpoint
CREATE TABLE `braise_circle_members` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `braise_circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_member_state" CHECK("braise_circle_members"."state" IN ('active','excluded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_circle_member` ON `braise_circle_members` (`circle_id`,`guest_id`);--> statement-breakpoint
CREATE TABLE `braise_circles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
