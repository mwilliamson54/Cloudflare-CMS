CREATE INDEX `content_categories_category_entry_index` ON `content_categories` (`categoryId`,`contentEntryId`);--> statement-breakpoint
CREATE INDEX `content_entries_public_listing_index` ON `content_entries` (`contentTypeId`,`status`,`trashedAt`,`publishedAt`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `content_entries_schedule_guard_index` ON `content_entries` (`status`,`trashedAt`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `content_entries_sitemap_index` ON `content_entries` (`status`,`trashedAt`,`robotsIndex`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `content_tags_tag_entry_index` ON `content_tags` (`tagId`,`contentEntryId`);--> statement-breakpoint
CREATE INDEX `media_uploader_created_index` ON `media` (`uploadedById`,`createdAt`);