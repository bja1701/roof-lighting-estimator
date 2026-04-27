# EaveHQ — Living Product Requirements Document

> This is the living PRD managed by `eavehq-planner`. The static header (everything
> above `## Features`) is edited by Brighton only. Feature blocks below are written
> and updated by `eavehq-planner` after grill mode.

## Static Header (Brighton edits only)

**Product vision:** A field service management platform purpose-built for permanent
roofline lighting contractors. One platform from first estimate to final payment,
built specifically for roofline lighting contractors.

**Target user:** Roofline lighting contractors (primary). Their clients (secondary — portal only).

**Supabase project:** `bsbewwwflqjlxxovjgec` (lighting-estimator-leads)

**Repo:** `~/Organization/projects/eavehq/eavehq/` (local) | `bja1701/roof-lighting-estimator` (GitHub)

**Production URL:** `https://eavehq.nexusflow.solutions`

**Vercel dev preview:** staging deployment on `dev` branch (check `vercel ls` for current URL)

**Tech stack:** Vite + React 18 + TypeScript | Tailwind CSS | Supabase (PostgreSQL, RLS) | Stripe + Connect Express | Resend | Vercel

**Branch strategy:** `feature/* → dev → master` | No direct commits to dev or master | Hotfixes: `hotfix/* → master`

**Key Stripe objects (TEST MODE):**
- Founders product: `prod_UOdsGZcDPrMxJk`
- Founders price ($44.50/mo): `price_1TPqb7AS5bwTFPC7e4OcgDAg`
- Founders payment link: `https://buy.stripe.com/test_6oU28q3O94ZkauYd5g7ok02`

**Phase priority (as of 2026-04-27):** Live mode migration (Stripe test → live keys) → CRM / job tracking dashboard (Phase 2) → founding member offer page

---

## Features

> Feature blocks below are written by `eavehq-planner`. Status field tracks pipeline state:
> `draft → approved → built → qa-passed`

## Feature: Phase 1 — Payment Processing
Status: built
Branch: (pre-pipeline — already merged to master)
Added: 2026-04-10
Updated: 2026-04-27

### What it does
Full payment flow from estimate to final payment. Contractor sends estimate options to client via Resend email; client selects an option and pays deposit via Stripe; contractor marks job complete which triggers a final payment email; final payment marks the job done. Contractor payouts routed via Stripe Connect Express.

### User stories
- Contractor can send estimate options email to client from the job detail page
- Client can select an estimate option and pay a deposit via Stripe (no account required)
- Contractor can see job status auto-update when deposit is received
- Contractor can mark a job complete, which triggers the final payment email automatically
- Client can pay the remaining balance via the client portal
- Contractor receives funds via their connected Stripe Express account

### UI changes
- Job detail page: "Send Options to Client" button + modal, "Mark Complete" button
- Settings page: Stripe Connect onboarding UI, subscription status/billing
- Client portal page: estimate selection, deposit payment, final payment
- Upgrade modal: subscription checkout flow

### Supabase changes
Jobs table: status, deposit_percent, deposit_amount, final_amount, stripe_deposit_link, stripe_final_link, stripe_customer_id, deposit_paid_at, final_paid_at, client_name, client_email, client_phone, estimate_sent_at, client_opened_at, followup_count, portal_token
Profiles table: subscription_status, stripe_customer_id, stripe_subscription_id, stripe_account_id, stripe_connect_enabled

### Edge functions affected
create-checkout-session, stripe-webhook-sub, cancel-subscription, create-connect-link, check-connect-status, send-estimate-options, stripe-webhook, portal-webhook, notify-final-payment, create-portal-checkout, create-final-checkout

### Stripe implications
Contractor subscriptions ($89/mo), Stripe Connect Express for contractor payouts, deposit + final payment checkout sessions, webhook handlers for checkout.session.completed and subscription events

### Error handling
Email failures are non-blocking (logged, job status still updates). Connect transfer_data rejected → fallback to platform account. Webhooks use signature verification.

### Dependencies
None — this is Phase 1 (foundation)

