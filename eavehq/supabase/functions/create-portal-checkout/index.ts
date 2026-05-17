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
    const { portal_token, quote_id } = await req.json() as {
      portal_token: string;
      quote_id: string;
    };

    if (!portal_token || !quote_id) {
      return new Response(JSON.stringify({ error: 'portal_token and quote_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, user_id, name, deposit_percent, client_email, status')
      .eq('portal_token', portal_token)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('id, job_id, label, total_price')
      .eq('id', quote_id)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (quote.job_id !== job.id) {
      return new Response(JSON.stringify({ error: 'Quote does not belong to this job' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_connect_enabled')
      .eq('id', job.user_id)
      .single();

    const depositPercent = job.deposit_percent ?? 50;
    const totalPrice = quote.total_price ?? 0;
    const depositCents = Math.round(totalPrice * (depositPercent / 100) * 100);

    if (depositCents < 50) {
      return new Response(JSON.stringify({ error: 'Deposit amount is too small to process' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawSiteUrl = Deno.env.get('SITE_URL') || 'eavehq.nexusflow.solutions';
    const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`;

    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${siteUrl}/quote/${portal_token}/success`,
      cancel_url: `${siteUrl}/quote/${portal_token}`,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(depositCents),
      'line_items[0][price_data][product_data][name]': `Deposit: ${job.name} — ${quote.label}`,
      'line_items[0][quantity]': '1',
      'metadata[job_id]': job.id,
      'metadata[quote_id]': quote.id,
      'metadata[portal_token]': portal_token,
    });

    if (job.client_email) params.set('customer_email', job.client_email);

    if (ownerProfile?.stripe_connect_enabled && ownerProfile?.stripe_account_id) {
      params.set('payment_intent_data[transfer_data][destination]', ownerProfile.stripe_account_id);
    }

    let stripeRes: Response;
    try {
      stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2024-04-10',
        },
        body: params.toString(),
      });
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      throw new Error(`fetch-to-stripe failed: ${msg}`);
    }

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      const errMsg = session?.error?.message ?? 'Stripe error';
      // If Connect transfer rejected, retry without it
      if (errMsg.toLowerCase().includes('transfer_data') && ownerProfile?.stripe_account_id) {
        params.delete('payment_intent_data[transfer_data][destination]');
        const retryRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2024-04-10',
          },
          body: params.toString(),
        });
        const retrySession = await retryRes.json();
        if (!retryRes.ok) throw new Error(retrySession?.error?.message ?? 'Stripe retry error');
        return new Response(JSON.stringify({ checkout_url: retrySession.url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(errMsg);
    }

    return new Response(JSON.stringify({ checkout_url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const stack = err instanceof Error ? (err.stack ?? '').substring(0, 800) : '';
    return new Response(JSON.stringify({ error: message, stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
