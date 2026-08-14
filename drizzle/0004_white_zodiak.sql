ALTER TABLE `content_entries` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `content_entries` ADD `templateKey` varchar(96) DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX `content_entries_parent_index` ON `content_entries` (`parentId`);--> statement-breakpoint
CREATE INDEX `content_entries_template_index` ON `content_entries` (`templateKey`);