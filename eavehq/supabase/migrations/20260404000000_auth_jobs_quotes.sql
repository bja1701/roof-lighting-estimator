-- ============================================================
-- Roof Lighting Estimator — Full Auth + Jobs + Quotes Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- PROFILES
-- Auto-created for every new Supabase Auth user via trigger.
-- Stores branding, pricing preferences, and subscription tier.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         text,
  company_name      text,
  email             text,
  phone             text,
  -- Branding (used in PDF exports)
  logo_url          text,                          -- Supabase Storage public URL
  brand_color       text        DEFAULT '#f59e0b', -- Amber accent default
  -- Pricing (saved per user, overrides hardcoded default)
  price_per_foot    numeric     DEFAULT 4.00,
  controller_fee    numeric     DEFAULT 300.00,
  include_controller boolean    DEFAULT true,
  -- Subscription
  subscription_tier text        NOT NULL DEFAULT 'free'  -- 'free' | 'retainer' | 'paid'
    CHECK (subscription_tier IN ('free', 'retainer', 'paid')),
  estimates_used    int         NOT NULL DEFAULT 0,
  -- UX state
  welcome_shown     boolean     NOT NULL DEFAULT false,
  -- Access control
  role              text        NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- JOBS
-- One job per client/address project.
-- A job can have many quotes (different configurations).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- QUOTES
-- A single estimate within a job.
-- line_items: array of traced roof segments with measurements.
-- canvas_state: full serialized estimator canvas for autosave/restore.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  label           text        NOT NULL DEFAULT 'Estimate',
  -- Line items from the estimator canvas
  -- Schema: [{ id, type, pitch, length2d, length3d, cost, startNode, endNode }]
  line_items      jsonb       NOT NULL DEFAULT '[]',
  notes           text,
  price_per_foot  numeric,    -- snapshot of price at time of save
  controller_fee  numeric,    -- snapshot
  include_controller boolean,
  total_linear_ft numeric,
  total_price     numeric,
  -- Autosave: full canvas state (nodes + lines + settings)
  -- Schema: { nodes, lines, pricePerFt, controllerFee, includeController, satelliteCenter }
  canvas_state    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- FEEDBACK
-- User-submitted ratings and messages.
-- Brighton reads this via /admin panel.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  rating     int         CHECK (rating BETWEEN 1 AND 5),
  message    text        NOT NULL,
  page       text,       -- which page the user was on when they submitted
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- STORAGE BUCKET for logo uploads
-- Create manually in Supabase Dashboard → Storage → New bucket
-- Name: "logos", Public: true
-- ──────────────────────────────────────────────────────────
-- (Cannot be created via SQL — use the dashboard or CLI)

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Every table is locked down. Users can only see their own data.
-- Admins (role = 'admin') can see everything.
-- ──────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- PROFILES policies
CREATE POLICY "profiles: own row"
  ON profiles FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin all"
  ON profiles FOR ALL
  USING (public.is_admin());

-- JOBS policies
CREATE POLICY "jobs: own rows"
  ON jobs FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "jobs: admin all"
  ON jobs FOR ALL
  USING (public.is_admin());

-- QUOTES policies (via job ownership)
CREATE POLICY "quotes: own via job"
  ON quotes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = quotes.job_id
        AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "quotes: admin all"
  ON quotes FOR ALL
  USING (public.is_admin());

-- FEEDBACK policies
CREATE POLICY "feedback: insert own"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback: admin read"
  ON feedback FOR SELECT
  USING (public.is_admin());
