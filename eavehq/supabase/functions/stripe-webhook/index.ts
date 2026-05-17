import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("No stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${String(err)}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // ── Subscription checkout ──────────────────────────────────────────────
    if (session.mode === "subscription") {
      const supabaseUserId = session.metadata?.supabase_user_id;
      if (!supabaseUserId) {
        console.warn("Subscription checkout missing supabase_user_id — skipping.");
        return new Response("ok");
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq("id", supabaseUserId);

      if (error) {
        console.error("Failed to activate subscription:", error);
        return new Response("DB update failed", { status: 500 });
      }
      console.log(`Subscription activated for user ${supabaseUserId}`);
      return new Response("ok", { status: 200 });
    }

    // ── Job payment checkout (deposit / final) ─────────────────────────────
    const jobId = session.metadata?.job_id;
    const type = session.metadata?.type as "deposit" | "final" | undefined;

    if (!jobId || !type) {
      console.warn("Webhook missing job_id or type in metadata — skipping.");
      return new Response("ok");
    }

    const updatePayload =
      type === "deposit"
        ? { status: "deposit_paid", deposit_paid_at: new Date().toISOString() }
        : { status: "final_paid", final_paid_at: new Date().toISOString() };

    const { error } = await supabaseAdmin
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId);

    if (error) {
      console.error("Failed to update job status:", error);
      return new Response("DB update failed", { status: 500 });
    }

    console.log(`Job ${jobId} updated to ${updatePayload.status}`);
  }

  // ── Subscription cancelled ─────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "canceled" })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("Failed to cancel subscription:", error);
      return new Response("DB update failed", { status: 500 });
    }
    console.log(`Subscription ${subscription.id} cancelled`);
  }

  return new Response("ok", { status: 200 });
});
