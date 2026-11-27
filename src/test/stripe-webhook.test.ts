import { describe, expect, it, vi } from "vitest";
import {
  extractWebhookIdentifiers,
  processStripeWebhookEvent,
  type WebhookDependencies,
} from "../../supabase/functions/stripe-webhook/webhookHandler";

const makeDeps = (overrides: Partial<WebhookDependencies> = {}): WebhookDependencies => ({
  claim: vi.fn().mockResolvedValue(1),
  isProcessed: vi.fn().mockResolvedValue(false),
  complete: vi.fn().mockResolvedValue(true),
  release: vi.fn().mockResolvedValue(true),
  releaseExpiredSession: vi.fn().mockResolvedValue(undefined),
  provisionLegacyGuest: vi.fn().mockResolvedValue("legacy-user-1"),
  syncSubscription: vi.fn().mockResolvedValue({ userId: "user-1" }),
  generateOwnerId: () => "owner-uuid-1",
  ...overrides,
});

describe("stripe webhook reconciliation", () => {
  it("extracts invoice subscription from Basil parent.subscription_details", () => {
    const ids = extractWebhookIdentifiers({
      id: "evt_inv_1",
      type: "invoice.payment_failed",
      created: 1798000000,
      data: {
        object: {
          customer: "cus_123",
          parent: { subscription_details: { subscription: "sub_basil_1" } },
        },
      },
    });
    expect(ids.subscriptionId).toBe("sub_basil_1");
    expect(ids.customerId).toBe("cus_123");
  });

  it("returns 200 duplicate without side effects when already processed", async () => {
    const deps = makeDeps({
      claim: vi.fn().mockResolvedValue(null),
      isProcessed: vi.fn().mockResolvedValue(true),
    });
    const result = await processStripeWebhookEvent(
      { id: "evt_dup", type: "customer.subscription.updated", created: 1798000000, data: { object: { id: "sub_1", customer: "cus_1" } } },
      deps,
    );
    expect(result.status).toBe(200);
    expect(result.body.duplicate).toBe(true);
    expect(deps.syncSubscription).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("returns 503 retry when another worker currently holds the lease", async () => {
    const deps = makeDeps({
      claim: vi.fn().mockResolvedValue(null),
      isProcessed: vi.fn().mockResolvedValue(false),
    });
    const result = await processStripeWebhookEvent(
      { id: "evt_busy", type: "customer.subscription.updated", created: 1798000000, data: { object: { id: "sub_1", customer: "cus_1" } } },
      deps,
    );
    expect(result.status).toBe(503);
    expect(deps.syncSubscription).not.toHaveBeenCalled();
  });

  it("releases the lease and returns 500 on transient failure instead of marking complete", async () => {
    const deps = makeDeps({
      syncSubscription: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
    });
    const result = await processStripeWebhookEvent(
      { id: "evt_fail", type: "customer.subscription.updated", created: 1798000000, data: { object: { id: "sub_1", customer: "cus_1" } } },
      deps,
    );
    expect(result.status).toBe(500);
    expect(deps.release).toHaveBeenCalledWith("evt_fail", "owner-uuid-1", 1, "error", 30);
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("releases matching pending reservation on checkout.session.expired", async () => {
    const deps = makeDeps();
    const result = await processStripeWebhookEvent(
      { id: "evt_exp", type: "checkout.session.expired", created: 1798000000, data: { object: { id: "cs_exp_1", customer: "cus_1" } } },
      deps,
    );
    expect(result.status).toBe(200);
    expect(deps.releaseExpiredSession).toHaveBeenCalledWith("cs_exp_1");
    expect(deps.complete).toHaveBeenCalledWith("evt_exp", "owner-uuid-1", 1);
  });

  it("syncs authenticated checkout.session.completed without legacy guest provisioning", async () => {
    const deps = makeDeps();
    const result = await processStripeWebhookEvent(
      {
        id: "evt_v2",
        type: "checkout.session.completed",
        created: 1798000000,
        data: {
          object: {
            id: "cs_v2_1",
            client_reference_id: "user-1",
            customer: "cus_1",
            subscription: "sub_trial_1",
            customer_details: { email: "user@example.invalid" },
          },
        },
      },
      deps,
    );
    expect(result.status).toBe(200);
    expect(deps.provisionLegacyGuest).not.toHaveBeenCalled();
    expect(deps.syncSubscription).toHaveBeenCalledWith("sub_trial_1");
    expect(deps.complete).toHaveBeenCalledWith("evt_v2", "owner-uuid-1", 1);
  });

  it("preserves legacy guest checkout provisioning and reconciles subscription", async () => {
    const deps = makeDeps();
    const result = await processStripeWebhookEvent(
      {
        id: "evt_legacy",
        type: "checkout.session.completed",
        created: 1798000000,
        data: {
          object: {
            id: "cs_legacy_1",
            customer: "cus_legacy",
            subscription: "sub_legacy",
            customer_details: { email: "guest@example.invalid" },
            metadata: { plan: "mensal" },
          },
        },
      },
      deps,
    );
    expect(result.status).toBe(200);
    expect(deps.provisionLegacyGuest).toHaveBeenCalledTimes(1);
    expect(deps.syncSubscription).toHaveBeenCalledWith("sub_legacy");
    expect(deps.complete).toHaveBeenCalledWith("evt_legacy", "owner-uuid-1", 1);
  });

  it("retries recent unmapped customer.subscription.created instead of dropping it", async () => {
    const deps = makeDeps({ syncSubscription: vi.fn().mockResolvedValue(null) });
    const recentSec = Math.floor(Date.now() / 1000) - 5;
    const result = await processStripeWebhookEvent(
      { id: "evt_race", type: "customer.subscription.created", created: recentSec, data: { object: { id: "sub_race", customer: "cus_race" } } },
      deps,
    );
    expect(result.status).toBe(503);
    expect(deps.release).toHaveBeenCalledWith("evt_race", "owner-uuid-1", 1, "unmapped_retry", 30);
    expect(deps.complete).not.toHaveBeenCalled();
  });
});