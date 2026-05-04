# EaveHQ — Status

> Shared progress ledger. Updated by Brighton (after Cursor/Antigravity sessions) and by
> Kai (Claude Code, after planning sessions). This is how all tools stay in sync.
>
> **After finishing work in Cursor/Antigravity:** move items to Done, note any blockers.
> **Kai reads this at the start of every session** to know current state without re-briefing.

---

## Current Sprint — Week of May 4–9, 2026

**Goal:** Ship Stripe live mode. Send real payment links to 10 founding members by Friday May 9.

### In Progress

- [ ] **Apply Phase 2 DB migration to production before Stripe live cutover**
  - Run: `supabase db push` from `eavehq/` with project linked to `bsbewwwflqjlxxovjgec`
  - Tables needed: `clients`, `job_notes`, `job_attachments`; columns: `scheduled_date`, `client_id` on `jobs`
  - Coordinate with Brighton before running — production schema change

- [ ] **Stripe live migration** — 9-step process, one chunk per morning (Mon–Thu)
  - Step 1: Create live-mode Stripe account objects (product, price, payment link)
  - Step 2: Swap env vars on Vercel (STRIPE_SECRET_KEY → live key)
  - Step 3: Swap STRIPE_PUBLISHABLE_KEY on Vercel
  - Step 4: Update STRIPE_WEBHOOK_SECRET (new live webhook endpoint)
  - Step 5: Update STRIPE_CONNECT_CLIENT_ID (live Connect app)
  - Step 6: Deploy updated edge functions referencing live Connect
  - Step 7: Smoke test: create test job → send estimate → pay deposit (live card)
  - Step 8: Verify Stripe Connect payout flow in live mode
  - Step 9: Update founding-member payment link in PRD.md

- [ ] **Founding member offer page**
  - `/founders` route built in the app
  - CTA is wired to `VITE_FOUNDERS_PAYMENT_LINK`
  - Enable after Stripe live migration creates the live founders payment link

### Done

- [x] **Phase 1 — Payment Processing** (built, merged to master, 2026-04-27)
  - Full estimate → deposit → final payment → payout flow
  - Stripe Connect Express onboarding
  - Resend email triggers

- [x] **Phase 2 — CRM / Job Tracking Dashboard** (merged to master 2026-04-29)
  - Dashboard list view + weekly calendar tab
  - Clients table + client detail page
  - Job notes (customer + private) + file attachments
  - CSV import with merge popup
  - ⚠️ DB migration NOT YET applied to production (supabase db push pending)

- [x] **Visual redesign (Phases 3–9a)** — MD3 tokens replaced with CSS vars + Lucide icons
  - Dashboard, clients, job detail notes, admin, auth, settings, portal, invoice, estimator

- [x] **Founding member subscription flow** (built, test mode)
  - Founders product/price created in Stripe test
  - Payment link generated

- [x] **Email tracking UI completion** (2026-05-03)
  - Job detail shows estimate sent date, client opened time, and follow-up count

- [x] **AdminPage visual redesign + first utility pass** (2026-05-03)
  - CSS vars + Lucide icons
  - User search/filter and estimates-used progress bars
  - Feedback attribution from the linked profile

- [x] **Page header typography consistency pass** (2026-05-04)
  - Unified title scale/font across core app pages (Dashboard, Jobs, Clients, Settings, Admin)
  - Normalized subtitle sizing to match the shared page-header pattern

---

## Backlog

*Ordered roughly by priority. Discuss with Brighton/Kai before starting.*

### High Priority

- [ ] **Email tracking UI** (partially built, needs wiring)
  - Show `estimate_sent_at`, `client_opened_at`, `followup_count` on job detail page

### Medium Priority

- [ ] **AdminPage — Revenue metrics**
  - MRR, active subs count, churn, new signups (last 7/30d)
  - Source from Stripe API (not Supabase) for accuracy

- [ ] **AdminPage — User table improvements**
  - Stripe link out to customer subscription

- [ ] **Garmin microservice** (spec in `nervous-system/personal/garmin-integration.md`)
  - Not EaveHQ — separate NexusFlow internal tool. Needs Brighton greenlight.

### Low Priority / Ideas

- [ ] **AdminPage — Email a user** via Resend from admin panel
- [ ] **AdminPage — Override estimates_used** (comping users)
- [ ] **AdminPage — Impersonate user** (view-as for debugging)
- [ ] **Client portal improvements** — show Phase 2 customer notes in portal
- [ ] **PDF invoice redesign** — matches new EaveHQ brand

---

## Known Issues / Blockers

| Issue | Severity | Notes |
|---|---|---|
| Phase 2 DB migration not applied to production | High | Clients table, job_notes, attachments all broken on prod until this runs |
| Stripe in test mode | High | No real revenue until live migration completes |
| Stripe-sourced admin metrics not built | Medium | Wait until live mode is stable so revenue numbers come from Stripe |

---

*Last updated: 2026-05-04 by Kai*
