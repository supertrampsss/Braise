CREATE TABLE `braise_recovery_codes` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`code_hash` text,
	`pending_code_hash` text,
	`redeemed_session_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `braise_guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `braise_recovery_codes_code_hash_unique` ON `braise_recovery_codes` (`code_hash`);