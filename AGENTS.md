# EaveHQ — Agent Context

> This file is the single source of truth for any AI coding tool (Cursor, Google Antigravity,
> Claude, Gemini, etc.). Read this before touching any code. Read STATUS.md for what's
> currently in progress.

---

## What This Is

EaveHQ is a SaaS field service management platform purpose-built for permanent roofline
lighting contractors. One platform from first estimate to final payment. Live at
`https://eavehq.nexusflow.solutions`.

Owner: Brighton Anderson (NexusFlow Solutions). Do not contact clients or push to
production without explicit Brighton approval.

---

## Repo Structure

```
projects/eavehq/               ← git root
├── AGENTS.md                  ← YOU ARE HERE — read first
├── STATUS.md                  ← current sprint + backlog — read second
├── PRD.md                     ← living product requirements (managed by Kai)
├── ADMIN-TODO.md              ← pending admin page work
├── eavehq/                    ← the React app
│   ├── App.tsx                ← routes + auth guard
│   ├── pages/                 ← one file per route
│   ├── components/            ← shared UI components
│   ├── hooks/                 ← useAuth.ts, useProfile.ts
│   ├── store/                 ← useEstimatorStore.ts (canvas state)
│   ├── lib/supabase.ts        ← supabase client
│   ├── utils/                 ← pure helper functions
│   └── supabase/functions/    ← Supabase edge functions (Deno)
└── supabase/                  ← supabase CLI config + migrations
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 |
| State | Zustand |
| Styling | Tailwind CSS (CDN) + CSS custom properties |
| Maps | `@react-google-maps/api` |
| Icons | **Lucide React** (do not use Material Symbols) |
| Backend/DB | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Routing | `react-router-dom` v7 |
| Payments | Stripe + Stripe Connect Express |
| Email | Resend |
| Hosting | Vercel (auto-deploy from GitHub `master`) |

---

## Supabase

- **Project ID:** `bsbewwwflqjlxxovjgec` (lighting-estimator-leads)
- **Local dev:** `supabase start` from `eavehq/` directory
- **Migrations:** `supabase/migrations/` — always create a new migration file, never edit existing ones
- **Edge functions:** `eavehq/supabase/functions/` — Deno runtime, TypeScript
- **Deploy edge functions:** `supabase functions deploy <name>` from `eavehq/`

---

## Branch Strategy

```
feature/* ──→ dev ──→ master (production)
hotfix/*  ──→ master
```

- **Never commit directly to `dev` or `master`.**
- Always branch from `dev`: `git checkout dev && git pull && git checkout -b feature/your-feature`
- PRs: `feature/* → dev` (reviewed by Brighton or Kai)
- Hotfixes: `hotfix/* → master` directly

---

## Stripe Context

**Current status: Mid-migration from TEST to LIVE mode.**

| Object | Test | Live |
|---|---|---|
| Founders product | `prod_UOdsGZcDPrMxJk` | TBD — set during live migration |
| Founders price | `price_1TPqb7AS5bwTFPC7e4OcgDAg` | TBD |
| Founders payment link | `https://buy.stripe.com/test_6oU28q3O94ZkauYd5g7ok02` | TBD |

**Do not hardcode Stripe keys.** All keys come from Vercel env vars (`STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`).
Test vs live is controlled by which key is set — not by code changes.

---

## Coding Conventions

### CSS / Styling
- Use CSS custom properties: `var(--color-card)`, `var(--color-surface)`, `var(--color-ink)`, `var(--color-slate)`, `var(--color-primary)`
- **Do NOT use Material Design 3 tokens:** no `bg-surface-container-*`, `text-on-surface*`, `text-primary` class, `font-headline`, `font-label`
- **Do NOT use Material Symbols.** Use Lucide React for all icons: `import { Loader2 } from 'lucide-react'`
- Spinner: `<Loader2 className="animate-spin" />`
- Font display: `fontFamily: 'var(--font-display)'` inline style or Tailwind class if mapped

### TypeScript
- Strict mode is on. No `any` without a comment explaining why.
- Types live in `types/` for shared shapes; inline for component-local types.
- Supabase-generated types are in `types/supabase.ts` — do not hand-edit.

### Components
- One component per file. Filename = component name (PascalCase).
- Props interfaces at top of file, not exported unless needed elsewhere.
- No default exports for hooks. Named exports only.

### Edge Functions (Deno)
- File structure: `supabase/functions/<function-name>/index.ts`
- Always verify Stripe webhook signatures before processing.
- Use `corsHeaders` from `../shared/cors.ts` — do not copy-paste CORS headers.
- Return proper HTTP status codes: 200 success, 400 bad request, 500 server error.

### Testing
- Playwright tests live in `eavehq/tests/`
- Run: `npx playwright test` from `eavehq/`
- TypeScript check: `npx tsc --noEmit` from `eavehq/` — must pass before any PR

---

## Code Review Checklist

Every PR must pass all items before merge. Each is a hard PASS/FAIL — no "consider" or "maybe."

- No `any` without an inline comment explaining why it's unavoidable
- No unused imports, exports, or variables
- No component responsible for more than one concern (single responsibility)
- No hardcoded strings that belong in constants or environment variables
- CSS: only `var(--color-*)` tokens — no raw hex values, no Tailwind color utilities outside the approved CSS custom property set
- No copy-pasted CORS headers — use the shared `cors.ts` from `supabase/functions/shared/cors.ts`
- All async functions handle errors explicitly — no empty catch blocks, no silent swallows
- Stripe webhook handlers must verify signature before processing any payload
- Edge functions return proper HTTP status codes: 200 success, 400 bad request, 500 server error
- `tsc --noEmit` must pass — zero type errors allowed
- No direct commits to `master` or `dev` branches
- No Stripe live-mode objects created without explicit Brighton approval

---

## Cross-AI Review Protocol

Every code change goes through cross-review before merge:

**Claude wrote it → Codex reviews it:**
From `eavehq/` directory, after implementation:
```
git diff dev...HEAD | codex exec "You are a strict senior TypeScript engineer reviewing EaveHQ code. Check this diff against every item in the Code Review Checklist in AGENTS.md. For each checklist item, output PASS or FAIL with a one-line reason. If any item FAILS, list the exact file and line. Be brutal. No encouragement."
```

**Codex wrote it → Claude reviews it:**
Open Claude Code in this repo and run `/review` or invoke the `superpowers:requesting-code-review` skill. Claude checks the diff against the Code Review Checklist and produces a structured PASS/FAIL report.

Neither AI's code merges without the other reviewing it.

---

## What NOT To Do

- Do not commit secrets, API keys, or `.env` files
- Do not run `supabase db reset` on the linked production project
- Do not send emails to real clients (Resend is live — all test emails go to Brighton's address)
- Do not create Stripe live-mode objects without explicit approval
- Do not modify `supabase/migrations/` files that have already been applied to production
- Do not push directly to `master` — ever

---

## Sync Protocol

When you finish a task in this IDE, update `STATUS.md`:
1. Move the completed item from `In Progress` to `Done` with today's date
2. If you started something new, add it to `In Progress`
3. Add any blockers or notes you found under the relevant item

This is how Kai (Claude Code) stays in sync with what you've built.

---

## Key Files to Know

| File | Purpose |
|---|---|
| `eavehq/App.tsx` | Route definitions + auth guard |
| `eavehq/lib/supabase.ts` | Supabase client singleton |
| `eavehq/hooks/useAuth.ts` | Auth state (Zustand) |
| `eavehq/hooks/useProfile.ts` | Profile + branding (Zustand) |
| `eavehq/pages/SettingsPage.tsx` | Stripe Connect onboarding UI |
| `eavehq/supabase/functions/` | All edge functions |
| `supabase/migrations/` | DB schema history |
