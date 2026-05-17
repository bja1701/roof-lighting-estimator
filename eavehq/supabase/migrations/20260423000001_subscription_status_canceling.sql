-- Extend subscription_status to support 'canceling' (cancel_at_period_end set,
-- user still has access). past_due is not tracked in the app — Stripe handles
-- the full dunning lifecycle and fires customer.subscription.deleted on
-- exhaustion, which sets 'canceled'.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'active', 'canceling', 'canceled'));
