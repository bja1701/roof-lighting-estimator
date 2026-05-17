# Phase 1 — Payment Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contractors can generate a Stripe deposit link from a job and have job status auto-update on payment — without leaving the app.

**Architecture:** Stripe Payment Links are created server-side via a Supabase Edge Function (keeps secret key off client). A second Edge Function handles Stripe webhooks and auto-advances job status. The frontend calls `supabase.functions.invoke()` and polls/re-fetches the job for status updates.

**Tech Stack:** Vite + React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions + RLS), Stripe Payment Links API, React Router v7, Zustand, Tailwind CSS (CDN)

**Open question defaults applied:**
- Stripe fees: Contractor absorbs (2.9% + $0.30 comes out of payout, not added to client)
- Client fields: Added to NewJobModal (name, email, phone)
- PDF embed: App UI only (Phase 1)
- dev branch: Task 0

---

## File Map

**New files:**
- `supabase/migrations/20260410000001_phase1_payments.sql` — all Phase 1 DB columns
- `supabase/functions/create-payment-link/index.ts` — Edge Function: create Stripe Payment Link
- `supabase/functions/stripe-webhook/index.ts` — Edge Function: handle Stripe webhook events
- `types/job.ts` — shared Job + JobStatus types used across pages
- `utils/jobStatus.ts` — status config (labels, colors, next manual step)
- `components/JobStatusBadge.tsx` — reusable status chip
- `components/PaymentSection.tsx` — deposit %, generate link, stage-advance buttons

**Modified files:**
- `components/NewJobModal.tsx` — add client_name, client_email, client_phone fields
- `pages/JobsPage.tsx` — use `types/job.ts` Job type; swap status chip to use `job.status`
- `pages/JobDetailPage.tsx` — wire JobStatusBadge + PaymentSection; add stage-advance; update Job type

---

## Task 0: Prerequisites & Branch Setup

**Files:** None (setup only)

- [ ] **Step 1: Create dev branch**

```bash
cd /home/frank/NexusFlow_HQ/nexusflow_builds/roof-lighting-estimator/roof-lighting-estimator
git checkout -b dev
git push origin dev
```

- [ ] **Step 2: In Vercel dashboard, configure dev branch**

1. Go to Project Settings → Git
2. Under "Branch Deployments", add `dev` as a branch deployment
3. Note the preview URL (e.g., `roof-lighting-estimator-dev.vercel.app`) — this is staging

- [ ] **Step 3: Set GitHub branch protection**

On GitHub → repo → Settings → Branches → Add rule:
- Pattern: `master`
- Require PR before merging: ✅
- Dismiss stale reviews: ✅

- [ ] **Step 4: Create a feature branch for Phase 1**

```bash
git checkout dev
git checkout -b feature/phase1-payments
```

- [ ] **Step 5: Verify Supabase CLI is installed**

```bash
npx supabase --version
```

Expected: `1.x.x` or higher. If not installed:
```bash
npm install -g supabase
```

- [ ] **Step 6: Link Supabase project (if not already linked)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Get `<your-project-ref>` from Supabase dashboard → Project Settings → General → Reference ID.

- [ ] **Step 7: Create Stripe account**

If not done:
1. Go to https://stripe.com → Create account
2. Complete business verification
3. Dashboard → Developers → API keys → copy `Publishable key` and `Secret key`
4. For now, work in **Test mode** (toggle in top-right of Stripe dashboard)

- [ ] **Step 8: Add Stripe env vars**

```bash
# Add to .env.local (never commit this file)
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.local
```

Add Stripe secret to Supabase (for Edge Functions):
```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260410000001_phase1_payments.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260410000001_phase1_payments.sql
-- Phase 1: Payment processing columns

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'estimate_sent';
-- Valid values: estimate_sent | deposit_paid | scheduled | in_progress | complete | final_paid | reviewed

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

-- Add a check constraint on status
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('estimate_sent','deposit_paid','scheduled','in_progress','complete','final_paid','reviewed'));
```

