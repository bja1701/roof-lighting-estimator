-- Logo uploads: Storage RLS for bucket "logos" (used by SettingsPage).
-- Without these policies, uploads fail with: "new row violates row-level security policy"
--
-- Apply via: Supabase Dashboard → SQL → New query → Run, or `supabase db push`.

-- file_size_limit in bytes (10 MiB); null = platform default, which is often small
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('logos', 'logos', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "logos: public read" ON storage.objects;
DROP POLICY IF EXISTS "logos: authenticated insert own folder" ON storage.objects;
DROP POLICY IF EXISTS "logos: authenticated update own folder" ON storage.objects;
DROP POLICY IF EXISTS "logos: authenticated delete own folder" ON storage.objects;

-- Public URLs (PDFs, print preview) need read access
CREATE POLICY "logos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- App uploads to {auth.uid}/logo.ext
CREATE POLICY "logos: authenticated insert own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "logos: authenticated update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "logos: authenticated delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND name LIKE (auth.uid()::text || '/%')
  );
