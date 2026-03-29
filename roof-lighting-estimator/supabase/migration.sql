-- NexusFlow Roof Lighting Estimator — Trial Users
-- Run this in your Supabase SQL Editor (or via Supabase CLI)

CREATE TABLE IF NOT EXISTS trial_users (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email          text        UNIQUE NOT NULL,
  estimates_used integer     DEFAULT 0 NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  last_used_at   timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE trial_users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert new rows (first-time email capture)
CREATE POLICY "anon_insert" ON trial_users
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous users to read rows (to check their own estimate count on load)
CREATE POLICY "anon_select" ON trial_users
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous users to update their own row (increment estimate count)
CREATE POLICY "anon_update" ON trial_users
  FOR UPDATE TO anon
  USING (true);
