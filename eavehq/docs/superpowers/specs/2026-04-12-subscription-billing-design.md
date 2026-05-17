# Subscription Billing — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Branch:** feature/subscription-billing (new, off dev)

---

## Overview

Contractors pay $89/month to use the lighting estimator beyond 5 free estimates. Stripe Checkout handles payment. Supabase stores subscription state. The app gates the estimator based on that state.

Founders pricing ($44/month) is handled manually by Brighton via personal email — it never appears in the app UI.

---

## User Flow

1. **Post-signup** — A warm welcome modal appears on first login. It introduces the app, mentions 5 free estimates, and offers an upgrade CTA. User can close it and use free estimates immediately.

2. **Free tier active** — User runs estimates freely. A usage indicator (e.g., "3/5 estimates used") is shown somewhere persistent (header or sidebar) so the limit is never a surprise.

3. **Free tier exhausted** — When user attempts to start a 6th estimate, an upgrade modal appears instead. They cannot proceed without upgrading or closing (if estimates remain).

4. **Upgrade flow** — CTA opens a Stripe Checkout hosted page. On success, Stripe fires a webhook → Edge Function updates `profiles.subscription_status` to `active`. User lands back in the app, limit lifted.

5. **Settings escape hatch** — An "Upgrade Plan" option in Settings opens the same upgrade modal at any time.

6. **Cancellation** — Stripe fires `customer.subscription.deleted` → Edge Function sets status back to `free`. App re-gates on next session load.

---

## Architecture

Two new Supabase Edge Functions (Deno):

### `create-checkout-session`
- Called by the client when user clicks "Get started"
- Creates a Stripe Checkout Session (mode: `subscription`, price: `$89/month`)
- Embeds `supabase_user_id` in session metadata
- Returns `{ url }` — client redirects to it
- Auth: `verify_jwt: true` (user must be logged in)
- Env: `STRIPE_SECRET_SANDBOX_KEY`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `APP_URL`

### `stripe-webhook-sub`
- Receives `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET_SUB`
- On `checkout.session.completed`: sets `profiles.subscription_status = 'active'`, stores `stripe_customer_id` and `stripe_subscription_id`
- On `customer.subscription.deleted`: sets `profiles.subscription_status = 'free'`
- Auth: `verify_jwt: false`
- Env: `STRIPE_SECRET_SANDBOX_KEY`, `STRIPE_WEBHOOK_SECRET_SUB`

The existing `stripe-webhook` Edge Function (payment links) is untouched.

---

## Data Layer

### `profiles` table additions

```sql
subscription_status  text    NOT NULL DEFAULT 'free'  -- 'free' | 'active' | 'canceled'
stripe_customer_id   text    UNIQUE
stripe_subscription_id text  UNIQUE
```

Source of truth for active/inactive: `subscription_status` in Supabase (synced from Stripe via webhook). The app never calls Stripe at runtime — only reads Supabase.

### Existing utility

`isFreeTierEstimatorExhausted()` already exists and is the check point. The gate logic calls this + checks `subscription_status !== 'active'`.

---

## UI Components

### `UpgradeModal`
- Centered overlay, amber top bar (4px gradient, `#f59e0b → #fbbf24`)
- Background: `#1e2d45`, border-radius 16px
- No icon — title "Upgrade to Pro" stands alone (15px, 800 weight, `#e2e8f0`)
- Subtitle: "You've used all 5 free estimates" (11px, `#94a3b8`)
- Price block (inset dark panel): `$89/month`, "Unlimited estimates · Cancel anytime"
- CTA: amber button "Get started →" → calls `create-checkout-session`, redirects to Stripe
- Dismiss: "Not ready yet — use my remaining free estimates" (only shown if estimates remain)
- Backdrop click does NOT close (intentional friction)

### `WelcomeModal` (modified)
- Existing modal, already shown on first login
- Add a soft upgrade section at the bottom: "You have 5 free estimates. Upgrade anytime for unlimited access."
- Upgrade CTA opens `UpgradeModal`
- Close button remains prominent — no pressure

### Usage indicator
- Location: TBD (header or sidebar, finalize during implementation)
- Text: "X/5 estimates used" — hidden once `subscription_status === 'active'`

### Settings page
- Add "Plan & Billing" section
- Shows current plan (Free / Pro)
- "Upgrade Plan" button → opens `UpgradeModal`
- If active: shows "Manage subscription" link → Stripe Customer Portal (future scope, v2)

---

## Stripe Setup

1. Create a Product + recurring Price in Stripe dashboard: $89/month
2. Copy Price ID → `STRIPE_SUBSCRIPTION_PRICE_ID` env var in Supabase
3. Register webhook endpoint: `https://<project>.supabase.co/functions/v1/stripe-webhook-sub`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET_SUB` in Supabase secrets
5. Set `APP_URL` in Supabase secrets (success/cancel redirect)

Sandbox keys used throughout until production launch.

---

## Error Handling

- `create-checkout-session` failure: show inline error in modal, keep modal open, log to console
- Webhook signature invalid: return 400, do not update DB
- Stripe unreachable at checkout: Stripe's hosted page handles this natively
- Subscription status out of sync: manual fix path in Supabase dashboard (Brighton resolves directly for now — no automated reconciliation in v1)

---

## Out of Scope (v1)

- Stripe Customer Portal (manage/cancel from app)
- Annual billing option
- Founders pricing in-app
- Subscription pause/resume
- Usage analytics dashboard
- Email receipts beyond what Stripe sends automatically

---

## Success Criteria

- Contractor hits estimate #6 → sees upgrade modal
- Clicks "Get started" → lands on Stripe Checkout
- Completes payment → `subscription_status` flips to `active` within 10 seconds of webhook
- Returns to app → estimate #6 proceeds without modal
- Settings page shows "Pro" plan after upgrade
