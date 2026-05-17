// supabase/functions/stripe-webhook-sub/index.ts
// Env vars required in Supabase Dashboard → Settings → Edge Functions:
// STRIPE_SECRET_KEY (use sandbox key for testing, live key for production)
// STRIPE_WEBHOOK_SECRET_SUB
// APP_URL
// STRIPE_SUBSCRIPTION_PRICE_ID
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET_SUB')!,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return new Response(message, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── checkout.session.completed ─────────────────────────────────────────────
  // Fires when a new subscription checkout succeeds. Sets the user active and
  // stores their Stripe IDs.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (userId) {
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
        })
        .eq('id', userId);
    }
  }

  // ── customer.subscription.updated ─────────────────────────────────────────
  // Fires when cancel_at_period_end changes or when a canceled subscription is
  // reactivated. Sync our DB to match Stripe's intent.
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    // Only sync status for active states. For past_due, unpaid, incomplete,
    // etc., do nothing — let Stripe's dunning cycle run. The final
    // customer.subscription.deleted event will set 'canceled'.
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'canceling' })
        .eq('stripe_customer_id', customerId);
    } else if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'active' })
        .eq('stripe_customer_id', customerId);
    }
    // All other Stripe statuses (past_due, unpaid, incomplete, etc.): no-op.
  }

  // ── customer.subscription.deleted ─────────────────────────────────────────
  // Fires when the billing period for a cancel_at_period_end subscription
  // actually expires, or when an immediate cancellation occurs. Final state.
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    await supabase
      .from('profiles')
      .update({ subscription_status: 'canceled' })
      .eq('stripe_customer_id', customerId);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
