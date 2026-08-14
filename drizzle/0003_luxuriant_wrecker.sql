ALTER TABLE `media` ADD `storageProvider` varchar(48) DEFAULT 's3-compatible' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `originalFileName` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `media` SET `originalFileName` = `fileName` WHERE `originalFileName` = '';--> statement-breakpoint
ALTER TABLE `media` MODIFY COLUMN `originalFileName` varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX `media_created_at_index` ON `media` (`createdAt`);
