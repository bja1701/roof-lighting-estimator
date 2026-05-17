/**
 * gcal-oauth-callback — Google OAuth 2.0 callback handler.
 *
 * Google redirects here after the user grants calendar access.
 * Query params: code, state (= Supabase user ID encoded as base64)
 *
 * Exchanges the code for refresh + access tokens, stores refresh token
 * on profiles.gcal_refresh_token, sets gcal_connected = true.
 * Then redirects to /settings?gcal=success (or ?gcal=error on failure).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GCAL_TOKEN_URL = 'https://oauth2.googleapis.com/token';

serve(async (req) => {
  const url      = new URL(req.url);
  const code     = url.searchParams.get('code');
  const stateB64 = url.searchParams.get('state');
  const appUrl   = Deno.env.get('APP_URL') ?? 'https://eavehq.com';

  const redirect = (path: string) =>
    new Response(null, { status: 302, headers: { Location: `${appUrl}${path}` } });

  if (!code || !stateB64) return redirect('/settings?gcal=error&reason=missing_params');

  let userId: string;
  try {
    userId = atob(stateB64);
  } catch {
    return redirect('/settings?gcal=error&reason=bad_state');
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(GCAL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri:  Deno.env.get('GCAL_REDIRECT_URI') ?? '',
        grant_type:    'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) {
      console.error('[gcal-oauth-callback] token exchange failed:', tokens);
      return redirect('/settings?gcal=error&reason=token_exchange');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error } = await supabase
      .from('profiles')
      .update({ gcal_connected: true, gcal_refresh_token: tokens.refresh_token })
      .eq('id', userId);

    if (error) {
      console.error('[gcal-oauth-callback] profile update failed:', error);
      return redirect('/settings?gcal=error&reason=db_write');
    }

    return redirect('/settings?gcal=success');
  } catch (err) {
    console.error('[gcal-oauth-callback] unexpected error:', err);
    return redirect('/settings?gcal=error&reason=unexpected');
  }
});