- [ ] **Step 2: Run the migration**

Option A — Supabase CLI (preferred):
```bash
npx supabase db push
```

Option B — Supabase dashboard SQL editor:
Copy-paste the SQL above → Run.

- [ ] **Step 3: Verify in Supabase dashboard**

Table Editor → jobs → confirm all new columns appear with correct types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260410000001_phase1_payments.sql
git commit -m "feat: add phase 1 payment columns to jobs table"
```

---

## Task 2: Shared Job Type

**Files:**
- Create: `types/job.ts`

- [ ] **Step 1: Create types/job.ts**

```typescript
// types/job.ts

export type JobStatus =
  | 'estimate_sent'
  | 'deposit_paid'
  | 'scheduled'
  | 'in_progress'
  | 'complete'
  | 'final_paid'
  | 'reviewed';

export interface Job {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  // Phase 1 — payment + pipeline
  status: JobStatus;
  deposit_percent: number;
  deposit_amount: number | null;
  final_amount: number | null;
  stripe_deposit_link: string | null;
  stripe_final_link: string | null;
  stripe_customer_id: string | null;
  deposit_paid_at: string | null;
  final_paid_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  // Joined from quotes(count) in list queries
  quote_count?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/job.ts
git commit -m "feat: add shared Job type with phase 1 payment fields"
```

---

## Task 3: Job Status Utilities + Badge Component

**Files:**
- Create: `utils/jobStatus.ts`
- Create: `components/JobStatusBadge.tsx`

- [ ] **Step 1: Create utils/jobStatus.ts**

```typescript
// utils/jobStatus.ts
import { JobStatus } from '../types/job';

interface StatusConfig {
  label: string;
  badgeCls: string;        // Tailwind classes for the chip
  nextManualStatus: JobStatus | null;  // null = no manual advance (or terminal)
  nextManualLabel: string | null;
}

export const JOB_STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  estimate_sent: {
    label: 'Estimate Sent',
    badgeCls: 'bg-surface-container text-on-surface-variant',
    nextManualStatus: null,  // advance happens via deposit payment (Stripe webhook)
    nextManualLabel: null,
  },
  deposit_paid: {
    label: 'Deposit Paid',
    badgeCls: 'bg-secondary-container text-on-secondary-container',
    nextManualStatus: 'scheduled',
    nextManualLabel: 'Mark as Scheduled',
  },
  scheduled: {
    label: 'Scheduled',
    badgeCls: 'bg-tertiary-container/50 text-tertiary',
    nextManualStatus: 'in_progress',
    nextManualLabel: 'Mark In Progress',
  },
  in_progress: {
    label: 'In Progress',
    badgeCls: 'bg-primary-container/30 text-primary',
    nextManualStatus: 'complete',
    nextManualLabel: 'Mark Complete',
  },
  complete: {
    label: 'Complete',
    badgeCls: 'bg-primary-container/60 text-primary',
    nextManualStatus: null,  // advance via final payment (Stripe webhook)
    nextManualLabel: null,
  },
  final_paid: {
    label: 'Final Paid',
    badgeCls: 'bg-green-100 text-green-800',
    nextManualStatus: 'reviewed',
    nextManualLabel: 'Mark Reviewed',
  },
  reviewed: {
    label: 'Reviewed',
    badgeCls: 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant',
    nextManualStatus: null,
    nextManualLabel: null,
  },
};
```

- [ ] **Step 2: Create components/JobStatusBadge.tsx**

```tsx
// components/JobStatusBadge.tsx
import React from 'react';
import { JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

interface Props {
  status: JobStatus;
  size?: 'sm' | 'md';
}

export default function JobStatusBadge({ status, size = 'md' }: Props) {
  const config = JOB_STATUS_CONFIG[status] ?? JOB_STATUS_CONFIG['estimate_sent'];
  const sizeCls = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ${sizeCls} ${config.badgeCls}`}>
      {config.label}
    </span>
  );
}
```

- [ ] **Step 3: Verify visually**

Import and render `<JobStatusBadge status="deposit_paid" />` temporarily in App.tsx, run `npm run dev`, confirm the chip renders. Then remove the test render.

- [ ] **Step 4: Commit**

```bash
git add utils/jobStatus.ts components/JobStatusBadge.tsx
git commit -m "feat: add job status config and badge component"
```

---

## Task 4: Update NewJobModal — Client Fields

**Files:**
- Modify: `components/NewJobModal.tsx:1-90`

- [ ] **Step 1: Add client fields to the insert and form state**

Replace the entire file content:

```tsx
// components/NewJobModal.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureProfileRowExists } from '../utils/ensureProfile';

interface Props {
  onCreated: (jobId: string) => void;
  onClose: () => void;
}

const inputCls = 'w-full px-4 py-3 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm placeholder:text-outline/50 transition-all';
const labelCls = 'block text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-1.5';

export default function NewJobModal({ onCreated, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSubmitting(true);
    setError('');
    const ensured = await ensureProfileRowExists(user);
    if (!ensured.ok) {
      setSubmitting(false);
      setError(
        ensured.error ??
          'Your account profile is still syncing. Refresh the page and try again, or contact support.'
      );
      return;
    }
    const { data, error: err } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        name: name.trim(),
        address: null,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
      })
      .select()
      .single();
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/70 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(17,28,45,0.15)] border border-outline-variant/10 w-full max-w-md overflow-hidden">
        <div className="h-1 w-full amber-gradient"></div>
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-container/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-lg">add_home_work</span>
              </div>
              <h2 className="font-headline font-bold text-xl text-on-surface">New Job</h2>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Job Name *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Smith Residence" className={inputCls} />
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <p className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant mb-3">Client Info (Optional)</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Client Name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Client Email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="john@example.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Client Phone</label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(208) 555-0123" className={inputCls} />
                </div>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              Site address is set automatically when you save an estimate from the map.
            </p>

            {error && (
              <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface-container-low text-on-surface-variant font-medium text-sm rounded-lg hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting || !name.trim()} className="flex-1 amber-gradient text-white font-headline font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and test**

```bash
npm run dev
```

Open the app → Jobs page → click "New Job". Confirm: 3 new client fields render below Job Name. Create a test job with a client email, verify in Supabase dashboard that `client_email` is stored.

- [ ] **Step 3: Commit**

```bash
git add components/NewJobModal.tsx
git commit -m "feat: add client name, email, phone to new job form"
```

---

## Task 5: Edge Function — create-payment-link

**Files:**
- Create: `supabase/functions/create-payment-link/index.ts`

- [ ] **Step 1: Create the function file**

```typescript
// supabase/functions/create-payment-link/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId, depositPercent, type } = await req.json() as {
      jobId: string;
      depositPercent: number;
      type: "deposit" | "final";
    };

    if (!jobId || !depositPercent || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch job + its quotes to get the total value
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*, quotes(total_price)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPrice: number = (job.quotes as { total_price: number | null }[])
      .reduce((sum, q) => sum + (q.total_price ?? 0), 0);

    if (totalPrice === 0) {
      return new Response(JSON.stringify({ error: "Job has no estimates with a price. Save an estimate first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositAmountDollars = parseFloat(((totalPrice * depositPercent) / 100).toFixed(2));
    const finalAmountDollars = parseFloat((totalPrice - (job.deposit_amount ?? 0)).toFixed(2));
    const amountCents = Math.round((type === "deposit" ? depositAmountDollars : finalAmountDollars) * 100);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
    });

    // Create a one-time Price (attached to an inline Product)
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: type === "deposit"
          ? `Deposit (${depositPercent}%) — ${job.name}`
          : `Final Payment — ${job.name}`,
      },
    });

    // Create the Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { job_id: jobId, type },
      after_completion: { type: "hosted_confirmation", hosted_confirmation: { custom_message: "Payment received! Your contractor will be in touch shortly." } },
    });

    // Persist the link and amounts to the job
    const updatePayload =
      type === "deposit"
        ? {
            stripe_deposit_link: paymentLink.url,
            deposit_percent: depositPercent,
            deposit_amount: depositAmountDollars,
            final_amount: parseFloat((totalPrice - depositAmountDollars).toFixed(2)),
          }
        : {
            stripe_final_link: paymentLink.url,
          };

    await supabaseAdmin.from("jobs").update(updatePayload).eq("id", jobId);

    return new Response(JSON.stringify({ url: paymentLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-payment-link error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy create-payment-link --no-verify-jwt
```

`--no-verify-jwt` is used here because the function is called from the client with a valid Supabase session JWT. Remove this flag if you want Supabase to auto-verify the JWT.

- [ ] **Step 3: Test with curl**

```bash
# First get a valid access token from your browser session (check Network tab in DevTools)
# Or use the anon key for a quick smoke test:
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/create-payment-link \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"<a-real-job-uuid>","depositPercent":50,"type":"deposit"}'
```

Expected: `{"url":"https://buy.stripe.com/test_..."}` and the URL is stored in the `stripe_deposit_link` column.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-payment-link/index.ts
git commit -m "feat: add create-payment-link edge function"
```

---

## Task 6: Edge Function — stripe-webhook

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Create the webhook handler**

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("No signature", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${String(err)}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const jobId = session.metadata?.job_id;
    const type = session.metadata?.type as "deposit" | "final" | undefined;

    if (!jobId || !type) {
      console.warn("Webhook missing job_id or type in metadata, skipping.");
      return new Response("ok");
    }

    const updatePayload =
      type === "deposit"
        ? { status: "deposit_paid", deposit_paid_at: new Date().toISOString() }
        : { status: "final_paid", final_paid_at: new Date().toISOString() };

    const { error } = await supabaseAdmin
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId);

    if (error) {
      console.error("Failed to update job status:", error);
      return new Response("DB update failed", { status: 500 });
    }

    console.log(`Job ${jobId} updated to ${updatePayload.status}`);
  }

  return new Response("ok", { status: 200 });
});
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

