-- Core schema for Canada grant finder MVP
-- Seekers (individual/org) + writers; guest browse needs only grants (+ listed writers)

CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  funder TEXT NOT NULL,
  applicant_types TEXT NOT NULL CHECK (applicant_types IN ('individual', 'organization', 'both')),
  eligibility_summary TEXT NOT NULL,
  amount_min INTEGER,
  amount_max INTEGER,
  amount_notes TEXT,
  deadline_at TEXT,
  deadline_notes TEXT,
  url TEXT NOT NULL,
  province_scope TEXT NOT NULL,
  disciplines TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'rolling')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_grants_province ON grants (province_scope);
CREATE INDEX idx_grants_status ON grants (status);
CREATE INDEX idx_grants_deadline ON grants (deadline_at);
CREATE INDEX idx_grants_applicant ON grants (applicant_types);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('seeker', 'writer')),
  seeker_kind TEXT CHECK (seeker_kind IN ('individual', 'organization') OR seeker_kind IS NULL),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'paid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_account_type ON users (account_type);

CREATE TABLE magic_link_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_magic_link_email ON magic_link_tokens (email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE seeker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT,
  province TEXT NOT NULL DEFAULT 'ON',
  disciplines TEXT NOT NULL DEFAULT '[]',
  org_name TEXT,
  bio TEXT,
  reminder_offsets TEXT NOT NULL DEFAULT '[14,7,3,1]',
  weekly_digest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saves (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL REFERENCES grants (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, grant_id)
);

CREATE INDEX idx_saves_grant ON saves (grant_id);

CREATE TABLE writer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  org_name TEXT,
  disciplines TEXT NOT NULL DEFAULT '[]',
  provinces TEXT NOT NULL DEFAULT '["ON"]',
  rate_range TEXT,
  bio TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT,
  listed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_writers_listed ON writer_profiles (listed);
