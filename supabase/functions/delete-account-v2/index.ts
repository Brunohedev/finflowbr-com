import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdminClient, getStripe } from "../_shared/stripeProduction.ts";
import { BillingDisabledError, getBillingCapabilities, runWithBillingCapability } from "../_shared/billingRollout.ts";
import { cancelBoundSubscriptions, SubscriptionCancellationError, type CancelableSubscription } from "../_shared/subscriptionCancellation.ts";
import { deleteOwnedAccount, DeletionError, productionPlaid } from "./deletion.ts";
import {
  DELETION_CONFIRMATION,
  DELETION_CONSENT_VERSION,
  cancelThenDelete,
  hasValidDeletionConsent,
} from "./orchestration.ts";

const Body = z.object({
  confirmation: z.literal(DELETION_CONFIRMATION),
  consent_version: z.literal(DELETION_CONSENT_VERSION),
  cancel_subscriptions: z.literal(true),
});
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function deleteWithCancellation(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody: unknown = await req.json().catch(() => null);
  const parsed = Body.safeParse(rawBody);
  if (!parsed.success || !hasValidDeletionConsent(rawBody)) {
    return json({ error: "Explicit cancellation consent is required", code: "CONSENT_REQUIRED" }, 400);
  }

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  const admin = getAdminClient();
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

  const { data: bindings, error: bindingsError } = await admin.from("subscriptions")
    .select("stripe_customer_id,stripe_subscription_id").eq("user_id", user.id);
  if (bindingsError) throw bindingsError;

  const customerIds = new Set<string>();
  const subscriptionIds = new Set<string>();
  for (const binding of bindings ?? []) {
    customerIds.add(binding.stripe_customer_id);
    subscriptionIds.add(binding.stripe_subscription_id);
  }
  // Legacy identifiers are accepted only as direct user-owned bindings, never through email.
  const metadataCustomer = user.app_metadata?.stripe_customer_id;
  const metadataSubscription = user.app_metadata?.subscription_id;
  if (typeof metadataCustomer === "string") customerIds.add(metadataCustomer);
  if (typeof metadataSubscription === "string") subscriptionIds.add(metadataSubscription);

  await cancelThenDelete(async () => {
    if (customerIds.size === 0 && subscriptionIds.size === 0) return;
    const stripe = getStripe();
    const list = async (customerId: string): Promise<CancelableSubscription[]> => {
      const all: CancelableSubscription[] = [];
      let startingAfter: string | undefined;
      do {
        const page = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        all.push(...page.data);
        startingAfter = page.data.at(-1)?.id;
        if (!page.has_more) break;
      } while (startingAfter);
      return all;
    };
    await cancelBoundSubscriptions([...customerIds], [...subscriptionIds], {
      list,
      retrieve: async (subscriptionId) => await stripe.subscriptions.retrieve(subscriptionId),
      cancel: async (subscriptionId) => {
        await stripe.subscriptions.cancel(subscriptionId, {}, {
          idempotencyKey: `delete-account-v2:${user.id}:${subscriptionId}`,
        });
      },
    });
  }, async () => {
    await deleteOwnedAccount(user.id, {
      async connections(userId) {
        const { data, error } = await admin.from("plaid_connections").select("access_token,item_id").eq("user_id", userId);
        if (error || !data) throw new DeletionError("BANK_READ_FAILED");
        return data;
      },
      async shared(userId, accessToken, itemId) {
        const tokenResult = await admin.from("plaid_connections").select("user_id")
          .eq("access_token", accessToken).neq("user_id", userId).limit(1);
        if (tokenResult.error) throw new DeletionError("BANK_READ_FAILED");
        if (tokenResult.data?.length) return true;
        if (!itemId) return false;
        const itemResult = await admin.from("plaid_connections").select("user_id")
          .eq("item_id", itemId).neq("user_id", userId).limit(1);
        if (itemResult.error) throw new DeletionError("BANK_READ_FAILED");
        return Boolean(itemResult.data?.length);
      },
      async cleanNonCascading(userId) {
        for (const table of ["budgets", "pluggy_connections"]) {
          const { error } = await admin.from(table).delete().eq("user_id", userId);
          if (error) throw new DeletionError("DATA_CLEANUP_FAILED");
          const remaining = await admin.from(table).select("user_id").eq("user_id", userId).limit(1);
          if (remaining.error || !remaining.data || remaining.data.length) throw new DeletionError("DATA_CLEANUP_FAILED");
        }
      },
      async deleteIdentity(userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw new DeletionError("AUTH_DELETE_FAILED");
      },
    }, productionPlaid(Deno.env.get("PLAID_CLIENT_ID"), Deno.env.get("PLAID_SECRET")));
  });

  return json({ success: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const capabilities = getBillingCapabilities(Deno.env.toObject());
    return await runWithBillingCapability(
      capabilities.accountDeletionWithCancellation,
      "DELETE_ACCOUNT_V2_DISABLED",
      () => deleteWithCancellation(req),
    );
  } catch (error) {
    if (error instanceof BillingDisabledError) {
      return json({ error: "This deletion flow is not available", code: error.code }, 503);
    }
    if (error instanceof SubscriptionCancellationError) {
      return json({ error: "Billing cancellation was not confirmed. Account deletion was not started.", code: error.message }, 503);
    }
    const code = error instanceof DeletionError ? error.code : "SERVICE_UNAVAILABLE";
    console.warn("Billing-aware account deletion incomplete", { code });
    return json({
      error: "Account deletion was not completed. Some bank connections or data may already have been removed. Retry or contact support.",
      code,
    }, 503);
  }
});
