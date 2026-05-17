ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followup_days integer DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followup_max integer DEFAULT 2;
