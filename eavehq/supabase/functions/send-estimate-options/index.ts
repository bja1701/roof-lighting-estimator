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
    const { job_id, custom_message, deposit_percentage } = await req.json() as {
      job_id: string;
      custom_message?: string;
      deposit_percentage: number;
    };
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (
      typeof deposit_percentage !== 'number' ||
      deposit_percentage < 1 ||
      deposit_percentage > 100
    ) {
      return new Response(JSON.stringify({ error: 'deposit_percentage must be a number between 1 and 100' }), {
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
      .select('id, user_id, name, client_name, client_email, portal_token')
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

    // 4. Fetch all estimates for this job
    const { data: estimates, error: estimatesError } = await supabaseAdmin
      .from('quotes')
      .select('id, label, total_price, notes')
      .eq('job_id', job_id)
      .order('created_at', { ascending: true });

    if (estimatesError) {
      return new Response(JSON.stringify({ error: estimatesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!estimates || estimates.length === 0) {
      return new Response(JSON.stringify({ error: 'No estimates found for this job' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Fetch contractor profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', user.id)
      .single();

    const companyName = profile?.company_name ?? profile?.full_name ?? 'Your contractor';

    // 6. Skip gracefully if no client email
    if (!job.client_email) {
      console.warn(`send-estimate-options: job ${job_id} has no client_email — skipping email`);
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: 'no client email on record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://eavehq.com';
    const clientName = job.client_name ?? 'there';

    // 7. Build one card per estimate
    const estimateCards = estimates.map((est) => {
      const price =
        est.total_price != null
          ? `$${Number(est.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'Price TBD';
      const depositAmount =
        est.total_price != null
          ? `$${(Number(est.total_price) * (deposit_percentage / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null;
      const deepLink = job.portal_token
        ? `${siteUrl}/quote/${job.portal_token}?estimate=${est.id}`
        : siteUrl;
      const notesRow = est.notes
        ? `<p style="margin:4px 0 12px;font-size:13px;color:#6b7280;line-height:1.5">${est.notes}</p>`
        : '';
      const depositRow = depositAmount
        ? `<p style="margin:0 0 12px;font-size:13px;color:#374151">Deposit due (${deposit_percentage}%): <strong>${depositAmount}</strong></p>`
        : '';
      return `
  <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:20px 24px">
    <tr><td>
      <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827">${est.label}</p>
      <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#f59e0b">${price}</p>
      ${depositRow}
      ${notesRow}
      <a href="${deepLink}"
         style="display:inline-block;background:#f59e0b;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:10px 22px;border-radius:7px">
        Select This Option &rarr;
      </a>
    </td></tr>
  </table>`;
    }).join('');

    const customMessageBlock = custom_message
      ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${custom_message}</p>`
      : '';

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 48px;max-width:560px">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Your estimate options from ${companyName}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280">Hi ${clientName},</p>
          ${customMessageBlock}
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6">
            Here are your estimate options. Click <strong>Select This Option</strong> on whichever works best for you to review and pay your deposit.
          </p>
          ${estimateCards}
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
            If you have any questions, reply to this email or contact your contractor directly.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const resendApiKey = Deno.env.get('RESEND_API');
    if (!resendApiKey) {
      console.error('send-estimate-options: RESEND_API not set — skipping email');
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
        subject: `Your estimate options from ${companyName} — ${job.name}`,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error(`send-estimate-options: Resend error ${emailRes.status}: ${errBody}`);
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
