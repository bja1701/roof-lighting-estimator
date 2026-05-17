/**
 * gcal-pull — Fetch Google Calendar events for a date range.
 *
 * GET ?start=<ISO>&end=<ISO>
 *
 * Returns { events: GCalEvent[] } where each event has:
 *   id, summary, start (ISO), end (ISO), isAllDay
 *
 * Returns 200 { events: [] } when GCal is not connected (caller treats it as no-op).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GCAL_TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const GCAL_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GCAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const empty = new Response(JSON.stringify({ events: [] }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return empty;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userErr || !user) return empty;

    const { data: profile } = await supabase
      .from('profiles')
      .select('gcal_connected, gcal_refresh_token')
      .eq('id', user.id)
      .single();

    if (!profile?.gcal_connected || !profile?.gcal_refresh_token) return empty;

    const url    = new URL(req.url);
    const start  = url.searchParams.get('start');
    const end    = url.searchParams.get('end');
    if (!start || !end) return empty;

    const accessToken = await refreshAccessToken(profile.gcal_refresh_token);

    const listUrl = new URL(GCAL_EVENTS_URL);
    listUrl.searchParams.set('timeMin', start);
    listUrl.searchParams.set('timeMax', end);
    listUrl.searchParams.set('singleEvents', 'true');
    listUrl.searchParams.set('orderBy', 'startTime');
    listUrl.searchParams.set('maxResults', '250');

    const res = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return empty;

    const body = await res.json();
    const items = (body.items ?? []) as Array<Record<string, unknown>>;

    const events = items.map(item => {
      const startObj = item.start as Record<string, string> | undefined;
      const endObj   = item.end   as Record<string, string> | undefined;
      const isAllDay = !!startObj?.date && !startObj?.dateTime;
      return {
        id:       item.id as string,
        summary:  (item.summary as string | undefined) ?? '(No title)',
        start:    startObj?.dateTime ?? startObj?.date ?? '',
        end:      endObj?.dateTime   ?? endObj?.date   ?? '',
        isAllDay,
      };
    });

    return new Response(JSON.stringify({ events }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gcal-pull] error:', err);
    return empty; // fail silently — calendar page still works without GCal
  }
});
