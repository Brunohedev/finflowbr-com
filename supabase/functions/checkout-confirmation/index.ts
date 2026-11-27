import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdminClient, getStripe, syncSubscription } from "../_shared/stripeProduction.ts";
import { BillingDisabledError, getBillingCapabilities, runWithBillingCapability } from "../_shared/billingRollout.ts";
import { accessSnapshot } from "../_shared/subscriptionState.ts";

const Body = z.object({ session_id: z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(255) });
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function confirmCheckout(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid session", code: "INVALID_SESSION" }, 400);

  const admin = getAdminClient();
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Not authenticated", code: "UNAUTHORIZED" }, 401);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(parsed.data.session_id);
  const ownerId = session.client_reference_id ?? session.metadata?.supabase_user_id;
  if (ownerId !== user.id) return json({ error: "Session does not belong to this user", code: "SESSION_OWNER_MISMATCH" }, 403);

  if (session.status === "expired") {
    await admin.from("trial_reservations").update({ status: "released", released_at: new Date().toISOString() })
      .eq("checkout_session_id", session.id).eq("status", "reserved");
    return json({ error: "Checkout expired", code: "CHECKOUT_EXPIRED" }, 409);
  }
  if (session.status !== "complete") {
    return json({ error: "Checkout is not complete", code: "CHECKOUT_NOT_COMPLETE" }, 409);
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return json({ error: "Subscription is not ready", code: "SUBSCRIPTION_NOT_READY" }, 409);
  const row = await syncSubscription(stripe, admin, subscriptionId);
  if (!row || row.user_id !== user.id) {
    return json({ error: "Subscription ownership could not be confirmed", code: "SUBSCRIPTION_OWNER_MISMATCH" }, 403);
  }

  return json({
    ...accessSnapshot([row]),
    checkout_status: session.status,
    trial_started: row.status === "trialing",
    payment_received: session.payment_status === "paid",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const capabilities = getBillingCapabilities(Deno.env.toObject());
    return await runWithBillingCapability(
      capabilities.checkoutConfirmation,
      "CHECKOUT_CONFIRMATION_DISABLED",
      () => confirmCheckout(req),
    );
  } catch (error) {
    if (error instanceof BillingDisabledError) {
      return json({ error: "Checkout confirmation is not available", code: error.code }, 503);
    }
    console.warn("Checkout confirmation failed", { message: error instanceof Error ? error.message : String(error) });
    return json({ error: "Could not confirm checkout", code: "CONFIRMATION_FAILED" }, 500);
  }
});
