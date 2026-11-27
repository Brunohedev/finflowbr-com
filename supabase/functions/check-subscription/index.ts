import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { grantsAccess, inactiveSubscriptionSnapshot } from "../_shared/subscriptionState.ts";
import { syncSubscription } from "../_shared/stripeProduction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TFJCqETsKMFlYgf17AWyncm": "mensal",
  "price_1TFJDUETsKMFlYgfTeuJbIcE": "semestral",
  "price_1TFJFDETsKMFlYgftrXoLKEq": "anual",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

type SubscriptionSnapshot = {
  subscribed: boolean;
  plan: string | null;
  subscriptionId: string | null;
  subscriptionEnd: string | null;
  customerId: string | null;
  status?: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

const buildResponseBody = (snapshot: SubscriptionSnapshot) => ({
  subscribed: snapshot.subscribed,
  plan: snapshot.plan,
  subscription_id: snapshot.subscriptionId,
  subscription_end: snapshot.subscriptionEnd,
  status: snapshot.status ?? (snapshot.subscribed ? "active" : null),
  trial_end: snapshot.trialEnd ?? null,
  cancel_at_period_end: snapshot.cancelAtPeriodEnd ?? false,
});

const getStoredSnapshot = (user: any): SubscriptionSnapshot => {
  const appMetadata = user?.app_metadata && typeof user.app_metadata === "object"
    ? user.app_metadata
    : {};

  return {
    subscribed: appMetadata.is_active === true || appMetadata.subscription_status === "active",
    plan: typeof appMetadata.plan === "string" ? appMetadata.plan : null,
    subscriptionId: typeof appMetadata.subscription_id === "string" ? appMetadata.subscription_id : null,
    subscriptionEnd: typeof appMetadata.subscription_end === "string" ? appMetadata.subscription_end : null,
    customerId: typeof appMetadata.stripe_customer_id === "string" ? appMetadata.stripe_customer_id : null,
  };
};

const syncSnapshot = async (
  supabaseClient: ReturnType<typeof createClient>,
  user: any,
  snapshot: SubscriptionSnapshot,
) => {
  const nextAppMetadata = {
    ...(user.app_metadata ?? {}),
    subscription_status: snapshot.subscribed ? "active" : "inactive",
    is_active: snapshot.subscribed,
    stripe_customer_id: snapshot.customerId,
    subscription_id: snapshot.subscriptionId,
    plan: snapshot.plan,
    subscription_end: snapshot.subscriptionEnd,
  };

  const hasChanged =
    nextAppMetadata.subscription_status !== user.app_metadata?.subscription_status ||
    nextAppMetadata.is_active !== user.app_metadata?.is_active ||
    nextAppMetadata.stripe_customer_id !== user.app_metadata?.stripe_customer_id ||
    nextAppMetadata.subscription_id !== user.app_metadata?.subscription_id ||
    nextAppMetadata.plan !== user.app_metadata?.plan ||
    nextAppMetadata.subscription_end !== user.app_metadata?.subscription_end;

  if (!hasChanged) return;

  const { error } = await supabaseClient.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata,
  });

  if (error) {
    logStep("Failed to sync auth metadata", { userId: user.id, error: error.message });
    return;
  }

  logStep("Auth metadata synced", {
    userId: user.id,
    subscribed: snapshot.subscribed,
    plan: snapshot.plan,
    customerId: snapshot.customerId,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // ── Check user_entitlements table FIRST ──
    // If user has "unlimited" access (admin invite / magic link), grant immediate access
    const { data: entitlements } = await supabaseClient
      .from("user_entitlements")
      .select("access_type, source")
      .eq("user_id", user.id)
      .eq("access_type", "unlimited")
      .limit(1);

    if (entitlements && entitlements.length > 0) {
      logStep("User has unlimited entitlement, granting access", {
        userId: user.id,
        source: entitlements[0].source,
      });

      const snapshot: SubscriptionSnapshot = {
        subscribed: true,
        plan: "unlimited",
        subscriptionId: null,
        subscriptionEnd: null,
        customerId: null,
      };

      // Sync to app_metadata so fallback also works
      await syncSnapshot(supabaseClient, user, snapshot);

      return new Response(JSON.stringify(buildResponseBody(snapshot)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No unlimited entitlement found, checking Stripe");

    // ── Existing Stripe logic ──
    const storedSnapshot = getStoredSnapshot(user);
    logStep("Stored access metadata loaded", {
      userId: user.id,
      subscribed: storedSnapshot.subscribed,
      plan: storedSnapshot.plan,
      customerId: storedSnapshot.customerId,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { data: localBinding } = await supabaseClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    let customerId = localBinding?.stripe_customer_id ?? storedSnapshot.customerId;

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    }

    if (!customerId) {
      logStep("No Stripe customer found; stored metadata cannot grant access", { userId: user.id });
      const snapshot = inactiveSubscriptionSnapshot(null);
      await syncSnapshot(supabaseClient, user, snapshot);
      return new Response(JSON.stringify(buildResponseBody(snapshot)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find((subscription) => grantsAccess(subscription.status));

    if (activeSubscription) {
      let subscriptionEnd: string | null = null;
      let trialEnd: string | null = null;
      try {
        const itemPeriodEnd = activeSubscription.items?.data?.[0]?.current_period_end;
        if (typeof activeSubscription.trial_end === "number" && activeSubscription.trial_end > 0) {
          trialEnd = new Date(activeSubscription.trial_end * 1000).toISOString();
        }
        const endTs = activeSubscription.status === "trialing"
          ? (activeSubscription.trial_end ?? activeSubscription.current_period_end ?? itemPeriodEnd)
          : (activeSubscription.current_period_end ?? itemPeriodEnd);
        if (typeof endTs === "number" && endTs > 0) {
          subscriptionEnd = new Date(endTs * 1000).toISOString();
        }
      } catch {
        logStep("Failed to parse current_period_end", { value: activeSubscription.current_period_end });
      }

      const snapshot: SubscriptionSnapshot = {
        subscribed: true,
        plan: PRICE_TO_PLAN[activeSubscription.items.data[0]?.price.id] || storedSnapshot.plan || "unknown",
        subscriptionId: activeSubscription.id,
        subscriptionEnd,
        customerId,
        status: activeSubscription.status,
        trialEnd,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end === true || activeSubscription.cancel_at !== null,
      };

      logStep("Active subscription found", {
        subscriptionId: snapshot.subscriptionId,
        plan: snapshot.plan,
        status: snapshot.status,
        endDate: snapshot.subscriptionEnd,
      });

      await syncSnapshot(supabaseClient, user, snapshot);
      await syncSubscription(stripe, supabaseClient, activeSubscription.id).catch((err) =>
        logStep("Local subscription mirror skipped", { message: err instanceof Error ? err.message : String(err) })
      );

      return new Response(JSON.stringify(buildResponseBody(snapshot)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active Stripe subscription found; stored metadata cannot grant access", {
      userId: user.id,
      customerId,
      previouslyMarkedActive: storedSnapshot.subscribed,
    });

    const snapshot = inactiveSubscriptionSnapshot(customerId);
    await syncSnapshot(supabaseClient, user, snapshot);

    return new Response(JSON.stringify(buildResponseBody(snapshot)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
