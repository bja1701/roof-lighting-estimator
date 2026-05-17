-- Enable required extensions (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily follow-up job at 9am UTC
SELECT cron.schedule(
  'daily-followup',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-followup',
    headers := '{"Content-Type":"application/json","x-cron-secret":"' || current_setting('app.cron_secret') || '"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
