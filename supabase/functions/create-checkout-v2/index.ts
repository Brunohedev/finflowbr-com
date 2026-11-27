import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { findOrCreateCustomer, getAdminClient, getStripe, syncSubscription } from "../_shared/stripeProduction.ts";
import { BillingDisabledError, getBillingCapabilities, runWithBillingCapability } from "../_shared/billingRollout.ts";
import { PLAN_CATALOG, TRIAL_DAYS, grantsAccess } from "../_shared/subscriptionState.ts";

const Body = z.object({
  plan: z.enum(["mensal", "semestral", "anual"]),
  request_id: z.string().uuid().optional(),
});
const IN_FLIGHT_MS = 2 * 60 * 1000;
const ALLOWED_ORIGINS = new Set([
  "https://finflowbr.com",
  "https://www.finflowbr.com",
  "https://finflowbr-com.lovable.app",
  "https://id-preview--a430a672-fa77-4f52-86c7-0a9f9b29c73c.lovable.app",
  "http://localhost:8080",
]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function handleCheckout(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request", code: "INVALID_REQUEST" }, 400);

  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Invalid origin", code: "INVALID_ORIGIN" }, 400);

  const admin = getAdminClient();
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.email) return json({ error: "Sign in to subscribe", code: "UNAUTHORIZED" }, 401);

  const { data: existing, error: existingError } = await admin.from("subscriptions")
    .select("status").eq("user_id", user.id);
  if (existingError) throw existingError;
  if ((existing ?? []).some((subscription) => grantsAccess(subscription.status))) {
    return json({ url: null, code: "already_subscribed", trial: false });
  }

  const stripe = getStripe();
  const plan = parsed.data.plan;
  const customerId = await findOrCreateCustomer(stripe, admin, { id: user.id, email: user.email });
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_trial", {
    _user_id: user.id,
    _email: user.email,
  });
  if (reserveError) throw reserveError;

  const decision = reservation?.decision;
  if (!["granted", "own_pending", "used"].includes(decision)) throw new Error("Invalid reservation decision");

  let trial = decision !== "used";
  let reservationId: string | null = trial ? reservation.reservation_id : null;
  let generation: number | null = trial ? reservation.generation : null;
  let ownsReservation = decision === "granted";

  if (decision === "own_pending") {
    const { data: row, error: rowError } = await admin.from("trial_reservations")
      .select("id,generation,checkout_session_id,updated_at")
      .eq("id", reservationId).eq("generation", generation).eq("status", "reserved").single();
    if (rowError) throw rowError;

    if (row.checkout_session_id) {
      const previous = await stripe.checkout.sessions.retrieve(row.checkout_session_id);
      if (previous.status === "complete") {
        ownsReservation = false;
        const subscriptionId = typeof previous.subscription === "string" ? previous.subscription : previous.subscription?.id;
        if (subscriptionId) await syncSubscription(stripe, admin, subscriptionId);
        return json({ url: null, code: "checkout_already_completed", trial: false, session_id: previous.id });
      }
      if (previous.status === "open" && previous.url) {
        ownsReservation = false;
        return json({ url: previous.url, trial: true, session_id: previous.id, reused: true });
      }
      if (previous.status === "open") {
        // An ambiguous expiry keeps the reservation untouched and fails closed.
        ownsReservation = false;
        await stripe.checkout.sessions.expire(previous.id);
      }

      const { data: claimed, error: claimError } = await admin.from("trial_reservations")
        .update({ checkout_session_id: null, checkout_expires_at: null })
        .eq("id", row.id).eq("generation", row.generation).eq("status", "reserved")
        .eq("checkout_session_id", row.checkout_session_id).select("id");
      if (claimError) throw claimError;
      if (!claimed || claimed.length === 0) {
        ownsReservation = false;
        return json({ url: null, code: "checkout_in_progress", trial: true });
      }
      ownsReservation = true;
    } else {
      if (Date.now() - new Date(row.updated_at).getTime() < IN_FLIGHT_MS) {
        return json({ url: null, code: "checkout_in_progress", trial: true });
      }
      const { data: claimed, error: claimError } = await admin.from("trial_reservations")
        .update({ stripe_customer_id: customerId })
        .eq("id", row.id).eq("generation", row.generation).eq("status", "reserved")
        .eq("updated_at", row.updated_at).is("checkout_session_id", null).select("id");
      if (claimError) throw claimError;
      if (!claimed || claimed.length === 0) {
        return json({ url: null, code: "checkout_in_progress", trial: true });
      }
      ownsReservation = true;
    }
  }

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 35 * 60;
    const idempotencyKey = parsed.data.request_id
      ? `checkout-v2:${user.id}:${parsed.data.request_id}`
      : reservationId && generation
      ? `checkout-v2:trial:${reservationId}:${generation}`
      : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: PLAN_CATALOG[plan].priceId, quantity: 1 }],
      payment_method_collection: "always",
      expires_at: expiresAt,
      success_url: `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planos`,
      metadata: { plan, supabase_user_id: user.id, trial: trial ? "true" : "false" },
      subscription_data: {
        metadata: { plan, supabase_user_id: user.id },
        ...(trial ? {
          trial_period_days: TRIAL_DAYS,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        } : {}),
      },
    }, idempotencyKey ? { idempotencyKey } : undefined);

    if (trial && reservationId && generation) {
      const { data: linked, error: linkError } = await admin.from("trial_reservations")
        .update({
          checkout_session_id: session.id,
          stripe_customer_id: customerId,
          checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
        })
        .eq("id", reservationId).eq("generation", generation).eq("status", "reserved")
        .is("checkout_session_id", null).select("id");
      if (linkError || !linked || linked.length === 0) {
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        throw new Error("Checkout could not be linked to its reservation");
      }
    }

    ownsReservation = false;
    return json({ url: session.url, trial, session_id: session.id });
  } catch (error) {
    if (ownsReservation && reservationId && generation) {
      await admin.from("trial_reservations").update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", reservationId).eq("generation", generation).eq("status", "reserved").is("checkout_session_id", null);
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const capabilities = getBillingCapabilities(Deno.env.toObject());
    return await runWithBillingCapability(capabilities.checkoutV2, "CHECKOUT_V2_DISABLED", () => handleCheckout(req));
  } catch (error) {
    if (error instanceof BillingDisabledError) {
      return json({ error: "This checkout is not available", code: error.code }, 503);
    }
    console.warn("Checkout v2 failed", { message: error instanceof Error ? error.message : String(error) });
    return json({ error: "Could not start checkout", code: "CHECKOUT_FAILED" }, 500);
  }
});
