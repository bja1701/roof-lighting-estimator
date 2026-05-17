# Subscription Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let contractors pay $89/month via Stripe Checkout to unlock unlimited estimates beyond the free 5.

**Architecture:** Two new Supabase Edge Functions handle the Stripe integration — `create-checkout-session` creates a hosted Checkout URL, `stripe-webhook-sub` receives Stripe events and updates `profiles.subscription_status`. The React app gates the estimator on `subscription_status` read directly from Supabase (never calls Stripe at runtime). A Zustand store drives the upgrade modal so any component can open it without prop drilling.

**Tech Stack:** Vite + React 18 + TypeScript, Zustand, Supabase JS client, Supabase Edge Functions (Deno), Stripe API, Tailwind CSS, Material Symbols Outlined font (already loaded)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260412000001_subscription_billing.sql` | CREATE | Add `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` to profiles |
| `hooks/useProfile.ts` | MODIFY | Add 3 new fields to `Profile` interface |
| `utils/estimatorAccess.ts` | MODIFY | Gate on `subscription_status !== 'active'` instead of `subscription_tier` |
| `hooks/useUpgradeModal.ts` | CREATE | Zustand store — `open()`, `close()`, `isOpen` |
| `components/UpgradeModal.tsx` | CREATE | Centered modal, amber bar, $89/mo price, calls `create-checkout-session` |
| `components/EstimatorRouteGuard.tsx` | MODIFY | Show UpgradeModal instead of redirecting to `/` |
| `components/SharedLayout.tsx` | MODIFY | Update usage indicator to use `subscription_status` |
| `components/WelcomeModal.tsx` | MODIFY | Add upgrade nudge section at bottom |
| `pages/SettingsPage.tsx` | MODIFY | Add Plan & Billing section, handle `?upgrade=success` param |
| `App.tsx` | MODIFY | Render `<UpgradeModal />` globally |
| `supabase/functions/create-checkout-session/index.ts` | CREATE | Deno Edge Function — creates Stripe Checkout Session |
| `supabase/functions/stripe-webhook-sub/index.ts` | CREATE | Deno Edge Function — handles Stripe subscription events |

---

## Task 1: DB Migration — Add Subscription Columns

**Files:**
- Create: `supabase/migrations/20260412000001_subscription_billing.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Subscription billing columns for Stripe integration
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status  text NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'canceled')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;

-- Index for webhook lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool to run the SQL above against project `bsbewwwflqjlxxovjgec`. Verify the tool returns no error.

- [ ] **Step 3: Verify columns exist**

Run this query via MCP:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('subscription_status', 'stripe_customer_id', 'stripe_subscription_id');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
cd /home/frank/NexusFlow_HQ/nexusflow_builds/roof-lighting-estimator/roof-lighting-estimator
git add supabase/migrations/20260412000001_subscription_billing.sql
git commit -m "feat: add subscription_status and stripe id columns to profiles"
```

---

## Task 2: Update Profile Type + useProfile Hook

**Files:**
- Modify: `hooks/useProfile.ts`

- [ ] **Step 1: Add the 3 new fields to the `Profile` interface**

Open `hooks/useProfile.ts`. Find the `Profile` interface (line 5). Add after `welcome_shown: boolean;`:

```typescript
  subscription_status: 'free' | 'active' | 'canceled';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
```

The full interface after the change:
```typescript
export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  brand_color: string;
  price_per_foot: number;
  controller_fee: number;
  include_controller: boolean;
  subscription_tier: 'free' | 'retainer' | 'paid';
  subscription_status: 'free' | 'active' | 'canceled';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  estimates_used: number;
  welcome_shown: boolean;
  role: 'user' | 'admin';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/frank/NexusFlow_HQ/nexusflow_builds/roof-lighting-estimator/roof-lighting-estimator
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: no new errors related to `subscription_status`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useProfile.ts
git commit -m "feat: add subscription_status fields to Profile type"
```

---

## Task 3: Update estimatorAccess Utility

**Files:**
- Modify: `utils/estimatorAccess.ts`

The current check uses `subscription_tier === 'free'`. We want: free tier users with 5+ estimates who haven't upgraded.

- [ ] **Step 1: Replace the function body**

Replace the entire file content:

```typescript
import type { Profile } from '../hooks/useProfile';

