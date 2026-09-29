CREATE TABLE `singer_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`stage_name` text,
	`phone` text,
	`bio` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `singer_profile_user_id_unique` ON `singer_profile` (`user_id`);--> statement-breakpoint
CREATE TABLE `song` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`normalized_title` text NOT NULL,
	`normalized_artist` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_normalized_unique` ON `song` (`normalized_title`,`normalized_artist`);--> statement-breakpoint
CREATE INDEX `song_normalized_title_idx` ON `song` (`normalized_title`);--> statement-breakpoint
CREATE INDEX `song_normalized_artist_idx` ON `song` (`normalized_artist`);--> statement-breakpoint
CREATE TABLE `song_file` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`provider` text NOT NULL,
	`path` text NOT NULL,
	`format` text,
	`duration_seconds` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_file_provider_path_unique` ON `song_file` (`song_id`,`provider`,`path`);--> statement-breakpoint
CREATE INDEX `song_file_song_idx` ON `song_file` (`song_id`);--> statement-breakpoint
CREATE TABLE `song_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`request_id` text,
	`sung_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `song_request`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `song_history_user_idx` ON `song_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `song_history_song_idx` ON `song_history` (`song_id`);--> statement-breakpoint
CREATE TABLE `song_request` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `song_request_user_idx` ON `song_request` (`user_id`);--> statement-breakpoint
CREATE INDEX `song_request_status_idx` ON `song_request` (`status`);--> statement-breakpoint
CREATE INDEX `song_request_song_idx` ON `song_request` (`song_id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `song_fts` USING fts5(
	`song_id` UNINDEXED,
	`title`,
	`artist`,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `song_fts_ai` AFTER INSERT ON `song` BEGIN
	INSERT INTO `song_fts`(`rowid`, `song_id`, `title`, `artist`)
	VALUES (new.`rowid`, new.`id`, new.`title`, new.`artist`);
END;
--> statement-breakpoint
CREATE TRIGGER `song_fts_ad` AFTER DELETE ON `song` BEGIN
	DELETE FROM `song_fts` WHERE `rowid` = old.`rowid`;
END;
--> statement-breakpoint
CREATE TRIGGER `song_fts_au` AFTER UPDATE ON `song` BEGIN
	DELETE FROM `song_fts` WHERE `rowid` = old.`rowid`;
	INSERT INTO `song_fts`(`rowid`, `song_id`, `title`, `artist`)
	VALUES (new.`rowid`, new.`id`, new.`title`, new.`artist`);
END;
--> statement-breakpoint
INSERT INTO `song_fts`(`rowid`, `song_id`, `title`, `artist`)
SELECT `rowid`, `id`, `title`, `artist` FROM `song`;
