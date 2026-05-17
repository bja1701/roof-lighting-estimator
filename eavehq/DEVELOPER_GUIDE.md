# Roof Lighting Estimator — Developer Guide

> Zero-context onboarding. If you're opening this repo for the first time, this document gets you from `git clone` to fully understanding the system in under 30 minutes.

---

## 1. What the App Does

A SaaS tool for roofing/lighting contractors to estimate holiday and permanent LED roofline lighting jobs. Users search a client's address, use Google Maps satellite view to trace rooflines, assign pitch multipliers to each segment, and get an instant linear-footage and price estimate. Estimates are saved as "Quotes" within "Jobs" and can be downloaded as branded PDF invoices.

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Component model, strict typing |
| Build tool | Vite 6 | Fast dev server, ESM output |
| State management | Zustand | Simple, no boilerplate |
| Styling | Tailwind CSS (CDN) | Rapid utility-first styling |
| Maps | `@react-google-maps/api` | Google Maps + Street View + Autocomplete |
| Backend/DB | Supabase (Postgres + Auth + Storage) | Auth, RLS, real-time, file storage |
| Routing | `react-router-dom` v7 | Client-side routing |
| PDF export | Browser `window.print()` | No dependency, works everywhere |
| Hosting | Vercel | Auto-deploy from GitHub |

---

## 3. Architecture

```
Browser (React SPA)
│
├── App.tsx           ← BrowserRouter + route definitions + auth guard
├── pages/
│   ├── AuthPage      ← Login / sign-up (public)
│   ├── JobsPage      ← Jobs dashboard (/)
│   ├── JobDetailPage ← Quotes list for a job (/jobs/:id)
│   ├── EstimatorPage ← Canvas drawing tool (/estimator)
│   ├── SettingsPage  ← Branding + pricing (/settings)
│   └── AdminPage     ← User/feedback management (/admin)
├── components/
│   ├── SatelliteCanvas   ← Google Maps satellite + node/line drawing
│   ├── VisualPitchTool   ← Street View pitch measurement
│   ├── PricingPanel      ← Cost display + breakdown drawer
│   ├── SaveToJobModal    ← Save estimate to a job
│   ├── QuoteCard         ← Quote display + PDF print trigger
│   ├── FeedbackButton    ← Floating feedback widget
│   └── WelcomeModal      ← First-login "5 free estimates" modal
├── hooks/
│   ├── useAuth.ts    ← Zustand store wrapping Supabase auth session
│   └── useProfile.ts ← Zustand store for profile/branding/pricing
├── store/
│   └── useEstimatorStore.ts ← Canvas state (nodes, lines, pricing, totals)
└── lib/
    └── supabase.ts   ← Supabase client (reads VITE_SUPABASE_*)
```

**Data flow for "user saves a quote":**
1. User traces rooflines on `SatelliteCanvas` → nodes/lines stored in `useEstimatorStore`
2. `PricingPanel` reads store → displays running total
3. User clicks "Save Estimate" → `SaveToJobModal` opens
4. Modal builds `line_items` JSON from store, picks/creates a job, calls `supabase.from('quotes').insert(...)`
5. `profiles.estimates_used` increments via `useProfile.incrementEstimates()`
6. User redirected to `JobDetailPage` → `QuoteCard` renders the saved quote
7. "Download PDF" button opens a print window with branded HTML → user saves as PDF

---

## 4. Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Same as above |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | Google Cloud Console → APIs & Services |
| `GEMINI_API_KEY` | Gemini API key (optional, for AI features) | Google AI Studio |

Copy `.env.example` to `.env` and fill in all values. For Vercel, add these as environment variables in the project settings (Settings → Environment Variables).

---

## 5. Supabase Schema

### `profiles`
Auto-created via DB trigger when a user signs up. One row per user.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `full_name` | text | Used on PDF exports |
| `company_name` | text | Used on PDF exports |
| `email` | text | Copied from auth on signup |
| `phone` | text | Used on PDF exports |
| `logo_url` | text | Public URL of logo in Supabase Storage (`logos` bucket) |
| `brand_color` | text | Hex color, default `#f59e0b` (amber). Accent bar on PDFs. |
| `price_per_foot` | numeric | Default $4.00. Loaded into estimator on login. |
| `controller_fee` | numeric | Default $300. Added to total when `include_controller = true`. |
| `include_controller` | boolean | Whether controller fee is included by default |
| `subscription_tier` | text | `'free'` \| `'retainer'` \| `'paid'` |
| `estimates_used` | int | Incremented on every saved quote. Free tier cap: 5. |
| `welcome_shown` | boolean | Flipped to `true` after WelcomeModal is dismissed |
| `role` | text | `'user'` \| `'admin'`. Admins see the `/admin` route. |

### `jobs`
One job per client/address project. A job has many quotes.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles) | Owner |
| `name` | text | e.g. "Smith Residence" |
| `address` | text | Optional street address |
| `notes` | text | Optional notes |

### `quotes`
One estimate within a job. Stores both summary data and the full canvas state for restore.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `job_id` | uuid (FK → jobs) | Parent job |
| `label` | text | e.g. "Estimate A", "Roofline Package" |
| `line_items` | jsonb | Array of `{ id, type, pitch, length3d, startNode, endNode }` |
| `notes` | text | Installer notes (shown on PDF) |
| `price_per_foot` | numeric | Snapshot of price at time of save |
| `controller_fee` | numeric | Snapshot |
| `include_controller` | boolean | Snapshot |
| `total_linear_ft` | numeric | Calculated 3D linear footage |
| `total_price` | numeric | Final price including controller if applicable |
| `canvas_state` | jsonb | Full canvas snapshot: `{ nodes, lines, pricePerFt, controllerFee, includeController, satelliteCenter }`. Used to restore the canvas when editing. |

