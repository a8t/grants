-- Discovery sources registry + staging proposals (human approve → grants)

CREATE TABLE grant_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  adapter_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT,
  last_error TEXT,
  last_found INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE grant_proposals (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES grant_sources (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  funder TEXT NOT NULL,
  url TEXT NOT NULL,
  deadline_at TEXT,
  deadline_notes TEXT,
  raw_excerpt TEXT,
  applicant_types TEXT NOT NULL DEFAULT 'both',
  amount_notes TEXT,
  province_scope TEXT NOT NULL DEFAULT 'ON',
  disciplines TEXT NOT NULL DEFAULT '[]',
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  published_grant_id TEXT REFERENCES grants (id),
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_proposals_status ON grant_proposals (status);
CREATE INDEX idx_proposals_source ON grant_proposals (source_id);
CREATE INDEX idx_proposals_dedupe ON grant_proposals (dedupe_key);

INSERT INTO grant_sources (id, name, base_url, adapter_key, enabled) VALUES
  ('src_tac', 'Toronto Arts Council', 'https://torontoartscouncil.org/grants/', 'tac', 1),
  ('src_oac', 'Ontario Arts Council', 'https://www.arts.on.ca/grants/', 'oac', 1),
  ('src_pch', 'Canadian Heritage funding hub', 'https://www.canada.ca/en/canadian-heritage/services/funding.html', 'canadian_heritage', 1);