- [ ] **Step 3: Register the webhook in Stripe dashboard**

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events to listen to: `checkout.session.completed`
4. Copy the **Signing secret** (starts with `whsec_`)

- [ ] **Step 4: Add the webhook secret to Supabase**

```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 5: Verify the webhook is live**

Stripe Dashboard → Webhooks → click your endpoint → "Send test webhook" → select `checkout.session.completed` → Send. Check Supabase Edge Function logs:

```bash
npx supabase functions logs stripe-webhook
```

Expected: log line like `Job <id> updated to deposit_paid` (the test won't have a real job_id so you'll see the `missing metadata` warning — that's fine).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add stripe-webhook edge function for payment status updates"
```

---

## Task 7: PaymentSection Component

**Files:**
- Create: `components/PaymentSection.tsx`

This component handles: deposit % input, "Generate Deposit Link" button, copy-to-clipboard, stage-advance buttons, and "Generate Final Payment Link" when status is `complete`.

- [ ] **Step 1: Create components/PaymentSection.tsx**

```tsx
// components/PaymentSection.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Job, JobStatus } from '../types/job';
import { JOB_STATUS_CONFIG } from '../utils/jobStatus';

interface Props {
  job: Job;
  onStatusChange: (newStatus: JobStatus) => void;
  onJobUpdate: (updates: Partial<Job>) => void;
}

export default function PaymentSection({ job, onStatusChange, onJobUpdate }: Props) {
  const [depositPercent, setDepositPercent] = useState(job.deposit_percent ?? 50);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [copied, setCopied] = useState<'deposit' | 'final' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusConfig = JOB_STATUS_CONFIG[job.status];

  const handleGenerateLink = async (type: 'deposit' | 'final') => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-payment-link', {
        body: { jobId: job.id, depositPercent, type },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      const url: string = data.url;
      if (type === 'deposit') {
        onJobUpdate({ stripe_deposit_link: url, deposit_percent: depositPercent });
      } else {
        onJobUpdate({ stripe_final_link: url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (url: string, type: 'deposit' | 'final') => {
    await navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAdvanceStatus = async () => {
    const next = statusConfig.nextManualStatus;
    if (!next) return;
    setAdvancing(true);
    setError(null);
    const { error: dbError } = await supabase
      .from('jobs')
      .update({ status: next })
      .eq('id', job.id);
    setAdvancing(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onStatusChange(next);
  };

  const inputCls = 'px-3 py-2 bg-surface-container-low border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-sm transition-all';
  const btnPrimary = 'flex items-center gap-2 amber-gradient text-white font-headline font-bold py-3 px-6 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm';
  const btnSecondary = 'flex items-center gap-2 bg-surface-container-low text-on-surface font-bold py-3 px-5 rounded-lg hover:bg-surface-container transition-colors text-sm disabled:opacity-50';

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-5">
      <h2 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined text-primary-container">payments</span>
        Payment
      </h2>

      {error && (
        <div className="bg-error-container/30 border-l-4 border-error p-3 rounded-r-lg">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* ── Deposit Link ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">Deposit Link</p>

        {!job.stripe_deposit_link ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-label uppercase tracking-wider text-on-surface-variant mb-1">Deposit %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={depositPercent}
                  onChange={e => setDepositPercent(Number(e.target.value))}
                  className={`${inputCls} w-20`}
                />
                <span className="text-sm text-on-surface-variant">%</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleGenerateLink('deposit')}
              disabled={generating}
              className={btnPrimary}
            >
              <span className="material-symbols-outlined text-lg">{generating ? 'progress_activity' : 'link'}</span>
              {generating ? 'Generating…' : 'Generate Deposit Link'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-container-low rounded-lg">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
            <a
              href={job.stripe_deposit_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-primary underline underline-offset-2 truncate"
            >
              {job.stripe_deposit_link}
            </a>
            <button
              type="button"
              onClick={() => handleCopy(job.stripe_deposit_link!, 'deposit')}
              className={btnSecondary}
            >
              <span className="material-symbols-outlined text-base">{copied === 'deposit' ? 'check' : 'content_copy'}</span>
              {copied === 'deposit' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {job.deposit_amount != null && (
          <p className="text-xs text-on-surface-variant">
            Deposit: <span className="font-semibold text-on-surface">${job.deposit_amount.toFixed(2)}</span>
            {job.final_amount != null && (
              <> · Remaining: <span className="font-semibold text-on-surface">${job.final_amount.toFixed(2)}</span></>
            )}
          </p>
        )}
      </div>

      {/* ── Final Payment Link (only after complete) ── */}
      {(job.status === 'complete' || job.stripe_final_link) && (
        <div className="space-y-3 border-t border-outline-variant/20 pt-4">
          <p className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">Final Payment Link</p>
          {!job.stripe_final_link ? (
            <button
              type="button"
              onClick={() => handleGenerateLink('final')}
              disabled={generating}
              className={btnPrimary}
            >
              <span className="material-symbols-outlined text-lg">{generating ? 'progress_activity' : 'link'}</span>
              {generating ? 'Generating…' : 'Generate Final Payment Link'}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <a
                href={job.stripe_final_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary underline underline-offset-2 truncate"
              >
                {job.stripe_final_link}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(job.stripe_final_link!, 'final')}
                className={btnSecondary}
              >
                <span className="material-symbols-outlined text-base">{copied === 'final' ? 'check' : 'content_copy'}</span>
                {copied === 'final' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Stage Advance ── */}
      {statusConfig.nextManualStatus && (
        <div className="border-t border-outline-variant/20 pt-4">
          <button
            type="button"
            onClick={handleAdvanceStatus}
            disabled={advancing}
            className={btnSecondary}
          >
            <span className="material-symbols-outlined text-base">{advancing ? 'progress_activity' : 'arrow_forward'}</span>
            {advancing ? 'Updating…' : statusConfig.nextManualLabel}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PaymentSection.tsx
git commit -m "feat: add PaymentSection component with deposit link and stage advance"
```

