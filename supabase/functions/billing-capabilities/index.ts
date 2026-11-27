import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getBillingCapabilities } from "../_shared/billingRollout.ts";
import { TRIAL_SECONDS } from "../_shared/subscriptionState.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const capabilities = getBillingCapabilities(Deno.env.toObject());
  return new Response(JSON.stringify({
    checkout_v2: capabilities.checkoutV2,
    checkout_confirmation: capabilities.checkoutConfirmation,
    account_deletion_with_cancellation: capabilities.accountDeletionWithCancellation,
    trial_seconds: TRIAL_SECONDS,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
