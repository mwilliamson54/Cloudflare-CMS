-- Preserve the four supported publication statuses while allowing non-destructive content removal.
ALTER TABLE content_entries ADD COLUMN trashed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_content_trashed_at ON content_entries(trashed_at);