/**
 * Returns true when the user cannot start a new estimate:
 * they are not on an active paid subscription AND have used all 5 free estimates.
 */
export function isFreeTierEstimatorExhausted(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status === 'active') return false;
  return (profile.estimates_used ?? 0) >= 5;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add utils/estimatorAccess.ts
git commit -m "feat: gate estimator on subscription_status instead of subscription_tier"
```

---

## Task 4: Create useUpgradeModal Zustand Store

**Files:**
- Create: `hooks/useUpgradeModal.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';

interface UpgradeModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useUpgradeModal.ts
git commit -m "feat: add useUpgradeModal Zustand store"
```

---

## Task 5: Create UpgradeModal Component

**Files:**
- Create: `components/UpgradeModal.tsx`

The modal:
- Centered overlay (fixed inset, dark backdrop, blur)
- Amber 4px top bar
- No icon — "Upgrade to Pro" title stands alone
- Subtitle: "You've used all 5 free estimates"
- Dark inset price block: $89/month, "Unlimited estimates · Cancel anytime"
- Amber CTA: "Get started →" — calls `create-checkout-session`, redirects to Stripe
- Dismiss text (only if estimates remain): "Not ready yet — use my remaining free estimates"
- Loading state while waiting for checkout URL
- Backdrop click does NOT close

- [ ] **Step 1: Create the component**

```tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { useProfile } from '../hooks/useProfile';

