// Default-deny rollout controls. No billing operation is enabled unless its
// explicit server-side flag is exactly "true".

export type BillingEnvironment = Record<string, string | undefined>;

export type BillingCapabilities = {
  checkoutV2: boolean;
  checkoutConfirmation: boolean;
  accountDeletionWithCancellation: boolean;
};

const enabled = (value: string | undefined) => value === "true";

export function getBillingCapabilities(env: BillingEnvironment): BillingCapabilities {
  const checkoutV2 = enabled(env.BILLING_CHECKOUT_V2_ENABLED);
  const checkoutConfirmation = checkoutV2 && enabled(env.BILLING_CHECKOUT_CONFIRMATION_ENABLED);
  const deletionEnabled = enabled(env.BILLING_DELETE_ACCOUNT_V2_ENABLED);
  const cancellationEnabled = enabled(env.BILLING_STRIPE_CANCELLATION_ON_DELETE_ENABLED);

  return {
    checkoutV2,
    checkoutConfirmation,
    accountDeletionWithCancellation: deletionEnabled && cancellationEnabled,
  };
}

export class BillingDisabledError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BillingDisabledError";
  }
}

/** The operation is not even invoked while its capability is disabled. */
export function runWithBillingCapability<T>(isEnabled: boolean, code: string, operation: () => T): T {
  if (!isEnabled) throw new BillingDisabledError(code);
  return operation();
}
