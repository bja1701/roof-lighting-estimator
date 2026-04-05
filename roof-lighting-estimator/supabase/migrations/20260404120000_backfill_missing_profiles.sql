-- Backfill profiles for auth users who have no row (e.g. created before the signup trigger).
-- Run once in Supabase SQL Editor as a project admin if you still see jobs_user_id_fkey errors.
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
