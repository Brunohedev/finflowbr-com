import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  normalizeEmail,
  toSubscriptionRow,
  type SubscriptionRow,
} from "./subscriptionState.ts";

export function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
    throw new Error("Stripe Live is not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Billing service is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Existing direct bindings win; email is only a lookup aid for the user's own tagged customer. */
export async function findOrCreateCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  user: { id: string; email: string },
): Promise<string> {
  const { data: binding, error: bindingError } = await admin.from("subscriptions")
    .select("stripe_customer_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (bindingError) throw bindingError;
  if (binding?.stripe_customer_id) return binding.stripe_customer_id;

  const { data: candidates } = await stripe.customers.list({
    email: user.email,
    limit: 100,
  });
  const ownCustomer = candidates.find((customer) => customer.metadata?.supabase_user_id === user.id);
  if (ownCustomer) return ownCustomer.id;

  const created = await stripe.customers.create({
    email: user.email,
    metadata: { supabase_user_id: user.id },
  });
  return created.id;
}

/** Marks the trial as used without ever reopening consumed history. */
export async function consumeTrialReservation(
  admin: SupabaseClient,
  userId: string,
  subscriptionId: string,
  customerId: string,
): Promise<void> {
  const { data: updated, error } = await admin.from("trial_reservations")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    })
    .eq("user_id", userId)
    .neq("status", "consumed")
    .select("id");
  if (error) throw error;
  if (updated && updated.length > 0) return;

  const { data: existing, error: existingError } = await admin.from("trial_reservations")
    .select("id").eq("user_id", userId).limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) return;

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError) throw userError;
  const email = userData?.user?.email;
  if (!email) throw new Error("User email is required to consume a trial");

  const { error: insertError } = await admin.from("trial_reservations").insert({
    email_normalized: normalizeEmail(email),
    user_id: userId,
    status: "consumed",
    consumed_at: new Date().toISOString(),
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
  });
  if (insertError && insertError.code !== "23505") throw insertError;
}

/**
 * Stores the subscription re-read from Stripe. A retrieval timestamp and a
 * generation check prevent a slower, older read from replacing newer state.
 */
export async function syncSubscription(
  stripe: Stripe,
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<SubscriptionRow | null> {
  const retrievedAt = new Date().toISOString();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const { data: existing, error: existingError } = await admin.from("subscriptions")
    .select("user_id,sync_generation,synced_at")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (existingError) throw existingError;

  let userId: string | undefined = existing?.user_id ?? subscription.metadata?.supabase_user_id;
  if (!userId) {
    const { data: customerBinding, error: customerBindingError } = await admin.from("subscriptions")
      .select("user_id").eq("stripe_customer_id", customerId).limit(1).maybeSingle();
    if (customerBindingError) throw customerBindingError;
    userId = customerBinding?.user_id;
  }
  if (!userId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) userId = customer.metadata?.supabase_user_id;
  }
  if (!userId) return null;

  const row = toSubscriptionRow(subscription, userId);
  if (existing) {
    const { data: updated, error: updateError } = await admin.from("subscriptions")
      .update({
        ...row,
        synced_at: retrievedAt,
        sync_generation: existing.sync_generation + 1,
      })
      .eq("stripe_subscription_id", subscriptionId)
      .eq("user_id", existing.user_id)
      .eq("sync_generation", existing.sync_generation)
      .lt("synced_at", retrievedAt)
      .select("stripe_subscription_id");
    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      const { data: current, error: currentError } = await admin.from("subscriptions")
        .select("user_id,stripe_customer_id,stripe_subscription_id,status,plan,price_id,trial_end,current_period_end,cancel_at_period_end,cancel_at")
        .eq("stripe_subscription_id", subscriptionId)
        .single();
      if (currentError) throw currentError;
      return current as SubscriptionRow;
    }
  } else {
    const { error: insertError } = await admin.from("subscriptions").insert({
      ...row,
      synced_at: retrievedAt,
    });
    if (insertError) {
      if (insertError.code !== "23505") throw insertError;
      const { data: current, error: currentError } = await admin.from("subscriptions")
        .select("user_id,stripe_customer_id,stripe_subscription_id,status,plan,price_id,trial_end,current_period_end,cancel_at_period_end,cancel_at")
        .eq("stripe_subscription_id", subscriptionId)
        .single();
      if (currentError) throw currentError;
      return current as SubscriptionRow;
    }
  }

  if (subscription.trial_start) {
    await consumeTrialReservation(admin, userId, subscription.id, customerId);
  }
  return row;
}