### Acceptance criteria
- [x] Contractor can send estimate options email from job detail
- [x] Client can pay deposit via Stripe without an account
- [x] Job status auto-updates within 60 seconds of deposit payment
- [x] Mark Complete triggers final payment email automatically
- [x] Client can pay final balance via portal
- [x] Contractor payouts routed via Stripe Connect Express

### QA test cases
- Golden path: create job → send options → client pays deposit → mark complete → client pays final → job = final_paid
- Edge case: client email missing — email skipped, no crash
- Failure mode: Stripe Connect not onboarded — fallback to platform account, funds still collected

---

## Legacy PRD Content (pre-pipeline)

> The content below is the original PRD from before the pipeline was set up.
> It is reference-only. New features use the feature block format above.

# NexusFlow Lighting Platform — Product Requirements Document

**Version:** 1.1  
**Date:** April 10, 2026  
**Owner:** Brighton Jones — NexusFlow Solutions  
**Status:** Draft — Pre-Build

---

## 1. Product Vision

A field service management platform purpose-built for permanent roofline lighting contractors. Replaces Google Earth (measurement) + Jobber/Housecall Pro (CRM) in a single tool — from first client contact to final payment to review request.

**The positioning:** "One platform from first estimate to final payment, built specifically for roofline lighting contractors."

---

## 2. Current State (April 2026)

| Feature | Status |
|---|---|
| Roofline measurement tool (Google Maps, gable pitch, PDF quote) | ✅ Live |
| User accounts + Supabase auth | ✅ Live |
| Free tier (5 estimates) | ✅ Live |
| Company branding / settings | ✅ Live |
| Admin dashboard | ✅ Live |
| Payment processing (Stripe subscriptions + Connect + deposit/final flow) | ✅ Live (test mode) |
| Job tracking pipeline (status: estimate_sent → final_paid) | ✅ Live (test mode) |
| Client-facing portal (estimate selection, deposit, final payment) | ✅ Live (test mode) |
| Multi-user / team access | ❌ Not built |
| Automated follow-ups / review requests | ❌ Not built |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS (CDN), Material Design 3 tokens |
| Database / Auth | Supabase (PostgreSQL, RLS, Storage) |
| Hosting | Vercel (GitHub → auto-deploy) |
| Payments | Stripe (Phase 1) |
| Email | Resend (Phase 4) |
| Version Control | GitHub — `bja1701/roof-lighting-estimator` |

---

## 4. Branch & Release Strategy

### Branch Structure
```
master      → Production (vercel.com, live to all users)
dev         → Staging (preview URL, internal testing only)
feature/*   → Individual features (merge to dev, never directly to master)
```

### Workflow
```
feature branch
  → PR into dev
    → QA on Vercel preview URL (in-house only)
      → merge dev → master
        → auto-deploy to production
```

### Rules
- **No direct commits to `master`.** All changes go through `dev` first.
- `dev` is dog-fooded by Brighton in daily use for a minimum of 48 hours before merging to `master`.
- Founders tier (beta testers) receive features on `dev` preview before `master` release.
- Hotfixes (payment-path bugs, auth failures) bypass `dev` and go `hotfix/* → master` directly.
- Each merge to `master` gets a version tag (e.g., `v0.2.0`) and auto-generated release notes.

### Vercel Configuration
- `master` branch → production deployment (custom domain, all users)
- `dev` branch → staging deployment (internal preview URL, Brighton + beta testers only)
- All `feature/*` branches → ephemeral preview deployments (for PR review only)

### Setup Steps (Before Any Phase 1 Code)
1. Create `dev` branch from current `master`: `git checkout -b dev && git push origin dev`
2. In Vercel dashboard: add `dev` branch as a branch deployment → assign staging URL
3. Set branch protection on GitHub: require PR review before merging to `master`

---

## 5. Automated Quality Pipeline

Two sub-systems: one for **runtime errors** (automatic), one for **user-reported bugs** (triggered by feedback).

---

### 5a. Automated Runtime Error Reporting

**Goal:** If the app breaks in production, Brighton knows within minutes — with a proposed fix attached — without a user needing to report it.

