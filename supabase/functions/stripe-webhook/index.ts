import Stripe from "https://esm.sh/stripe@18.5.0";
import { type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { getAdminClient, getStripe, syncSubscription } from "../_shared/stripeProduction.ts";
import { grantsAccess, type SubscriptionRow } from "../_shared/subscriptionState.ts";
import { processStripeWebhookEvent, type WebhookIdentifiers } from "./webhookHandler.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const findUserByEmail = async (supabaseAdmin: SupabaseClient, email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
};

async function syncAuthMetadata(admin: SupabaseClient, row: SubscriptionRow): Promise<void> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.user_id);
  if (userError || !userData?.user) return;
  const active = grantsAccess(row.status);
  const subscriptionEnd = row.status === "trialing" ? row.trial_end : row.current_period_end;
  const nextMeta = {
    ...(userData.user.app_metadata ?? {}),
    subscription_status: active ? "active" : "inactive",
    is_active: active,
    stripe_customer_id: row.stripe_customer_id,
    subscription_id: row.stripe_subscription_id,
    plan: row.plan,
    subscription_end: subscriptionEnd,
  };
  const { error } = await admin.auth.admin.updateUserById(row.user_id, { app_metadata: nextMeta });
  if (error) logStep("Auth metadata sync failed", { userId: row.user_id, message: error.message });
}

async function provisionLegacyGuest(
  stripe: Stripe,
  admin: SupabaseClient,
  ids: WebhookIdentifiers,
): Promise<string | null> {
  if (!ids.customerEmail) return null;
  const existingUser = await findUserByEmail(admin, ids.customerEmail);
  let userId = existingUser?.id ?? null;

  if (!userId) {
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: ids.customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: ids.plan ? { plan: ids.plan } : undefined,
    });
    if (createError) throw createError;
    userId = newUser.user?.id ?? null;
    logStep("Legacy guest user created", { userId });

    const { error: resetError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ids.customerEmail,
      options: { redirectTo: "https://finflowbr-com.lovable.app/app" },
    });
    if (resetError) logStep("Magic link error", { message: resetError.message });
  }

  if (userId && ids.customerId) {
    await stripe.customers.update(ids.customerId, {
      metadata: { supabase_user_id: userId },
    });
  }
  return userId;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

    const stripe = getStripe();
    const admin = getAdminClient();

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    const outcome = await processStripeWebhookEvent(event, {
      claim: async (ids, owner) => {
        const { data, error } = await admin.rpc("claim_stripe_event", {
          _event_id: ids.eventId,
          _type: ids.type,
          _event_created: ids.eventCreatedIso,
          _owner: owner,
          _customer_id: ids.customerId,
          _subscription_id: ids.subscriptionId,
          _session_id: ids.sessionId,
          _lease_seconds: 120,
        });
        if (error) throw error;
        return typeof data === "number" ? data : null;
      },
      isProcessed: async (eventId) => {
        const { data, error } = await admin.from("stripe_events")
          .select("processed_at").eq("event_id", eventId).maybeSingle();
        if (error) throw error;
        return Boolean(data?.processed_at);
      },
      complete: async (eventId, owner, token) => {
        const { data, error } = await admin.rpc("complete_stripe_event", {
          _event_id: eventId,
          _owner: owner,
          _token: token,
        });
        if (error) throw error;
        return Boolean(data);
      },
      release: async (eventId, owner, token, errorCode, retrySeconds) => {
        const { data, error } = await admin.rpc("release_stripe_event", {
          _event_id: eventId,
          _owner: owner,
          _token: token,
          _error_code: errorCode,
          _retry_seconds: retrySeconds,
        });
        if (error) throw error;
        return Boolean(data);
      },
      releaseExpiredSession: async (sessionId) => {
        const { error } = await admin.from("trial_reservations")
          .update({ status: "released", released_at: new Date().toISOString() })
          .eq("checkout_session_id", sessionId)
          .eq("status", "reserved");
        if (error) throw error;
        logStep("Expired checkout reservation released", { sessionId });
      },
      provisionLegacyGuest: async (ids) => await provisionLegacyGuest(stripe, admin, ids),
      syncSubscription: async (subscriptionId) => {
        const row = await syncSubscription(stripe, admin, subscriptionId);
        if (!row) {
          logStep("Subscription unmapped", { subscriptionId });
          return null;
        }
        await syncAuthMetadata(admin, row);
        logStep("Subscription reconciled", {
          subscriptionId: row.stripe_subscription_id,
          status: row.status,
          plan: row.plan,
        });
        return { userId: row.user_id };
      },
    });

    return jsonResponse(outcome.body, outcome.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return jsonResponse({ error: message }, 400);
  }
});
