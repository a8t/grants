-- Paywall + deadline reminders: idempotent send log + writer lead inbox.

CREATE TABLE reminder_sends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL REFERENCES grants (id) ON DELETE CASCADE,
  deadline_date TEXT NOT NULL,
  offset_days INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_id TEXT,
  UNIQUE (user_id, grant_id, deadline_date, offset_days)
);

CREATE INDEX idx_reminder_sends_user ON reminder_sends (user_id);
CREATE INDEX idx_reminder_sends_sent ON reminder_sends (sent_at);

CREATE TABLE writer_leads (
  id TEXT PRIMARY KEY,
  writer_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  seeker_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_writer_leads_writer ON writer_leads (writer_user_id);
CREATE INDEX idx_writer_leads_seeker ON writer_leads (seeker_user_id);
