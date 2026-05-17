import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-04-10',
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET_PORTAL')!,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return new Response(message, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const portalToken = session.metadata?.portal_token;
  const jobId = session.metadata?.job_id;

  if (!portalToken || !jobId) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const amountDollars = (session.amount_total ?? 0) / 100;
  const customerId = typeof session.customer === 'string' ? session.customer : null;
  const paymentType = session.metadata?.payment_type;

  let updatePayload: Record<string, unknown>;
  if (paymentType === 'final') {
    updatePayload = {
      status: 'final_paid',
      final_paid_at: new Date().toISOString(),
      final_amount: amountDollars,
    };
  } else {
    updatePayload = {
      status: 'deposit_paid',
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: amountDollars,
      stripe_customer_id: customerId,
      stripe_deposit_link: session.url,
    };
  }

  const { error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId);

  if (error) {
    console.error(`Failed to update job on portal ${paymentType ?? 'deposit'}:`, error);
    return new Response('DB update failed', { status: 500 });
  }

  console.log(`Portal ${paymentType ?? 'deposit'} recorded for job ${jobId}: $${amountDollars}`);

  // Send deposit confirmation email only on the deposit path
  if (paymentType !== 'final') {
    const { data: job } = await supabase
      .from('jobs')
      .select('client_name, client_email, portal_token, user_id, name')
      .eq('id', jobId)
      .single();

    if (!job?.client_email) {
      console.warn(`portal-webhook: job ${jobId} has no client_email — skipping deposit email`);
    } else {
      const resendApiKey = Deno.env.get('RESEND_API');
      if (!resendApiKey) {
        console.error('portal-webhook: RESEND_API not set — skipping deposit email');
      } else {
        // Fetch contractor name for the email
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, company_name')
          .eq('id', job.user_id)
          .single();

        const contractorName = profile?.company_name ?? profile?.full_name ?? 'Your contractor';
        const clientName = job.client_name ?? 'there';
        const jobName = job.name ?? 'your job';
        const siteUrl = Deno.env.get('SITE_URL') ?? 'https://eavehq.com';
        const portalLink = job.portal_token
          ? `${siteUrl}/quote/${job.portal_token}`
          : siteUrl;

        const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 48px;max-width:560px">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Deposit received</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280">Hi ${clientName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
            <strong>${contractorName}</strong> has received your deposit of <strong>$${amountDollars.toFixed(2)}</strong>
            for <strong>${jobName}</strong>. You're all set — we'll be in touch as the work progresses.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
            <tr><td>
              <a href="${portalLink}"
                 style="display:inline-block;background:#f59e0b;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px">
                View Your Job Portal &rarr;
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
            If you have any questions, reply to this email or contact your contractor directly.
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
            subject: `Deposit received — ${jobName}`,
            html: htmlBody,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.error(`portal-webhook: Resend error ${emailRes.status}: ${errBody}`);
        } else {
          console.log(`portal-webhook: deposit confirmation email sent to ${job.client_email}`);
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
