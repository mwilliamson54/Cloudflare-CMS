CREATE TABLE `api_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`tokenId` varchar(96) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`tokenPrefix` varchar(20) NOT NULL,
	`scopes` json NOT NULL,
	`expiresAt` datetime,
	`lastUsedAt` datetime,
	`revokedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_tokens_token_id_unique` UNIQUE(`tokenId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`parentId` int,
	`seoTitle` varchar(300),
	`seoDescription` varchar(500),
	`robotsIndex` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `content_categories` (
	`contentEntryId` int NOT NULL,
	`categoryId` int NOT NULL,
	CONSTRAINT `content_categories_contentEntryId_categoryId_pk` PRIMARY KEY(`contentEntryId`,`categoryId`)
);
--> statement-breakpoint
CREATE TABLE `content_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentTypeId` int NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`slug` varchar(320) NOT NULL,
	`excerpt` text,
	`bodyMarkdown` text,
	`bodyHtml` text,
	`fieldData` json,
	`featuredMediaId` int,
	`status` enum('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
	`scheduledAt` datetime,
	`publishedAt` datetime,
	`archivedAt` datetime,
	`seoTitle` varchar(300),
	`seoDescription` varchar(500),
	`focusKeyword` varchar(120),
	`canonicalUrl` varchar(1024),
	`robotsIndex` boolean NOT NULL DEFAULT true,
	`robotsFollow` boolean NOT NULL DEFAULT true,
	`ogTitle` varchar(300),
	`ogDescription` varchar(500),
	`ogImageMediaId` int,
	`schemaJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_entries_type_slug_unique` UNIQUE(`contentTypeId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `content_tags` (
	`contentEntryId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `content_tags_contentEntryId_tagId_pk` PRIMARY KEY(`contentEntryId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `content_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`kind` enum('post','page','custom') NOT NULL,
	`description` text,
	`fieldDefinitions` json NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_types_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` bigint NOT NULL,
	`width` int,
	`height` int,
	`altText` varchar(500),
	`title` varchar(255),
	`caption` text,
	`description` text,
	`uploadedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_storage_key_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`location` varchar(80) NOT NULL,
	`items` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menus_id` PRIMARY KEY(`id`),
	CONSTRAINT `menus_location_unique` UNIQUE(`location`)
);
--> statement-breakpoint
CREATE TABLE `plugins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`version` varchar(32) NOT NULL,
	`settings` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plugins_id` PRIMARY KEY(`id`),
	CONSTRAINT `plugins_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(160) NOT NULL,
	`namespace` varchar(80) NOT NULL DEFAULT 'site',
	`value` json NOT NULL,
	`isPublic` boolean NOT NULL DEFAULT false,
	`updatedById` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_settings_namespace_key_unique` UNIQUE(`namespace`,`key`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`seoTitle` varchar(300),
	`seoDescription` varchar(500),
	`robotsIndex` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`version` varchar(32) NOT NULL,
	`settings` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `themes_id` PRIMARY KEY(`id`),
	CONSTRAINT `themes_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(16) NOT NULL DEFAULT 'viewer';--> statement-breakpoint
UPDATE `users` SET `role` = 'viewer' WHERE `role` NOT IN ('admin', 'editor', 'viewer');--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
CREATE INDEX `api_tokens_user_index` ON `api_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `api_tokens_active_index` ON `api_tokens` (`revokedAt`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `categories_parent_index` ON `categories` (`parentId`);--> statement-breakpoint
CREATE INDEX `content_entries_status_published_index` ON `content_entries` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `content_entries_author_index` ON `content_entries` (`authorId`);--> statement-breakpoint
CREATE INDEX `content_entries_featured_media_index` ON `content_entries` (`featuredMediaId`);--> statement-breakpoint
CREATE INDEX `media_uploaded_by_index` ON `media` (`uploadedById`);--> statement-breakpoint
CREATE INDEX `media_mime_type_index` ON `media` (`mimeType`);
