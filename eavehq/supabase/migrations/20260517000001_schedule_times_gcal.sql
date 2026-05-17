-- Schedule redesign: add time columns to jobs, GCal fields to jobs + profiles

-- Jobs: start/end times for scheduled slots, anytime flag, GCal event ID
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_start_time time,
  ADD COLUMN IF NOT EXISTS scheduled_end_time   time,
  ADD COLUMN IF NOT EXISTS scheduled_anytime    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gcal_event_id        text;

-- Profiles: GCal OAuth token storage
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gcal_connected      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gcal_refresh_token  text;