---

## Task 8: Update JobDetailPage

**Files:**
- Modify: `pages/JobDetailPage.tsx`

- [ ] **Step 1: Update the Job interface import and add new state**

Replace the top of the file (lines 1–52) with:

```tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { isFreeTierEstimatorExhausted } from '../utils/estimatorAccess';
import SharedLayout from '../components/SharedLayout';
import QuoteCard from '../components/QuoteCard';
import ClientQuoteModal from '../components/ClientQuoteModal';
import JobStatusBadge from '../components/JobStatusBadge';
import PaymentSection from '../components/PaymentSection';
import { Job, JobStatus } from '../types/job';

interface Quote {
  id: string;
  label: string;
  line_items: any[];
  notes: string | null;
  total_linear_ft: number | null;
  total_price: number | null;
  price_per_foot: number | null;
  controller_fee: number | null;
  include_controller: boolean | null;
  canvas_state: any | null;
  created_at: string;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [clientQuoteOpen, setClientQuoteOpen] = useState(false);

  useEffect(() => { if (id) fetchJobAndQuotes(id); }, [id]);

  const fetchJobAndQuotes = async (jobId: string) => {
    setLoading(true);
    const [{ data: jobData }, { data: quotesData }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('quotes').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    ]);
    setJob(jobData ?? null);
    setQuotes(quotesData ?? []);
    setLoading(false);
  };
```

