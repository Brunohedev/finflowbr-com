import { describe, expect, it, vi } from "vitest";
import {
  BillingDisabledError,
  getBillingCapabilities,
  runWithBillingCapability,
} from "../../supabase/functions/_shared/billingRollout";

describe("disabled billing preparation", () => {
  it("keeps every new capability disabled by default", () => {
    expect(getBillingCapabilities({})).toEqual({
      checkoutV2: false,
      checkoutConfirmation: false,
      accountDeletionWithCancellation: false,
    });
  });

  it("does not execute a disabled operation", () => {
    const operation = vi.fn();
    expect(() => runWithBillingCapability(false, "CHECKOUT_V2_DISABLED", operation))
      .toThrow(BillingDisabledError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("requires both independent deletion flags before cancellation is reachable", () => {
    expect(getBillingCapabilities({ BILLING_DELETE_ACCOUNT_V2_ENABLED: "true" })
      .accountDeletionWithCancellation).toBe(false);
    expect(getBillingCapabilities({ BILLING_STRIPE_CANCELLATION_ON_DELETE_ENABLED: "true" })
      .accountDeletionWithCancellation).toBe(false);
    expect(getBillingCapabilities({
      BILLING_DELETE_ACCOUNT_V2_ENABLED: "true",
      BILLING_STRIPE_CANCELLATION_ON_DELETE_ENABLED: "true",
    }).accountDeletionWithCancellation).toBe(true);
  });

  it("does not enable confirmation before the new checkout", () => {
    expect(getBillingCapabilities({ BILLING_CHECKOUT_CONFIRMATION_ENABLED: "true" }))
      .toEqual({ checkoutV2: false, checkoutConfirmation: false, accountDeletionWithCancellation: false });
  });
});
