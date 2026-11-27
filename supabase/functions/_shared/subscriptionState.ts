// Pure billing rules shared by production functions and local tests.
// This module intentionally has no Deno, Stripe or Supabase imports.

export const TRIAL_DAYS = 3;
export const TRIAL_SECONDS = TRIAL_DAYS * 24 * 60 * 60;

export type PlanId = "mensal" | "semestral" | "anual";

export const PLAN_CATALOG: Record<PlanId, { priceId: string }> = {
  mensal: { priceId: "price_1TFJCqETsKMFlYgf17AWyncm" },
  semestral: { priceId: "price_1TFJDUETsKMFlYgfTeuJbIcE" },
  anual: { priceId: "price_1TFJFDETsKMFlYgftrXoLKEq" },
};

export const PLAN_IDS = Object.keys(PLAN_CATALOG) as PlanId[];

export const PRICE_TO_PLAN: Record<string, PlanId> = Object.fromEntries(
  PLAN_IDS.map((plan) => [PLAN_CATALOG[plan].priceId, plan]),
) as Record<string, PlanId>;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as string[]).includes(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function grantsAccess(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function needsPaymentUpdate(status: string | null | undefined): boolean {
  return status === "past_due" || status === "unpaid" || status === "incomplete";
}

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  plan: string | null;
  price_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
};

const toIso = (seconds: unknown): string | null =>
  typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;

// deno-lint-ignore no-explicit-any
export function toSubscriptionRow(subscription: any, userId: string): SubscriptionRow {
  const item = subscription?.items?.data?.[0];
  const price = item?.price;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (typeof subscription.id !== "string" || typeof customerId !== "string" || typeof subscription.status !== "string") {
    throw new Error("Invalid Stripe subscription");
  }

  return {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: PRICE_TO_PLAN[price?.id] ?? (isPlanId(subscription.metadata?.plan) ? subscription.metadata.plan : null),
    price_id: typeof price?.id === "string" ? price.id : null,
    trial_end: toIso(subscription.trial_end),
    current_period_end: toIso(subscription.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end === true,
    cancel_at: toIso(subscription.cancel_at),
  };
}

const statusRank = (status: string) => grantsAccess(status) ? 3 : needsPaymentUpdate(status) ? 2 : 1;

export function pickCurrentSubscription<T extends Pick<SubscriptionRow, "status" | "current_period_end">>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) =>
    statusRank(b.status) - statusRank(a.status) ||
    (b.current_period_end ?? "").localeCompare(a.current_period_end ?? "")
  )[0];
}

export type AccessSnapshot = {
  subscribed: boolean;
  status: string | null;
  plan: string | null;
  subscription_id: string | null;
  subscription_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  needs_payment_update: boolean;
};

export function accessSnapshot(rows: SubscriptionRow[]): AccessSnapshot {
  const current = pickCurrentSubscription(rows);
  if (!current) {
    return {
      subscribed: false,
      status: null,
      plan: null,
      subscription_id: null,
      subscription_end: null,
      trial_end: null,
      cancel_at_period_end: false,
      needs_payment_update: false,
    };
  }

  return {
    subscribed: grantsAccess(current.status),
    status: current.status,
    plan: current.plan,
    subscription_id: current.stripe_subscription_id,
    subscription_end: current.status === "trialing" ? current.trial_end : current.current_period_end,
    trial_end: current.trial_end,
    cancel_at_period_end: current.cancel_at_period_end || current.cancel_at !== null,
    needs_payment_update: needsPaymentUpdate(current.status),
  };
}

/** Legacy metadata can supply identifiers, but never paid access without Stripe confirmation. */
export function inactiveSubscriptionSnapshot(customerId: string | null) {
  return {
    subscribed: false,
    plan: null,
    subscriptionId: null,
    subscriptionEnd: null,
    customerId,
  };
}
