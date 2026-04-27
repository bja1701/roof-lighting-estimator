import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Verify Resend webhook signature (Svix-based HMAC-SHA256)
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!secret) return false;

  const msgId = req.headers.get('svix-id');
  const msgTimestamp = req.headers.get('svix-timestamp');
  const msgSignature = req.headers.get('svix-signature');
  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Reject timestamps older than 5 minutes
  const ts = parseInt(msgTimestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Decode the whsec_ secret (base64 after stripping the prefix)
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(toSign));
  const computed = 'v1,' + btoa(String.fromCharCode(...new Uint8Array(sig)));

  // svix-signature may contain multiple space-separated signatures
  return msgSignature.split(' ').some(s => s === computed);
}

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
    const rawBody = await req.text();

    const verified = await verifySignature(req, rawBody);
    if (!verified) {
      console.warn('resend-webhook: signature verification failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      type: string;
      data?: {
        tags?: Array<{ name: string; value: string }>;
      };
    };

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
      .is('client_opened_at', null); // only record first open

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
