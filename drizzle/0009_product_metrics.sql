CREATE TABLE `braiz_metric_consents` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`granted_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "braiz_metric_consent_revoked" CHECK("braiz_metric_consents"."revoked" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `braiz_metric_consent_expiry` ON `braiz_metric_consents` (`expires_at`);--> statement-breakpoint
CREATE TABLE `braiz_metric_events` (
	`token_hash` text NOT NULL,
	`event_id` text NOT NULL,
	`day` text NOT NULL,
	`type` text NOT NULL,
	`context` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`token_hash`, `event_id`),
	FOREIGN KEY (`token_hash`) REFERENCES `braiz_metric_consents`(`token_hash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `braiz_metric_event_day` ON `braiz_metric_events` (`day`,`type`,`context`);--> statement-breakpoint
CREATE INDEX `braiz_metric_event_browser_day` ON `braiz_metric_events` (`token_hash`,`day`);