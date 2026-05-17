-- Subscription billing columns for Stripe integration
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status  text NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'canceled')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;

-- Index for webhook lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id);