### `feedback`
User-submitted ratings and messages. Only Brighton (admin) can read these.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid (nullable FK → profiles) | Can be null for unauthenticated |
| `rating` | int | 1–5 stars |
| `message` | text | Feedback text |
| `page` | text | URL path when submitted |

### Row Level Security (RLS)
All tables have RLS enabled. The rules:
- **profiles:** Users can read/write their own row only. Admins can read/write all.
- **jobs:** Users see only their own jobs. Admins see all.
- **quotes:** Users see quotes where they own the parent job. Admins see all.
- **feedback:** Anyone can insert (their own or anonymous). Only admins can read.

The `is_admin()` SQL function checks `profiles.role = 'admin'` for the current session user.

---

## 6. Auth Flow

1. App loads → `useAuth.init()` calls `supabase.auth.getSession()`
2. No session → `AuthPage` shown (Login / Create Account tabs)
3. **Sign up:** `supabase.auth.signUp()` → Supabase creates `auth.users` row → DB trigger `on_auth_user_created` auto-inserts row in `profiles` → `useProfile.fetchProfile()` loads it → `WelcomeModal` shows if `welcome_shown = false`
4. **Sign in:** `supabase.auth.signInWithPassword()` → session set → profile fetched → redirect to `/` (JobsPage)
5. `supabase.auth.onAuthStateChange()` keeps session reactive across tabs/refreshes
6. All protected routes are inside `AppRoutes` which only renders after session check passes

---

## 7. Key Data Flows

### Estimator → Save Quote
```
User draws lines on SatelliteCanvas
  → useEstimatorStore updates nodes/lines
  → PricingPanel shows running total

User clicks "Save Estimate"
  → SaveToJobModal opens
  → Reads nodes/lines/totals from useEstimatorStore
  → Inserts into quotes table with canvas_state JSON
  → Calls useProfile.incrementEstimates()
  → Navigates to /jobs/:id
```

### Edit Existing Quote
```
QuoteCard "Edit" button
  → stores canvas_state in sessionStorage
  → navigate('/estimator')

EstimatorPage mounts
  → reads sessionStorage['restore_quote']
  → calls useEstimatorStore.restoreCanvas(canvasState)
  → user edits and saves again (creates new quote version)
```

### PDF Generation
```
QuoteCard "Download PDF" button
  → handlePrint() builds HTML string with profile branding
  → window.open() creates new tab with HTML + auto-print script
  → Browser print dialog opens → user saves as PDF
```

---

## 8. External Integrations

### Google Maps Platform
- **Used for:** Satellite map (roofline tracing), Street View (pitch measurement), Places Autocomplete (address search)
- **Credentials needed:** `VITE_GOOGLE_MAPS_API_KEY` — requires Maps JavaScript API, Street View Static API, and Places API enabled in Google Cloud Console
- **Billing note:** Maps has a free tier ($200/mo credit). Monitor usage in Google Cloud Console.

### Supabase
- **Used for:** Auth (email/password), Postgres DB (jobs/quotes/profiles/feedback), Storage (logo uploads)
- **Credentials needed:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- **Storage bucket:** Must create `logos` bucket manually (Dashboard → Storage → New bucket, name: `logos`, Public: ✓)

### Vercel
- **Used for:** Hosting and auto-deploy from GitHub
- **Deploy trigger:** Push to `master` branch auto-deploys
- **Env vars:** Must be added in Vercel project Settings → Environment Variables

---

## 9. Local Dev Setup

```bash
# 1. Clone
git clone git@github.com:bja1701/roof-lighting-estimator.git
cd roof-lighting-estimator/roof-lighting-estimator

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_MAPS_API_KEY

# 4. Apply Supabase migration
# Go to Supabase Dashboard → SQL Editor → paste contents of:
# supabase/migrations/20260404000000_auth_jobs_quotes.sql

# 5. Create storage bucket
# Supabase Dashboard → Storage → New bucket → name: "logos", Public: true

# 6. Start dev server
npm run dev
# Opens at http://localhost:3000
```

---

## 10. Deploy Process

```bash
# Build locally to check for errors
npm run build

# Deploy happens automatically on push to master
git push origin master

# Or deploy manually with Vercel CLI
vercel --prod
```

**Vercel project settings checklist:**
- Framework: Vite
- Root directory: `roof-lighting-estimator` (the inner folder)
- Output directory: `dist`
- Environment variables: Add all 4 VITE_* vars

---

## 11. Business Model

| Tier | How to set | Behavior |
|---|---|---|
| `free` | Default on signup | 5 estimate saves, then upgrade prompt |
| `retainer` | Brighton sets manually in Supabase or Admin panel | Unlimited estimates |
| `paid` | Set manually (Stripe webhook in v2) | Unlimited estimates |

**To make yourself admin:**
1. Sign up at the live URL
2. Supabase Dashboard → Table Editor → `profiles` → find your row → set `role` to `admin`
3. Refresh → `/admin` route becomes visible

The Admin panel (`/admin`) lets you change any user's tier via a dropdown — no code changes needed for retainer clients.

---

## 12. V2 Roadmap (not yet built)

- **Stripe integration:** Webhook sets `subscription_tier = 'paid'` on successful subscription
- **AI Street View Preview:** Generate photorealistic night render of home with lights using GPT-Image-1 + Google Street View Static API as reference image. Spec stored in `quotes.ai_preview_spec` (jsonb, nullable).
