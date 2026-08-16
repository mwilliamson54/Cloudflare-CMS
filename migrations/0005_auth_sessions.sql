-- Cloudflare D1 migration: production browser sessions and double-submit CSRF state.
-- This migration is additive and does not alter or delete existing CMS records.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at, revoked_at);
