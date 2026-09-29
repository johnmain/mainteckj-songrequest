CREATE TABLE `host_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`accepting` integer DEFAULT false NOT NULL,
	`last_seen_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
