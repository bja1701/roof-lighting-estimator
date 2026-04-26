import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// No JWT auth — this endpoint is called by Resend's webhook delivery.
// Resend does not send an Authorization header; security comes from the
// event type check and the fact that the job_id is internal (UUID).

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const payload = await req.json() as {
      type: string;
      data?: {
        tags?: Array<{ name: string; value: string }>;
      };
    };

    // Only handle email.opened events
    if (payload.type !== 'email.opened') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const tags = payload.data?.tags ?? [];
    const jobIdTag = tags.find((t) => t.name === 'job_id');
    if (!jobIdTag?.value) {
      console.warn('resend-webhook: email.opened event missing job_id tag');
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const jobId = jobIdTag.value;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabaseAdmin
      .from('jobs')
      .update({ client_opened_at: new Date().toISOString() })
      .eq('id', jobId)
      .is('client_opened_at', null); // only set first open

    if (error) {
      console.error('resend-webhook: failed to update client_opened_at', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    console.log(`resend-webhook: recorded first open for job ${jobId}`);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('resend-webhook: unexpected error', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
