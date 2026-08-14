ALTER TABLE `content_entries` ADD `trashedAt` datetime;--> statement-breakpoint
CREATE INDEX `content_entries_trashed_at_index` ON `content_entries` (`trashedAt`);