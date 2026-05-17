import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
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
      .select('id, user_id, name, deposit_percent, deposit_amount, client_email, status')
      .eq('portal_token', portal_token)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (job.status !== 'complete') {
      return new Response(JSON.stringify({ error: 'Job is not yet marked complete' }), {
        status: 400,
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

    const totalPrice = quote.total_price ?? 0;

    // Calculate remaining balance: prefer stored deposit_amount, fall back to percent estimate
    const depositAmount =
      job.deposit_amount != null
        ? job.deposit_amount
        : totalPrice * ((job.deposit_percent ?? 50) / 100);

    const finalAmount = totalPrice - depositAmount;

    const finalCents = Math.round(finalAmount * 100);

    if (finalCents < 50) {
      return new Response(JSON.stringify({ error: 'Final amount is too small to process' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-04-10',
    });

    const rawSiteUrl = Deno.env.get('SITE_URL') || 'eavehq.nexusflow.solutions';
    const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: finalCents,
            product_data: {
              name: `Final Payment: ${job.name} — ${quote.label}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/quote/${portal_token}/final-success`,
      cancel_url: `${siteUrl}/quote/${portal_token}`,
      metadata: {
        job_id: job.id,
        quote_id: quote.id,
        portal_token,
        payment_type: 'final',
      },
      ...(job.client_email ? { customer_email: job.client_email } : {}),
    };

    if (ownerProfile?.stripe_connect_enabled && ownerProfile?.stripe_account_id) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: ownerProfile.stripe_account_id },
      };
    } else {
      console.warn(`create-final-checkout: job ${job.id} owner has no Connect account — funds go to platform`);
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr: unknown) {
      const msg = stripeErr instanceof Error ? stripeErr.message : '';
      if (msg.toLowerCase().includes('transfer_data') && sessionParams.payment_intent_data?.transfer_data) {
        console.warn('transfer_data rejected — retrying without it.');
        delete sessionParams.payment_intent_data;
        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw stripeErr;
      }
    }

    return new Response(JSON.stringify({ checkout_url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
