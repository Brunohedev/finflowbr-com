import { describe, expect, it } from "vitest";
import {
  PLAN_CATALOG,
  TRIAL_SECONDS,
  accessSnapshot,
  grantsAccess,
  inactiveSubscriptionSnapshot,
  type SubscriptionRow,
} from "../../supabase/functions/_shared/subscriptionState";

const row = (status: string): SubscriptionRow => ({
  user_id: "user",
  stripe_customer_id: "cus",
  stripe_subscription_id: `sub_${status}`,
  status,
  plan: "mensal",
  price_id: PLAN_CATALOG.mensal.priceId,
  trial_end: status === "trialing" ? "2026-11-30T12:00:00.000Z" : null,
  current_period_end: "2026-12-27T12:00:00.000Z",
  cancel_at_period_end: false,
  cancel_at: null,
});

describe("production subscription access", () => {
  it("keeps the trial at exactly 72 hours", () => {
    expect(TRIAL_SECONDS).toBe(259_200);
  });

  it.each(["active", "trialing"])("grants paid access for %s", (status) => {
    expect(grantsAccess(status)).toBe(true);
    expect(accessSnapshot([row(status)]).subscribed).toBe(true);
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused"])(
    "does not grant paid access for %s",
    (status) => {
      expect(grantsAccess(status)).toBe(false);
      expect(accessSnapshot([row(status)]).subscribed).toBe(false);
    },
  );

  it("ignores stale active metadata when Stripe has no active subscription", () => {
    const snapshot = inactiveSubscriptionSnapshot("cus_cancelled");
    expect(snapshot).toEqual({
      subscribed: false,
      plan: null,
      subscriptionId: null,
      subscriptionEnd: null,
      customerId: "cus_cancelled",
    });
  });

  it("uses the existing production price IDs without changing plans", () => {
    expect(PLAN_CATALOG).toEqual({
      mensal: { priceId: "price_1TFJCqETsKMFlYgf17AWyncm" },
      semestral: { priceId: "price_1TFJDUETsKMFlYgfTeuJbIcE" },
      anual: { priceId: "price_1TFJFDETsKMFlYgftrXoLKEq" },
    });
  });
});
