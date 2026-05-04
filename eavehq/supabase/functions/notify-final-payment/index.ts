import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the contractor via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request body
    const { job_id } = await req.json() as { job_id: string };
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 3. Fetch the job and verify ownership
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, user_id, name, status, client_name, client_email, portal_token')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (job.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Guard: only in_progress jobs may be marked complete
    if (job.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: `Job must be in_progress to mark complete (current: ${job.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Fetch contractor's display name from profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', user.id)
      .single();

    const contractorName =
      profile?.company_name ?? profile?.full_name ?? 'Your contractor';

    // 6. Advance job status to complete
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({ status: 'complete' })
      .eq('id', job_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Send Resend email — skip gracefully if no client email is stored
    if (!job.client_email) {
      console.warn(`notify-final-payment: job ${job_id} has no client_email — skipping email`);
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: 'no client email on record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://eavehq.com';
    const portalLink = job.portal_token
      ? `${siteUrl}/quote/${job.portal_token}`
      : siteUrl;

    const clientName = job.client_name ?? 'there';

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ed;padding:48px 0">
    <tr><td align="center" style="padding:0 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

        <!-- Brand header -->
        <tr><td style="background:#1f3d2c;border-radius:12px 12px 0 0;padding:22px 40px">
          <p style="margin:0;font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.3px">EaveHQ</p>
          <p style="margin:3px 0 0;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.12em">Roofline Lighting</p>
        </td></tr>

        <!-- Accent stripe -->
        <tr><td style="height:3px;background:#d96f0a;font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- Card body -->
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #dedad4;border-top:none;padding:40px 40px 36px">

          <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1a1a1a;letter-spacing:-0.4px">Your job is complete</p>
          <p style="margin:0 0 24px;font-size:15px;color:#5a6070">Hi ${clientName},</p>

          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
            Great news — <strong>${contractorName}</strong> has completed your job
            <strong>${job.name}</strong>. Your final payment is now due.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px">
            <tr><td>
              <a href="${portalLink}"
                 style="display:inline-block;background:#d96f0a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:0.01em">
                Pay Final Balance &rarr;
              </a>
            </td></tr>
          </table>

          <p style="margin:0;padding-top:20px;border-top:1px solid #dedad4;font-size:13px;color:#5a6070;line-height:1.6">
            If you have any questions, reply to this email or contact your contractor directly.<br>
            <span style="color:#a8b0bc">Sent via EaveHQ</span>
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const resendApiKey = Deno.env.get('RESEND_API');
    if (!resendApiKey) {
      console.error('notify-final-payment: RESEND_API not set — skipping email');
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: 'RESEND_API not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EaveHQ <eavehq@nexusflow.solutions>',
        to: [job.client_email],
        subject: 'Your job is complete — final payment due',
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error(`notify-final-payment: Resend error ${emailRes.status}: ${errBody}`);
      // Status already updated — report success but flag email failure
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: `Resend error: ${emailRes.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
