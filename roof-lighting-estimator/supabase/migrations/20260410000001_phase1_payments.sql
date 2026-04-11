-- Phase 1: Payment processing columns
-- Adds status pipeline, Stripe payment links, deposit/final amounts, and client info to jobs table

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'estimate_sent';
-- Valid values: estimate_sent | deposit_paid | scheduled | in_progress | complete | final_paid | reviewed

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deposit_percent integer DEFAULT 50;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deposit_amount numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_amount numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stripe_deposit_link text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stripe_final_link text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_paid_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_phone text;

-- Constrain status to known values
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('estimate_sent','deposit_paid','scheduled','in_progress','complete','final_paid','reviewed'));