- [ ] **Step 2: Add helper handlers for PaymentSection callbacks**

Add these two handlers inside `JobDetailPage`, right after `handleDeleteJob`:

```tsx
  const handleStatusChange = (newStatus: JobStatus) => {
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleJobUpdate = (updates: Partial<Job>) => {
    setJob(prev => prev ? { ...prev, ...updates } : prev);
  };
```

- [ ] **Step 3: Add JobStatusBadge to the header section**

In the JSX, find the line:
```tsx
<h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none">{job.name}</h1>
```

Replace it with:
```tsx
<div className="flex items-center gap-3 flex-wrap">
  <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none">{job.name}</h1>
  <JobStatusBadge status={job.status} />
</div>
```

- [ ] **Step 4: Add client info display below the address/notes row**

Find the closing `</div>` of the address/notes row (after the `{job.notes && ...}` block). Add after it:

```tsx
            {(job.client_name || job.client_email || job.client_phone) && (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-primary-container">person</span>
                <span>
                  {[job.client_name, job.client_email, job.client_phone].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
```

- [ ] **Step 5: Add PaymentSection below the bento stats row**

Find the closing `</div>` of the bento stats row (the `mb-12` grid). Add PaymentSection after it:

```tsx
        {/* Payment Section */}
        <div className="mb-12">
          <PaymentSection
            job={job}
            onStatusChange={handleStatusChange}
            onJobUpdate={handleJobUpdate}
          />
        </div>
```

