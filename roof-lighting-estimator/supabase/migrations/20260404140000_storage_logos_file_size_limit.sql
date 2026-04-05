-- Raise logos bucket max upload size (fixes "The object exceeded the maximum allowed size").
-- Run in Supabase SQL Editor if you already applied the older logos migration without a limit.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('logos', 'logos', true, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;
