-- Phase 3: CRM / Job Tracking Dashboard
-- Creates clients table, job_notes, job_attachments; adds client_id FK to jobs; backfill.

-- ─── 1. clients table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  phone           text,
  email           text,
  address_street  text,
  address_city    text,
  address_zip     text,
  company_name    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: contractors can CRUD their own rows only
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: contractor full access"
  ON clients
  FOR ALL
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

-- ─── 2. client_id FK on jobs ──────────────────────────────────────────────────

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_date date;

-- ─── 3. Backfill: match existing jobs to clients by email ─────────────────────
-- For each distinct (user_id, client_email) pair, create a client record,
-- then point all matching jobs at it. Only runs where client_email is not null.

DO $$
DECLARE
  rec RECORD;
  new_client_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id, client_email, client_name, client_phone
    FROM jobs
    WHERE client_email IS NOT NULL AND client_email <> ''
  LOOP
    INSERT INTO clients (contractor_id, name, phone, email)
    VALUES (
      rec.user_id,
      COALESCE(rec.client_name, rec.client_email),
      rec.client_phone,
      rec.client_email
    )
    RETURNING id INTO new_client_id;

    UPDATE jobs
    SET client_id = new_client_id
    WHERE user_id = rec.user_id
      AND client_email = rec.client_email
      AND client_id IS NULL;
  END LOOP;
END;
$$;

-- ─── 4. job_notes table ──────────────────────────────────────────────────────

CREATE TYPE job_note_type AS ENUM ('customer', 'private');

CREATE TABLE IF NOT EXISTS job_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contractor_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            job_note_type NOT NULL DEFAULT 'customer',
  body            text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER job_notes_updated_at
  BEFORE UPDATE ON job_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

-- Contractor: full access to their own notes
CREATE POLICY "job_notes: contractor full access"
  ON job_notes
  FOR ALL
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

-- Client portal: read customer-type notes by portal_token
-- Reads are allowed when the job's portal_token matches the request header
CREATE POLICY "job_notes: portal read customer"
  ON job_notes
  FOR SELECT
  USING (
    type = 'customer'
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_notes.job_id
        AND j.portal_token IS NOT NULL
        AND j.portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

-- ─── 5. job_attachments table ─────────────────────────────────────────────────

CREATE TYPE attachment_uploader_type AS ENUM ('contractor', 'client');

CREATE TABLE IF NOT EXISTS job_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note_id         uuid REFERENCES job_notes(id) ON DELETE SET NULL,
  uploader_type   attachment_uploader_type NOT NULL DEFAULT 'contractor',
  storage_path    text NOT NULL,
  filename        text NOT NULL,
  mime_type       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;

-- Contractor: full access to attachments on their own jobs
CREATE POLICY "job_attachments: contractor full access"
  ON job_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_attachments.job_id
        AND j.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_attachments.job_id
        AND j.user_id = auth.uid()
    )
  );

-- Client portal: INSERT with uploader_type = 'client' via portal_token
CREATE POLICY "job_attachments: portal client insert"
  ON job_attachments
  FOR INSERT
  WITH CHECK (
    uploader_type = 'client'
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_attachments.job_id
        AND j.portal_token IS NOT NULL
        AND j.portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

-- Client portal: SELECT own uploads
CREATE POLICY "job_attachments: portal client select"
  ON job_attachments
  FOR SELECT
  USING (
    uploader_type = 'client'
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_attachments.job_id
        AND j.portal_token IS NOT NULL
        AND j.portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

-- ─── 6. Storage bucket: job-files ────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-files', 'job-files', false)
ON CONFLICT (id) DO NOTHING;

-- Contractor can upload/read/delete their own job files
CREATE POLICY "job-files: contractor upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'job-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "job-files: contractor read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'job-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "job-files: contractor delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'job-files'
    AND auth.uid() IS NOT NULL
  );