- [ ] **Step 6: Run dev server and verify**

```bash
npm run dev
```

Open a job detail page. Confirm:
- Status badge appears next to the job name
- Client info row shows if populated
- PaymentSection renders with "Generate Deposit Link" button
- Deposit % input defaults to 50

- [ ] **Step 7: Commit**

```bash
git add pages/JobDetailPage.tsx
git commit -m "feat: add status badge, client info, and payment section to job detail"
```

---

## Task 9: Update JobsPage

**Files:**
- Modify: `pages/JobsPage.tsx`

The `Job` interface in JobsPage currently uses only a few fields and has its own inline status chip logic. Replace both with the shared type and `JobStatusBadge`.

- [ ] **Step 1: Update imports and Job interface**

Replace lines 1–26 (the imports and the local `Job` interface and `STATUS_COLORS` block):

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import NewJobModal from '../components/NewJobModal';
import { streetViewStaticImageUrl } from '../utils/streetViewStatic';
import JobStatusBadge from '../components/JobStatusBadge';
import { Job } from '../types/job';
```

- [ ] **Step 2: Update fetchJobs to include status**

The existing query `supabase.from('jobs').select('*, quotes(count)')` already selects all columns, so `status` will come through automatically. No query change needed.

- [ ] **Step 3: Replace the inline status chip in the job card**

Find this block inside the card JSX:
```tsx
<div className={`absolute top-3 right-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${chip.cls}`}>
  {chip.label}