export default function UpgradeModal() {
  const { isOpen, close } = useUpgradeModal();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const hasRemainingEstimates = (profile?.estimates_used ?? 0) < 5;

  const handleGetStarted = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session');
      if (fnError) throw new Error(fnError.message);
      if (!data?.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm">
        {/* Modal card */}
        <div
          className="rounded-2xl overflow-hidden border border-white/8"
          style={{ background: '#1e2d45', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
        >
          {/* Amber top bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />

          <div className="p-7">
            {/* Title */}
            <div className="mb-1.5 text-[15px] font-extrabold text-slate-200">
              Upgrade to Pro
            </div>
            <div className="text-[11px] text-slate-400 mb-5">
              You've used all 5 free estimates
            </div>

            {/* Price block */}
            <div
              className="rounded-[10px] p-4 mb-5 flex items-center justify-between"
              style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <div className="text-[26px] font-extrabold text-white leading-none">
                  $89
                  <span className="text-[13px] text-slate-400 font-normal"> /month</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Unlimited estimates · Cancel anytime
                </div>
              </div>
              <div className="text-[10px] text-amber-400 font-bold text-right leading-tight">
                Everything<br />included
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 text-[11px] text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="w-full rounded-[10px] py-3 text-center text-[13px] font-bold mb-2.5 transition-opacity disabled:opacity-60"
              style={{ background: '#f59e0b', color: '#0f1729' }}
            >
              {loading ? 'Redirecting…' : 'Get started →'}
            </button>

            {/* Dismiss — only if they still have estimates */}
            {hasRemainingEstimates && (
              <button
                onClick={close}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-400 transition-colors"
              >
                Not ready yet — use my remaining free estimates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/UpgradeModal.tsx
git commit -m "feat: add UpgradeModal component"
```

---

## Task 6: Render UpgradeModal Globally in App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Import UpgradeModal**

In `App.tsx`, add after the existing imports:
```tsx
import UpgradeModal from './components/UpgradeModal';
```

- [ ] **Step 2: Render UpgradeModal alongside WelcomeModal**

In the return JSX of `AppRoutes`, add `<UpgradeModal />` directly after `<FeedbackButton />`:

```tsx
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <FeedbackButton />
      <UpgradeModal />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: render UpgradeModal globally in App"
```

---

## Task 7: Update EstimatorRouteGuard — Show Modal Instead of Redirect

**Files:**
- Modify: `components/EstimatorRouteGuard.tsx`

Currently this redirects to `/` when limit is hit. Instead, open the upgrade modal and render EstimatorPage (modal will block interaction).

- [ ] **Step 1: Replace the file**

```tsx
import React, { useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useUpgradeModal } from '../hooks/useUpgradeModal';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import EstimatorPage from '../pages/EstimatorPage';

export default function EstimatorRouteGuard() {
  const { profile, loading } = useProfile();
  const { open } = useUpgradeModal();
  const exhausted = isFreeTierEstimatorExhausted(profile);

  useEffect(() => {
    if (!loading && exhausted) {
      open();
    }
  }, [loading, exhausted]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
      </div>
    );
  }

  // Always render EstimatorPage — UpgradeModal renders globally and blocks it
  return <EstimatorPage />;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 3: Manual test (dev server)**

```bash
npm run dev
```
Log in as a user with 5+ estimates. Click Estimator in the nav. Verify the upgrade modal appears instead of a redirect.

- [ ] **Step 4: Commit**

```bash
git add components/EstimatorRouteGuard.tsx
git commit -m "feat: show UpgradeModal on estimate limit instead of redirecting"
```

---

## Task 8: Update SharedLayout Usage Indicator

**Files:**
- Modify: `components/SharedLayout.tsx`

The sidebar usage indicator currently checks `profile?.subscription_tier === 'free'`. Update it to use `subscription_status`.

- [ ] **Step 1: Import useUpgradeModal**

Add to the imports in `SharedLayout.tsx`:
```tsx
import { useUpgradeModal } from '../hooks/useUpgradeModal';
```

- [ ] **Step 2: Destructure open from the store**

Inside the `SharedLayout` function body, add:
```tsx
const { open: openUpgrade } = useUpgradeModal();
```

- [ ] **Step 3: Update the sidebar usage indicator condition (line 153)**

Change:
```tsx
{profile?.subscription_tier === 'free' && (
```
To:
```tsx
{profile?.subscription_status !== 'active' && (
```

- [ ] **Step 4: Add upgrade button inside the usage indicator block**

After the progress bar div (around line 166), add an "Upgrade" button:
```tsx
              <button
                onClick={openUpgrade}
                className="mt-3 w-full text-center text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
              >
                Upgrade →
              </button>
```

The full updated usage indicator block:
```tsx
        {profile?.subscription_status !== 'active' && (
          <div className="px-4 pb-6 pt-4 border-t border-slate-200/60 mt-auto">
            <div className="bg-surface-container rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-label uppercase tracking-wider text-secondary font-bold">Free Tier</span>
                <span className="text-xs font-bold text-on-surface">{profile.estimates_used ?? 0} / 5</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div
                  className="amber-gradient h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((profile.estimates_used ?? 0) / 5) * 100)}%` }}
                />
              </div>
              <button
                onClick={openUpgrade}
                className="mt-3 w-full text-center text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider"
              >
                Upgrade →
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add components/SharedLayout.tsx
git commit -m "feat: update usage indicator to use subscription_status, add upgrade button"
```

---

## Task 9: Update WelcomeModal — Add Upgrade Nudge

**Files:**
- Modify: `components/WelcomeModal.tsx`

Add a soft upgrade section below the "Let's go" button. Low pressure — just lets them know upgrading is an option.

- [ ] **Step 1: Import useUpgradeModal**

Add import at top of `components/WelcomeModal.tsx`:
```tsx
import { useUpgradeModal } from '../hooks/useUpgradeModal';
```

- [ ] **Step 2: Destructure open from the store**

Inside `WelcomeModal`, add:
```tsx
const { open: openUpgrade } = useUpgradeModal();
```

- [ ] **Step 3: Add upgrade nudge after the "Let's go" button**

After the `<button onClick={handleClose}>Let's go</button>` block, add:
```tsx
          <p className="text-xs text-on-surface-variant/60 mt-4">
            You have 5 free estimates.{' '}
            <button
              onClick={() => { handleClose(); openUpgrade(); }}
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
            >
              Upgrade anytime
            </button>
            {' '}for unlimited access.
          </p>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/WelcomeModal.tsx
git commit -m "feat: add upgrade nudge to WelcomeModal"
```

---

## Task 10: Add Plan & Billing Section to SettingsPage

**Files:**
- Modify: `pages/SettingsPage.tsx`

Add a "Plan & Billing" section that shows current status and an upgrade button. Also handle `?upgrade=success` query param (Stripe redirects here after payment).

- [ ] **Step 1: Add imports at the top of SettingsPage.tsx**

Add these to the existing imports:
```tsx
import { useUpgradeModal } from '../hooks/useUpgradeModal';
```

- [ ] **Step 2: Add useUpgradeModal and URL param detection**

Inside the `SettingsPage` function, after the existing state declarations, add:
```tsx
  const { open: openUpgrade } = useUpgradeModal();

  // Detect Stripe redirect back after checkout
  const upgradeSuccess = new URLSearchParams(window.location.search).get('upgrade') === 'success';
```

- [ ] **Step 3: Add Plan & Billing section before the save button / error block**

Find the `{error && ...}` block near the bottom of the JSX. Add this section before it:

```tsx
          {/* Plan & Billing */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-base">workspace_premium</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-on-surface">Plan & Billing</h2>
                <p className="text-xs text-on-surface-variant">Your current subscription</p>
              </div>
            </div>

            {upgradeSuccess && (
              <div className="mb-4 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <span className="material-symbols-outlined text-base">check_circle</span>
                You're now on Pro — unlimited estimates unlocked!
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-on-surface">
                  {profile?.subscription_status === 'active' ? 'Pro' : 'Free'} Plan
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  {profile?.subscription_status === 'active'
                    ? 'Unlimited estimates · $89/month'
                    : `${profile?.estimates_used ?? 0} of 5 free estimates used`}
                </div>
              </div>
              {profile?.subscription_status !== 'active' && (
                <button
                  onClick={openUpgrade}
                  className="px-5 py-2.5 amber-gradient text-white font-semibold text-sm rounded-lg shadow-sm active:scale-95 transition-all"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </section>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add pages/SettingsPage.tsx
git commit -m "feat: add Plan & Billing section to SettingsPage"
```

---

## Task 11: Create create-checkout-session Edge Function

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p supabase/functions/create-checkout-session
```

- [ ] **Step 2: Write the Edge Function**

```typescript
// supabase/functions/create-checkout-session/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_SANDBOX_KEY')!, {
      apiVersion: '2023-10-16',
    });

    const appUrl = Deno.env.get('APP_URL')!;
    const priceId = Deno.env.get('STRIPE_SUBSCRIPTION_PRICE_ID')!;

    // Check if user already has a stripe_customer_id
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?upgrade=success`,
      cancel_url: `${appUrl}/settings`,
      metadata: { supabase_user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat: add create-checkout-session Edge Function"
```

---

## Task 12: Create stripe-webhook-sub Edge Function

**Files:**
- Create: `supabase/functions/stripe-webhook-sub/index.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p supabase/functions/stripe-webhook-sub
```

- [ ] **Step 2: Write the Edge Function**

```typescript
// supabase/functions/stripe-webhook-sub/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_SANDBOX_KEY')!, {
    apiVersion: '2023-10-16',
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET_SUB')!,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return new Response(message, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (userId) {
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
        })
        .eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    await supabase
      .from('profiles')
      .update({ subscription_status: 'canceled' })
      .eq('stripe_customer_id', customerId);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-webhook-sub/index.ts
git commit -m "feat: add stripe-webhook-sub Edge Function"
```

---

## Task 13: Deploy Edge Functions + Set Secrets

**Note:** Run these commands from the project root. Requires Supabase CLI logged in (`npx supabase login`).

- [ ] **Step 1: Deploy create-checkout-session (with JWT verification)**

```bash
cd /home/frank/NexusFlow_HQ/nexusflow_builds/roof-lighting-estimator/roof-lighting-estimator
npx supabase functions deploy create-checkout-session --project-ref bsbewwwflqjlxxovjgec
```
Expected: `Deployed create-checkout-session`

- [ ] **Step 2: Deploy stripe-webhook-sub (no JWT — Stripe calls it)**

```bash
npx supabase functions deploy stripe-webhook-sub --project-ref bsbewwwflqjlxxovjgec --no-verify-jwt
```
Expected: `Deployed stripe-webhook-sub`

- [ ] **Step 3: Set required secrets in Supabase**

Set these one at a time in your terminal (replace placeholder values):

```bash
# The Stripe product price ID you created (e.g. price_1ABC...)
npx supabase secrets set STRIPE_SUBSCRIPTION_PRICE_ID=price_REPLACE_ME --project-ref bsbewwwflqjlxxovjgec

# Your app's public URL (no trailing slash)
npx supabase secrets set APP_URL=https://your-app-url.vercel.app --project-ref bsbewwwflqjlxxovjgec

# Webhook signing secret from Stripe dashboard (whsec_...)
npx supabase secrets set STRIPE_WEBHOOK_SECRET_SUB=whsec_REPLACE_ME --project-ref bsbewwwflqjlxxovjgec
```

Note: `STRIPE_SECRET_SANDBOX_KEY` and `SUPABASE_SERVICE_ROLE_KEY` should already be set. Verify:
```bash
npx supabase secrets list --project-ref bsbewwwflqjlxxovjgec
```

---

## Task 14: Stripe Setup (Manual Steps)

These are one-time actions in the Stripe dashboard. Do these BEFORE testing end-to-end.

- [ ] **Step 1: Create a Product + Price**
  1. Go to Stripe Dashboard → Products → Add product
  2. Name: "Roof Estimator Pro"
  3. Pricing: $89.00 / month, recurring
  4. Copy the **Price ID** (starts with `price_`)
  5. Set it as `STRIPE_SUBSCRIPTION_PRICE_ID` secret (Task 13, Step 3)

- [ ] **Step 2: Register the webhook**
  1. Stripe Dashboard → Developers → Webhooks → Add endpoint
  2. URL: `https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/stripe-webhook-sub`
  3. Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
  4. Copy the **Signing secret** (starts with `whsec_`)
  5. Set it as `STRIPE_WEBHOOK_SECRET_SUB` secret (Task 13, Step 3)

- [ ] **Step 3: Confirm test mode is on**
  Make sure the Stripe dashboard toggle shows "Test mode" — sandbox key starts with `sk_test_`.

---

## Task 15: End-to-End Smoke Test

- [ ] **Step 1: Test the upgrade modal trigger**
  - Log in as a user with 5 estimates used
  - Click "Estimator" in the sidebar
  - Expected: UpgradeModal appears with "Get started →" button

- [ ] **Step 2: Test the Settings upgrade button**
  - Navigate to Settings
  - Expected: "Plan & Billing" section shows "Free Plan" and "Upgrade Plan" button
  - Click "Upgrade Plan" → UpgradeModal opens

- [ ] **Step 3: Test checkout flow**
  - Click "Get started →" in the modal
  - Expected: redirect to Stripe Checkout hosted page
  - Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
  - Complete payment
  - Expected: redirect to `APP_URL/settings?upgrade=success`
  - Expected: green success banner in Settings: "You're now on Pro — unlimited estimates unlocked!"

- [ ] **Step 4: Verify webhook fired**
  - In Stripe Dashboard → Developers → Webhooks → your endpoint → check event logs
  - Expected: `checkout.session.completed` with status 200

- [ ] **Step 5: Verify DB updated**
  - In Supabase Dashboard → Table Editor → profiles
  - Find your test user row
  - Expected: `subscription_status = 'active'`, `stripe_customer_id` populated, `stripe_subscription_id` populated

- [ ] **Step 6: Verify estimator is unlocked**
  - Refresh the app (forces `fetchProfile`)
  - Click "Estimator" in the sidebar
  - Expected: EstimatorPage loads with no modal
  - Expected: usage indicator in sidebar is gone (hidden for active subscribers)