**Pipeline:**
```
Runtime error occurs (React error boundary OR Supabase function failure)
  → Error logged to platform_errors table in Supabase
    → Supabase Edge Function triggers on insert (deduplication: same error < 1hr = skip)
      → Calls Claude API with: error message, stack trace, page URL, app version
        → Agent outputs: root cause, severity, proposed fix (file + diff)
          → Telegram message sent to Brighton:
              "🔴 [High] NullPointerException on /estimator
               Likely cause: profile not loaded before render
               Proposed fix: Add null check in EstimatorPage.tsx line 42
               Confidence: 87%"
```

**Alert thresholds:**
- Payment-path errors → always alert immediately
- Same error hits ≥ 2 users within 1 hour → alert
- All other errors → batch into nightly digest (10pm MT)

**Supabase table:**
```sql
CREATE TABLE platform_errors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  user_id     uuid REFERENCES auth.users,
  page        text,
  message     text,
  stack       text,
  app_version text,
  ai_summary  text,
  ai_fix      text,
  resolved    boolean DEFAULT false
);
```

---

### 5b. User-Reported Bug Triage Agent

**Goal:** When a user reports a bug via the in-app feedback button, an agent reviews it, summarizes the issue, proposes a fix, and passes it to Brighton with a clear action item.

**Pipeline:**
```
User taps "Report a Bug" in FeedbackButton
  → Submits: description + current page + optional screenshot
    → Saved to feedback table (type: 'bug')
      → Edge Function triggers on insert
        → Claude agent reviews: user description + any matching platform_errors
          → Outputs: severity, root cause, proposed fix, confidence
            → Telegram to Brighton:
                "🐛 Bug from [user] on /jobs
                 'The job status doesn't update after I pay'
                 Likely cause: Stripe webhook not reaching dev environment
                 Proposed fix: Check webhook endpoint configuration in Supabase
                 Severity: Medium | Confidence: 92%"
              → Brighton responds with approve/modify/dismiss
```

**Brighton never manually triages raw bug reports.** Agent does the first pass every time.

**Feature requests** (type: 'feature_request') are batched into a weekly digest with AI-generated priority scores based on frequency and user tier.

**Supabase schema additions to feedback table:**
```sql
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS type text DEFAULT 'feedback';
-- 'feedback' | 'bug' | 'feature_request'
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS severity text;
-- set by agent: 'low' | 'medium' | 'high'
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_proposed_fix text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false;
```

---

### 5c. Constraints
- Agent **never auto-deploys.** Brighton approves every fix before it goes to `dev`.
- Agent **never modifies the database directly.** Proposes migration SQL only.
- If agent confidence < 70%: sends summary without proposed fix, flags as "needs manual review."

---

## 6. Phase 1 — Payment Processing (Build Now)

**Goal:** Close the #1 objection from discovery calls. Contractors currently need a separate CRM to accept payments.

**Success metric:** A contractor can generate an estimate AND collect a deposit from a client without leaving the app.

### 6.1 Stripe Integration

**Approach:** Stripe Payment Links (no custom payment UI needed — Stripe hosts the checkout page).

**Flow:**
1. Contractor saves an estimate to a job
2. On the job detail page: contractor sets deposit % (default: 50%)
3. App generates a Stripe Payment Link via Stripe API (one-time, scoped to this job)
4. Contractor copies the link or embeds it in a PDF / email to the client
5. Client opens the link, pays via Stripe Checkout (no account required)
6. Stripe webhook fires → Supabase updates job status to `deposit_paid`

**What to build:**
- Stripe API integration (server-side via Supabase Edge Function — keeps secret key off client)
- "Generate Payment Link" button on Job Detail page
- Payment link stored against job record in Supabase
- Stripe webhook handler (Edge Function) → updates `jobs` table on payment events
- Final payment flow: after job complete, contractor triggers final invoice link (remaining balance)

### 6.2 Job Status Pipeline

Each job moves through these stages (manually or auto-triggered by webhooks):

```
Estimate Sent → Deposit Paid → Scheduled → In Progress → Complete → Final Paid → Reviewed
```