</div>
```

And the `const chip = getStatusChip(job.quote_count ?? 0);` line above it.

Replace both with:
```tsx
<div className="absolute top-3 right-3">
  <JobStatusBadge status={job.status ?? 'estimate_sent'} size="sm" />
</div>
```

(Remove the `getStatusChip` function and `STATUS_COLORS` constant entirely — they're now unused.)

- [ ] **Step 4: Run dev server and verify**

```bash
npm run dev
```

Jobs page: each card should now show the proper status badge (e.g., "Estimate Sent" for new jobs). Create a test job and confirm it shows "Estimate Sent".

- [ ] **Step 5: Commit**

```bash
git add pages/JobsPage.tsx
git commit -m "feat: replace inline status chip with shared JobStatusBadge on jobs list"
```

---

## Task 10: End-to-End Smoke Test

This is a manual checklist. Run through it entirely before merging to `dev`.

**Setup:** Ensure Stripe is in **Test mode** and the webhook is registered.

- [ ] Create a new job with client name + email + phone → confirm fields save in Supabase
- [ ] Open the job → confirm "Estimate Sent" badge appears
- [ ] Save an estimate from the estimator for this job
- [ ] Return to Job Detail → PaymentSection should show "Generate Deposit Link" (not disabled)
- [ ] Set deposit % to 30, click "Generate Deposit Link"
  - Expected: Stripe Payment Link URL appears in < 5 seconds
  - Expected: `stripe_deposit_link` and `deposit_amount` populated in Supabase
- [ ] Copy the link, open it in an incognito window
  - Expected: Stripe Checkout page loads with the correct dollar amount, no Stripe account required
- [ ] Complete the payment using Stripe test card `4242 4242 4242 4242`, any future date, any CVC
- [ ] Wait up to 60 seconds, then refresh the Job Detail page
  - Expected: status badge changes to "Deposit Paid"
  - Expected: `deposit_paid_at` populated in Supabase
- [ ] Click "Mark as Scheduled" → status badge updates to "Scheduled"
- [ ] Click "Mark In Progress" → updates to "In Progress"
- [ ] Click "Mark Complete" → updates to "Complete", "Generate Final Payment Link" button appears
- [ ] Generate final payment link → confirm it appears and copies correctly
- [ ] Jobs page: confirm the status badge on the card reflects current status

**All boxes checked?** → merge feature branch to dev:
```bash
git checkout dev
git merge feature/phase1-payments
git push origin dev
```

Then dog-food on the Vercel staging URL for 48 hours before merging to master.

---

## Acceptance Criteria Checklist (from PRD 6.4)

- [ ] Contractor can generate a Stripe payment link from a job in < 30 seconds
- [ ] Link works for client on mobile without a Stripe account
- [ ] Job status auto-updates within 60 seconds of payment
- [ ] Final payment link can be generated after job is marked complete
- [ ] Payment amounts are visible on the job card detail section
