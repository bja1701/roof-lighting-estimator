import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called by Supabase cron — no JWT. Authenticated via x-cron-secret header.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-cron-secret' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify cron secret
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const resendApiKey = Deno.env.get('RESEND_API');
  if (!resendApiKey) {
    console.error('send-followup: RESEND_API not set');
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'RESEND_API not configured' }), { status: 200 });
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://eavehq.com';

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch all jobs that qualify for a follow-up.
  // Join profiles to get followup_days and followup_max per contractor.
  // Qualifying conditions:
  //   - estimate_sent_at is not null
  //   - deposit_paid_at is null (client hasn't paid yet)
  //   - followup_count < profiles.followup_max
  //   - enough time has elapsed: now() >= estimate_sent_at + (followup_count + 1) * followup_days days
  //     (first follow-up after followup_days from send; second after 2*followup_days, etc.)
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select(`
      id,
      user_id,
      name,
      client_name,
      client_email,
      portal_token,
      estimate_sent_at,
      followup_count,
      profiles!inner (
        full_name,
        company_name,
        followup_days,
        followup_max
      )
    `)
    .not('estimate_sent_at', 'is', null)
    .is('deposit_paid_at', null);

  if (jobsError) {
    console.error('send-followup: failed to fetch jobs', jobsError.message);
    return new Response(JSON.stringify({ error: jobsError.message }), { status: 500 });
  }

  const now = Date.now();
  let sent = 0;
  const errors: string[] = [];

  for (const job of (jobs ?? [])) {
    const profile = (job as any).profiles as {
      full_name: string | null;
      company_name: string | null;
      followup_days: number;
      followup_max: number;
    };

    const followupMax = profile.followup_max ?? 2;
    const followupDays = profile.followup_days ?? 3;
    const followupCount = job.followup_count ?? 0;

    // Skip if already at max follow-ups
    if (followupCount >= followupMax) continue;

    // Skip if not enough time has elapsed
    const sentAt = new Date(job.estimate_sent_at as string).getTime();
    const daysRequired = (followupCount + 1) * followupDays;
    const msRequired = daysRequired * 24 * 60 * 60 * 1000;
    if (now - sentAt < msRequired) continue;

    // Skip if no client email
    if (!job.client_email) continue;

    const companyName = profile.company_name ?? profile.full_name ?? 'Your contractor';
    const clientName = (job.client_name as string | null) ?? 'there';
    const portalUrl = job.portal_token ? `${siteUrl}/quote/${job.portal_token}` : siteUrl;

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

          <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1a1a1a;letter-spacing:-0.4px">Just checking in</p>
          <p style="margin:0 0 24px;font-size:15px;color:#5a6070">Hi ${clientName},</p>

          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
            We wanted to follow up — your estimate from <strong>${companyName}</strong> for
            <strong>${(job.name as string)}</strong> is still available. Click below whenever you're ready.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px">
            <tr><td>
              <a href="${portalUrl}"
                 style="display:inline-block;background:#d96f0a;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:0.01em">
                View Your Estimate &rarr;
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

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EaveHQ <eavehq@nexusflow.solutions>',
        to: [job.client_email],
        subject: `Following up on your estimate — ${(job.name as string)}`,
        html: htmlBody,
        tags: [{ name: 'job_id', value: job.id }],
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error(`send-followup: Resend error for job ${job.id}: ${emailRes.status} ${errBody}`);
      errors.push(job.id as string);
      continue;
    }

    // Increment followup_count and reset estimate_sent_at to now (resets the interval clock)
    const { error: updateErr } = await supabaseAdmin
      .from('jobs')
      .update({
        followup_count: followupCount + 1,
        estimate_sent_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateErr) {
      console.error(`send-followup: failed to update job ${job.id}:`, updateErr.message);
      errors.push(job.id as string);
    } else {
      sent++;
      console.log(`send-followup: sent follow-up ${followupCount + 1}/${followupMax} for job ${job.id}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, errors: errors.length > 0 ? errors : undefined }),
    { status: 200 },
  );
});