**What to build:**
- `status` field on `jobs` table (enum of above stages)
- Status badge on Job cards (Jobs page)
- Stage-advance button on Job Detail page ("Mark as Scheduled", "Mark Complete", etc.)
- Webhook handler auto-advances status on Stripe payment events

### 6.3 Database Changes

```sql
-- Jobs table additions
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'estimate_sent';
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
```

### 6.4 Acceptance Criteria
- [ ] Contractor can generate a Stripe payment link from a job in < 30 seconds
- [ ] Link works for client on mobile without a Stripe account
- [ ] Job status auto-updates within 60 seconds of payment
- [ ] Final payment link can be generated after job is marked complete
- [ ] Payment amounts are visible on the job card

---

## 7. Phase 2 — Job Tracking Dashboard

**Goal:** Contractors manage their full pipeline from a single view.

**What to build:**
- Job cards with status pipeline labels
- Filter/sort by status, date, client
- Kanban toggle (optional — list view is default)
- Job detail page: client info, estimate PDF, payment history, notes

**Depends on:** Phase 1 (status field, client fields)

---

## 8. Phase 3 — Multi-User Team Access + Client Portal

**Goal:** Crew members can view jobs without a contractor account. Clients can view and pay their invoice from a shareable link.

### Team Access
- Invite system: contractor invites crew via email
- Roles: `owner` (full access) | `crew` (view + update status only)
- RLS policies scoped to `team_id`

### Client Portal
- Public-facing URL: `/quote/[token]`
- No login required for client
- Client sees: estimate details, PDF, payment status, payment button
- Contractor controls what's visible

**Depends on:** Phase 1 + Phase 2

---

## 9. Phase 4 — Automated Follow-ups + Review Requests

**Goal:** Reduce contractor admin — automate the touchpoints that consistently get skipped.

**What to build:**

| Trigger | Delay | Action |
|---|---|---|
| Estimate sent | 3 days, no deposit | Email: "Hey [client], just following up on your estimate" |
| Deposit paid | Immediate | Email: "Deposit received — here's what to expect next" |
| Job marked complete | 2 days | Email: "Hope you love the lights! Mind leaving us a review?" |
| Final payment received | Immediate | Email: "Receipt + thank you" |

- Message templates configurable in Settings
- Google/Yelp review link configurable in Settings
- Opt-out link included in all automated emails (CAN-SPAM compliance)
- Powered by Resend (free tier: 3,000 emails/month)

**Depends on:** Phase 1–3 + client email on job record

---

## 10. Pricing Model

| Tier | Price | Limits | Target |
|---|---|---|---|
| Free | $0 | 5 estimates total | Tryout / demo |
| Monthly | $89/month | Unlimited estimates | Active contractors |
| Founders | $44/month forever | Unlimited | First 10 beta testers |

**No per-estimate pricing. Monthly subscriptions only.**

**Billing notes:**
- Monthly and Founders tiers billed via Stripe Subscriptions
- Founders tier locked to first 10 signups — show a live counter on the pricing page
- Free → paid upgrade prompt after 4th estimate (one before the wall)
- No per-job, per-estimate, or usage-based billing — ever

---

## 11. Open Questions (Decide Before Phase 1 Build)

1. **Stripe account:** Does Brighton have a Stripe account set up? Personal or business?
2. **Stripe fees:** Inform contractors that Stripe takes 2.9% + $0.30 per transaction. Does the app pass this through or absorb it?
3. **Client email:** Currently not captured on jobs. Phase 1 needs it. Add to the New Job form?
4. **PDF embed:** Should the payment link appear inside the generated PDF quote, or only in the app UI?
5. **Dev branch:** Confirm GitHub `dev` branch creation and Vercel preview config before any Phase 1 code is written.

---

## 12. Out of Scope (For Now)

- Native mobile app (web is mobile-responsive)
- SMS notifications (Phase 4+ — Twilio adds complexity and cost)
- QuickBooks / accounting integrations
- Material ordering or supplier integrations
- AI-powered measurement (beyond current Google Maps implementation)

---

*Document maintained by Brighton Jones / NexusFlow Solutions. Update version number on each revision.*
