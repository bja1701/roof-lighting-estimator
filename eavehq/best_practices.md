# EaveHQ — Code Review Best Practices

This file is loaded by automated code reviewers (CodeRabbit, QODO) as context for every PR review.
Flag any violation as a blocking issue unless marked otherwise.

---

## Product Context

EaveHQ is a field service management SaaS for permanent roofline lighting contractors.
Two user types with a hard data boundary:

- **Contractor** — authenticated via Supabase Auth (JWT). Owns jobs, estimates, client records, settings.
- **Client** — authenticated via `portal_token` only (UUID in `jobs` table). No Supabase account. Accesses `/quote/:token` portal only.

A contractor must never see another contractor's data. A client must never see another client's data.
These boundaries are enforced by RLS — not application logic alone.

**Stack:** Vite + React 18 + TypeScript | Tailwind CSS | Zustand | Supabase (PostgreSQL + Edge Functions) | Stripe Connect Express | Resend | Vercel

---

## Supabase / Database Rules

### RLS is mandatory on every user-facing table

Every new table that stores contractor or client data MUST have Row Level Security enabled and at least one policy defined in the same migration. Flag any migration that:
- Creates a table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Creates a table without at least one RLS policy
- Disables RLS on an existing table

### Service role key is for edge functions only

`SUPABASE_SERVICE_ROLE_KEY` must never appear in frontend code (`lib/`, `components/`, `pages/`, `hooks/`, `store/`). It is only valid inside `supabase/functions/`. Flag any import or usage outside that directory.

### Anon key is for the frontend client only

`lib/supabase.ts` exports the anon-key client. This client respects RLS — it is correct for contractor-facing reads/writes. Do not use the service role client in frontend code.

### portal_token is the sole client auth mechanism

Client-facing operations authenticate via `portal_token` (UUID column on `jobs`). There is no JWT for clients. Edge functions serving client portal requests must validate `portal_token` against the `jobs` table, not check for a Supabase session. Flag any client-portal endpoint that skips token validation.

`portal_token` does not expire. It is a permanent secret URL token — the link itself is the client's credential. Do not add expiry logic without explicit approval.

### Migration filename format

Migrations must follow: `YYYYMMDDNNNNNN_description.sql` (e.g., `20260510000001_add_followup_settings.sql`).
Flag filenames that don't match this format.

---

## Stripe Rules

### Webhook signature verification is non-negotiable

Every Stripe webhook handler (`stripe-webhook`, `stripe-webhook-sub`, `portal-webhook`) must call `stripe.webhooks.constructEventAsync(body, sig, secret)` before processing any event. The raw request body must be read as text before any parsing. Flag any webhook handler that:
- Skips signature verification
- Parses the body as JSON before passing it to `constructEventAsync`
- Returns a 2xx response before verification completes

### Environment variable naming (legacy — do not "fix")

`STRIPE_SECRET_KEY` and `STRIPE_SECRET_SANDBOX_KEY` both point to the same Stripe account (legacy naming). Do not rename or consolidate these without explicit approval. Flag any PR that changes these variable names.

### Stripe Connect — funds go to contractor Express accounts

Contractor payouts must route through their connected Stripe Express account via `transfer_data`. Do not route payments to the platform account directly. Flag any checkout session creation that omits `transfer_data` for contractor payment flows.

### Test vs live mode

Dev/staging uses test keys. Production uses live keys (set via Supabase secrets). Never hardcode Stripe keys. Flag any hardcoded `sk_test_` or `sk_live_` strings in source code.

---

## TypeScript Rules

### No `any` without a comment

`any` type is allowed only when genuinely unavoidable. It must be accompanied by a comment explaining why. Flag bare `any` without justification.

### Types directory is the source of truth

Shared interfaces and types live in `types/`. Do not redefine types inline in component or page files if an equivalent already exists in `types/`. Flag duplicate type definitions.

### tsc must be clean

Every PR must pass `npx tsc --noEmit` with zero errors. Flag PRs that introduce TypeScript errors.

---

## Edge Function Rules

### Each function is a Deno module

Edge functions live in `supabase/functions/[name]/index.ts`. They use Deno — import from `https://esm.sh/` or `npm:` specifiers. Do not use Node.js `require()` or Node-specific APIs.

### Auth pattern by endpoint type

| Endpoint type | Auth method |
|---|---|
| Contractor-facing (subscription, billing, job management) | Validate JWT via Supabase client |
| Webhook handlers (Stripe) | Stripe signature verification only — no JWT |
| Client portal (quote, checkout) | `portal_token` validation against `jobs` table |

Flag any endpoint that uses the wrong auth method for its type.

### Email failures are non-blocking

Resend email calls must be wrapped so that failures do not prevent job status updates. Log email failures; do not return 500 for them. Flag any handler where an email failure would cause the entire operation to fail.

### Emails use contractor branding only

All client-facing emails must use the contractor's business name and logo — never "EaveHQ", "NexusFlow", or any platform branding. Flag any email template that hardcodes platform names or uses a platform logo instead of pulling from the contractor's profile.

### Follow-up email cadence

The follow-up cron (`send-followup`) currently fires twice per job (reminding the client about an unpaid estimate). Do not change this cadence without explicit approval. Future iterations may move to an unsubscribe-based model, but that is not current scope.

---

## Frontend Rules

### State lives in Zustand stores

Global application state belongs in `store/`. Do not lift state into top-level components or use React Context for app-wide state. Flag state that should be in `store/` but isn't.

### No direct DB calls from components

Components and pages must not import `supabase` and call `.from()` directly for mutations. Data mutations belong in hooks (`hooks/`) or Zustand store actions. Reads are acceptable in hooks. Flag direct Supabase mutation calls inside component render logic.

### Job status flow is strictly ordered

Valid transitions: `estimate_sent → scheduled → in_progress → complete → final_paid`
`final_paid` is terminal. No status may advance out of order. Flag any code that sets a job status without respecting this sequence.

### No discounts after deposit is paid

Discounts may only be applied before a deposit has been collected (`deposit_paid_at IS NULL`). Flag any code that applies or modifies discounts on a job where `deposit_paid_at` is set.

---

## Branch & PR Rules

- Feature branches cut from `dev`: `feature/[name]`
- Hotfixes cut from `master`: `hotfix/[name]`
- No direct commits to `dev` or `master`
- PRs to `master` require a passing `dev` branch baseline

---

## What to Flag as Blocking

| Issue | Severity |
|---|---|
| Missing RLS on new table | Blocking |
| Service role key in frontend code | Blocking |
| Stripe webhook without signature verification | Blocking |
| `portal_token` validation skipped on client endpoint | Blocking |
| TypeScript errors | Blocking |
| Hardcoded Stripe secret keys | Blocking |
| `any` type without justification comment | Non-blocking (warn) |
| Email failure causes 500 response | Non-blocking (warn) |
| Direct DB mutation in component | Non-blocking (warn) |
| Job status set out of sequence | Blocking |
