-- Cloudflare D1 migration: portable CMS core.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'subscriber' CHECK(role IN ('admin','editor','author','contributor','subscriber','viewer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS content_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('post','page','custom')),
  field_definitions TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO content_types (key,label,kind,field_definitions,is_system) VALUES
  ('post','Posts','post','[{"key":"title","label":"Title","type":"text","required":true},{"key":"body","label":"Body","type":"textarea"}]',1),
  ('page','Pages','page','[{"key":"title","label":"Title","type":"text","required":true},{"key":"body","label":"Body","type":"textarea"}]',1);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_key TEXT NOT NULL UNIQUE,
  storage_provider TEXT NOT NULL DEFAULT 'cloudflare-r2',
  url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  alt_text TEXT,
  title TEXT,
  caption TEXT,
  description TEXT,
  uploaded_by_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);
CREATE TABLE IF NOT EXISTS content_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  body_markdown TEXT,
  featured_media_id INTEGER,
  parent_id INTEGER,
  template_key TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','archived')),
  scheduled_at TEXT,
  published_at TEXT,
  archived_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  robots_index INTEGER NOT NULL DEFAULT 1,
  robots_follow INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_content_status_published ON content_entries(status,published_at);
CREATE INDEX IF NOT EXISTS idx_content_parent ON content_entries(parent_id);
CREATE INDEX IF NOT EXISTS idx_content_template ON content_entries(template_key);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER,
  robots_index INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  robots_index INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS content_categories (content_entry_id INTEGER NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY(content_entry_id,category_id));
CREATE TABLE IF NOT EXISTS content_tags (content_entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY(content_entry_id,tag_id));
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token_id TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL DEFAULT 'site',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_by_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(namespace,key)
);
INSERT OR IGNORE INTO site_settings(namespace,key,value,is_public) VALUES
  ('site','siteTitle','"Atelier Journal"',1),
  ('site','siteDescription','"An independent journal of fashion, culture, and considered living."',1),
  ('site','siteIndexing','true',1),
  ('site','theme','"fashion-editorial"',1);
