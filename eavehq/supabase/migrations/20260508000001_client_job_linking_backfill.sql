-- Migration: client_job_linking_backfill
-- Backfills client_id on existing jobs that were created before NewJobModal wrote to clients.
-- Three-pass: email match → phone match → name-only.
-- Safe to run repeatedly: each pass only touches jobs where client_id IS NULL.

BEGIN;

-- ─── Pass 1: email match ──────────────────────────────────────────────────────
-- For each distinct (user_id, client_email) pair, upsert a clients row and
-- point all matching null-client_id jobs at it.

DO $$
DECLARE
  rec          RECORD;
  cid          uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id, client_email, client_name, client_phone
    FROM jobs
    WHERE client_email IS NOT NULL AND client_email <> ''
      AND client_id IS NULL
  LOOP
    -- Try to find an existing client for this contractor + email
    SELECT id INTO cid
    FROM clients
    WHERE contractor_id = rec.user_id
      AND email = rec.client_email
    LIMIT 1;

    IF cid IS NULL THEN
      INSERT INTO clients (contractor_id, name, email, phone)
      VALUES (
        rec.user_id,
        COALESCE(NULLIF(rec.client_name, ''), rec.client_email),
        rec.client_email,
        NULLIF(rec.client_phone, '')
      )
      RETURNING id INTO cid;
    END IF;

    UPDATE jobs
    SET client_id = cid
    WHERE user_id = rec.user_id
      AND client_email = rec.client_email
      AND client_id IS NULL;
  END LOOP;
END;
$$;

-- ─── Pass 2: phone match (for jobs still without client_id, no email) ─────────

DO $$
DECLARE
  rec          RECORD;
  cid          uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id, client_phone, client_name
    FROM jobs
    WHERE (client_email IS NULL OR client_email = '')
      AND client_phone IS NOT NULL AND client_phone <> ''
      AND client_id IS NULL
  LOOP
    SELECT id INTO cid
    FROM clients
    WHERE contractor_id = rec.user_id
      AND phone = rec.client_phone
    LIMIT 1;

    IF cid IS NULL THEN
      INSERT INTO clients (contractor_id, name, phone)
      VALUES (
        rec.user_id,
        COALESCE(NULLIF(rec.client_name, ''), rec.client_phone),
        rec.client_phone
      )
      RETURNING id INTO cid;
    END IF;

    UPDATE jobs
    SET client_id = cid
    WHERE user_id = rec.user_id
      AND client_phone = rec.client_phone
      AND (client_email IS NULL OR client_email = '')
      AND client_id IS NULL;
  END LOOP;
END;
$$;

-- ─── Pass 3: name only (no dedup — each remaining job gets its own client) ────

DO $$
DECLARE
  rec          RECORD;
  cid          uuid;
BEGIN
  FOR rec IN
    SELECT id AS job_id, user_id, client_name
    FROM jobs
    WHERE (client_email IS NULL OR client_email = '')
      AND (client_phone IS NULL OR client_phone = '')
      AND client_name IS NOT NULL AND client_name <> ''
      AND client_id IS NULL
  LOOP
    INSERT INTO clients (contractor_id, name)
    VALUES (rec.user_id, rec.client_name)
    RETURNING id INTO cid;

    UPDATE jobs
    SET client_id = cid
    WHERE id = rec.job_id;
  END LOOP;
END;
$$;

COMMIT;
