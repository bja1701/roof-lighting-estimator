# EaveHQ Redesign — Phase Tracker

Branch: `redesign/phase-1-foundation`

## Design System

All tokens live in `eavehq/src/index.css` (CSS custom properties):

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#3a6349` | Forest green — primary actions, links |
| `--color-primary-dark` | `#1f3d2c` | Dark header backgrounds |
| `--color-accent` | `#d96f0a` | Orange — CTAs, highlights, prices |
| `--color-surface` | `#f5f2ed` | Warm off-white page background |
| `--color-card` | `#ffffff` | Card/modal backgrounds |
| `--color-border` | `#dedad4` | All borders |
| `--color-ink` | `#1a1a1a` | Primary text |
| `--color-slate` | `#5a6070` | Secondary/muted text |
| `--color-success` | `#3d9e6a` | Success states |
| `--color-destructive` | `#c94040` | Errors, destructive actions |
| `--font-display` | `'Syne'` | Headlines, labels, buttons |
| `--font-body` | `'DM Sans'` | Body text |
| `--font-mono` | `'Geist Mono'` | Numbers, prices, code |

---

## Phase Status

### ✅ Phase 1 — Design token foundation
Commit: `553931d`
- Added CSS custom properties to `globals.css`
- Removed dead code / unused imports
- Installed Syne, DM Sans, Geist Mono via Google Fonts

### ✅ Phase 2 — Shell, mobile nav, toast system
Commit: `b574dbc`
- `SharedLayout.tsx` — dark primary-dark nav, mobile bottom tab bar
- `useToast` hook + `ToastProvider` — replaces all `alert()` calls
- `ConfirmDialog` component — replaces all `window.confirm()` calls

### ✅ Phase 3 — JobsPage
Commit: `2bf854d`
- MD3 → CSS vars throughout
- `material-symbols-outlined` → Lucide icons
- Status chips use CSS var color mapping

### ✅ Phase 4 — JobDetailPage
Commit: `531e1b1`
- Full MD3 → CSS vars, all Material Symbols → Lucide
- `alert()`/`confirm()` → `useToast`/`ConfirmDialog`
- Stats only shown when quotes exist
- Mono font for all numbers, `timeAgo` shows absolute date past 7 days

### ✅ Phase 5 — Estimator (mobile-first)
Commit: `e830467`
Files: `EstimatorPage.tsx`, `EditorToolbar.tsx`, `PricingPanel.tsx`, `SearchBar.tsx`, `VisualPitchTool.tsx`
- `EditorToolbar` — removed hover-reveal (broken on mobile); always-visible floating pill at bottom of canvas
- `PricingPanel` — dark glass panel with `rgba(15,25,40,0.92)` bg
- `SearchBar` — dark glass input for map overlay
- `VisualPitchTool` — primary-dark panels, accent pitch readout

### ✅ Phase 6 — Client portal pages
Commit: `660d241`
Files: `ClientPortalPage.tsx`, `ClientPortalSuccessPage.tsx`, `ClientPortalFinalSuccessPage.tsx`
- Extracted `PayCard`, `PayButton`, `SuccessBanner`, `ErrorBanner`, `StripeBadge` helpers
- Quote selection cards use accent border + tint when selected
- Lucide CreditCard/CheckCircle/Loader2
- "Powered by EaveHQ" footer

### ✅ Phase 7a — Auth + Settings + Invoice pages
Commit: `5ec25e1`
Files: `AuthPage.tsx`, `ResetPasswordPage.tsx`, `SettingsPage.tsx`, `InvoicePage.tsx`
- Auth: dark `var(--color-primary-dark)` shell, glass card
- Settings: Lucide icons throughout, toggle uses `var(--color-primary)`
- Invoice: dark forest green header, mono font for prices, CSS var table styling

### ✅ Phase 7b — Modal + card components (8 files)
Commit: `2732c54`
Files: `QuoteCard.tsx`, `NewJobModal.tsx`, `WelcomeModal.tsx`, `FeedbackButton.tsx`, `SaveToJobModal.tsx`, `ProWelcomeModal.tsx`, `SetupChecklist.tsx`, `PaymentSection.tsx`
- Consistent green overlay (`rgba(31,61,44,0.6)`) on all modals
- Accent top stripe on all modals
- CSS var inputs, labels, buttons throughout
- Lucide icons replace all `material-symbols-outlined`

### ✅ Phase 8 — Email templates (4 edge functions)
Commit: `bfbdbeb`
Functions: `send-estimate-options`, `send-deposit-request`, `send-followup`, `notify-final-payment`
- Dark green brand header (`#1f3d2c`) + `#d96f0a` accent stripe
- CTA buttons: `#f59e0b` → `#d96f0a` (matches app accent)
- Warm surface background (`#f5f2ed`) instead of generic gray
- "Sent via EaveHQ" footer attribution

---

## Remaining Work

### 🔲 AdminPage — Visual + Functional overhaul
See `ADMIN-TODO.md` for full spec.

**Visual (Phase 9a):**
- Same MD3 → CSS vars swap as all other pages
- `material-symbols-outlined progress_activity` → `<Loader2 className="animate-spin" />`
- Feedback star rating: `material-symbols-outlined star` → Lucide `Star`

**Functional (Phase 9b — needs Brighton input on priorities):**
- Revenue metrics: MRR, total active, churn, new signups (7d/30d)
- User table: search/filter by name/email/tier
- Feedback: show user attribution, mark as resolved
- Override `estimates_used` for individual users
- Stripe dashboard link-out per user
- Email a user directly from admin

### 🔲 Phase 9 — Polish pass + DESIGN.md
- Final tsc clean run across entire project
- Generate `DESIGN.md` documenting the implemented system
- Push to Vercel preview for Brighton's sign-off before merging to main

---

## How to deploy to preview

```bash
cd eavehq
vercel --prebuilt  # or: git push → Vercel picks up the branch automatically
```

The branch `redesign/phase-1-foundation` auto-deploys to a Vercel preview URL on push.
