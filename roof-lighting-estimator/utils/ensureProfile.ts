import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * jobs.user_id FK points at profiles(id), not auth.users. If the signup trigger
 * never ran (legacy account, failed migration), job inserts fail with jobs_user_id_fkey.
 */
export async function ensureProfileRowExists(user: User): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) return { ok: true };

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email ?? null,
    full_name: fullName || null,
  });

  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: true };
  return { ok: false, error: error.message };
}
