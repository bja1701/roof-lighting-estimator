import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId, depositPercent, type } = await req.json() as {
      jobId: string;
      depositPercent: number;
      type: "deposit" | "final";
    };

    if (!jobId || !depositPercent || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields: jobId, depositPercent, type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch job + its quotes to get total value
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*, quotes(total_price)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPrice: number = (job.quotes as { total_price: number | null }[])
      .reduce((sum: number, q: { total_price: number | null }) => sum + (q.total_price ?? 0), 0);

    if (totalPrice === 0) {
      return new Response(
        JSON.stringify({ error: "Job has no estimates with a price. Save an estimate first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const depositAmountDollars = parseFloat(((totalPrice * depositPercent) / 100).toFixed(2));
    const finalAmountDollars = parseFloat((totalPrice - (job.deposit_amount ?? depositAmountDollars)).toFixed(2));
    const amountCents = Math.round(
      (type === "deposit" ? depositAmountDollars : finalAmountDollars) * 100
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_SANDBOX_KEY")!, {
      apiVersion: "2024-04-10",
    });

    // Create a one-time Price with an inline Product
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: type === "deposit"
          ? `Deposit (${depositPercent}%) — ${job.name}`
          : `Final Payment — ${job.name}`,
      },
    });

    // Create the Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { job_id: jobId, type },
      after_completion: {
        type: "hosted_confirmation",
        hosted_confirmation: {
          custom_message: "Payment received! Your contractor will be in touch shortly.",
        },
      },
    });

    // Persist the link and amounts to the job row
    const updatePayload =
      type === "deposit"
        ? {
            stripe_deposit_link: paymentLink.url,
            deposit_percent: depositPercent,
            deposit_amount: depositAmountDollars,
            final_amount: parseFloat((totalPrice - depositAmountDollars).toFixed(2)),
          }
        : { stripe_final_link: paymentLink.url };

    await supabaseAdmin.from("jobs").update(updatePayload).eq("id", jobId);

    return new Response(JSON.stringify({ url: paymentLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-payment-link error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
