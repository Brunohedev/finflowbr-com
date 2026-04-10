import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_MAP: Record<string, string> = {
  mensal: "price_1TFJCqETsKMFlYgf17AWyncm",
  semestral: "price_1TFJDUETsKMFlYgfTeuJbIcE",
  anual: "price_1TFJFDETsKMFlYgftrXoLKEq",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan } = await req.json();
    if (!plan || !PRICE_MAP[plan]) {
      throw new Error(`Invalid plan: ${plan}. Must be one of: mensal, semestral, anual`);
    }
    logStep("Plan selected", { plan });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Try to get authenticated user (optional)
    let userEmail: string | undefined;
    let customerId: string | undefined;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? ""
        );
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        if (data.user?.email) {
          userEmail = data.user.email;
          logStep("Authenticated user found", { email: userEmail });

          const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
            logStep("Existing Stripe customer found", { customerId });
          }
        }
      } catch (authErr) {
        logStep("Auth check failed (proceeding as guest)", { error: String(authErr) });
      }
    } else {
      logStep("No auth header - proceeding as guest checkout");
    }

    const sessionParams: any = {
      line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/sucesso`,
      cancel_url: `${req.headers.get("origin")}/cancelado`,
      metadata: { plan },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (userEmail) {
      sessionParams.customer_email = userEmail;
    }
    // If no user/email, Stripe will collect the email during checkout

    logStep("Creating checkout session", { hasCustomer: !!customerId, hasEmail: !!userEmail });
    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
