/**
 * gcal-push — Create or update a Google Calendar event for a scheduled job.
 *
 * POST body: { job_id: string }
 *
 * Reads the job's scheduled_date / times from the DB, exchanges the stored
 * refresh token for an access token, then calls the GCal Events API.
 * Stores the resulting event ID back on the job row (gcal_event_id).
 *
 * Returns 200 { gcal_event_id } on success, or 204 when GCal is not connected.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GCAL_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const GCAL_EVENTS_URL  = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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

function buildEventBody(job: Record<string, unknown>) {
  const date      = job.scheduled_date as string;
  const startTime = job.scheduled_start_time as string | null;
  const endTime   = job.scheduled_end_time   as string | null;
  const anytime   = job.scheduled_anytime    as boolean;
  const name      = job.name as string;
  const address   = job.address as string | null;

  const summary     = name + (address ? ` — ${address}` : '');
  const description = address ? `Address: ${address}` : undefined;

  if (anytime || !startTime) {
    // All-day event
    return {
      summary,
      description,
      start: { date },
      end:   { date },
    };
  }

  // Timed event — build RFC3339 datetimes
  const tz = 'America/Denver'; // default; could be stored per contractor later
  const startDt = `${date}T${startTime}:00`;
  const endDt   = endTime ? `${date}T${endTime}:00` : `${date}T${startTime}:00`;

  return {
    summary,
    description,
    start: { dateTime: startDt, timeZone: tz },
    end:   { dateTime: endDt,   timeZone: tz },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the calling user
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const { job_id } = await req.json() as { job_id: string };
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch profile for GCal token
    const { data: profile } = await supabase
      .from('profiles')
      .select('gcal_connected, gcal_refresh_token')
      .eq('id', user.id)
      .single();

    if (!profile?.gcal_connected || !profile?.gcal_refresh_token) {
      // GCal not connected — silently succeed (no-op)
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Fetch job
    const { data: job } = await supabase
      .from('jobs')
      .select('id, name, address, scheduled_date, scheduled_start_time, scheduled_end_time, scheduled_anytime, gcal_event_id')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single();

    if (!job || !job.scheduled_date) {
      return new Response(JSON.stringify({ error: 'Job not found or not scheduled' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await refreshAccessToken(profile.gcal_refresh_token);
    const eventBody   = buildEventBody(job);
    const existingId  = job.gcal_event_id as string | null;

    let gcalEventId: string;

    if (existingId) {
      // Update existing event
      const res = await fetch(`${GCAL_EVENTS_URL}/${existingId}`, {
        method: 'PUT',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });
      if (res.status === 404) {
        // Event was deleted in GCal — fall through to create
        const createRes = await fetch(GCAL_EVENTS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        });
        const created = await createRes.json();
        gcalEventId = created.id;
      } else {
        const updated = await res.json();
        gcalEventId = updated.id ?? existingId;
      }
    } else {
      // Create new event
      const res = await fetch(GCAL_EVENTS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });
      const created = await res.json();
      gcalEventId = created.id;
    }

    // Store gcal_event_id back on the job
    await supabase.from('jobs').update({ gcal_event_id: gcalEventId }).eq('id', job_id);

    return new Response(JSON.stringify({ gcal_event_id: gcalEventId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gcal-push] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
