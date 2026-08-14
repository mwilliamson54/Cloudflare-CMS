-- Bounded public listing, scheduler, sitemap, media ownership, and reverse taxonomy indexes.
CREATE INDEX IF NOT EXISTS idx_content_public_listing ON content_entries(content_type_id,status,trashed_at,published_at,updated_at);
CREATE INDEX IF NOT EXISTS idx_content_schedule_guard ON content_entries(status,trashed_at,scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_sitemap ON content_entries(status,trashed_at,robots_index,updated_at);
CREATE INDEX IF NOT EXISTS idx_media_uploader_created ON media(uploaded_by_id,created_at);
CREATE INDEX IF NOT EXISTS idx_content_categories_category_entry ON content_categories(category_id,content_entry_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag_entry ON content_tags(tag_id,content_entry_id);
