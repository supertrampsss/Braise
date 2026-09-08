CREATE TABLE `braise_studio_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`title` text NOT NULL,
	`entries` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `braise_studio_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`revision` integer NOT NULL,
	`title` text NOT NULL,
	`entries` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `braise_studio_drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_studio_edition_state" CHECK("braise_studio_editions"."state" IN ('active','withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_studio_edition_revision` ON `braise_studio_editions` (`draft_id`,`revision`);--> statement-breakpoint
CREATE TABLE `braise_studio_games` (
	`game_id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`step` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `braise_server_games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edition_id`) REFERENCES `braise_studio_editions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_studio_participation` ON `braise_studio_games` (`edition_id`,`guest_id`,`step`);