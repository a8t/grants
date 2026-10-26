-- Structured multi-deadline support (ISO dates only).
-- deadlines_json: [{"date":"YYYY-MM-DD","label":"LOI"|null}, ...]
-- deadline_at remains denormalized "next upcoming" (or legacy) for sort/filter.
-- deadline_notes stays for rolling / TBD prose — never a calendar date.

ALTER TABLE grants ADD COLUMN deadlines_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE grant_proposals ADD COLUMN deadlines_json TEXT NOT NULL DEFAULT '[]';

-- Backfill grants: single deadline_at → one-element array when ISO.
UPDATE grants
SET deadlines_json = json_array(json_object('date', deadline_at, 'label', null))
WHERE deadline_at IS NOT NULL
  AND length(deadline_at) = 10
  AND deadline_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  AND (deadlines_json IS NULL OR deadlines_json = '' OR deadlines_json = '[]');

-- Backfill proposals similarly.
UPDATE grant_proposals
SET deadlines_json = json_array(json_object('date', deadline_at, 'label', null))
WHERE deadline_at IS NOT NULL
  AND length(deadline_at) = 10
  AND deadline_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  AND (deadlines_json IS NULL OR deadlines_json = '' OR deadlines_json = '[]');

-- Known multi-intake seed rows (Ontario Creates) — structured dual dates.
UPDATE grants
SET deadlines_json = '[{"date":"2026-04-23","label":"intake 1"},{"date":"2026-11-15","label":"intake 2"}]',
    deadline_at = '2026-11-15',
    deadline_notes = 'Two intakes per year'
WHERE id = 'g_cur_oc_music_company';

UPDATE grants
SET deadlines_json = '[{"date":"2026-04-30","label":"intake 1"},{"date":"2026-11-30","label":"intake 2"}]',
    deadline_at = '2026-11-30',
    deadline_notes = 'Two intakes per year'
WHERE id = 'g_cur_oc_music_futures';
