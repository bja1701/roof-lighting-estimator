ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_opened_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimate_sent_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS followup_count integer DEFAULT 0;
