CREATE TABLE `braise_circle_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`week` text NOT NULL,
	`target` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `braise_circles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_circle_goal_target" CHECK("braise_circle_goals"."target" BETWEEN 0 AND 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_circle_goal_week` ON `braise_circle_goals` (`circle_id`,`week`);--> statement-breakpoint
CREATE TABLE `braise_device_snapshots` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`version` integer NOT NULL,
	`payload` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "braise_sync_revision" CHECK("braise_device_snapshots"."revision">=0),
	CONSTRAINT "braise_sync_version" CHECK("braise_device_snapshots"."version"=1)
);
