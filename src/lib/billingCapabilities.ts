import { supabase } from "@/integrations/supabase/client";

export type ClientBillingCapabilities = {
  checkoutV2: boolean;
  checkoutConfirmation: boolean;
  accountDeletionWithCancellation: boolean;
  trialSeconds: number;
};

export const DEFAULT_BILLING_CAPABILITIES: ClientBillingCapabilities = {
  checkoutV2: false,
  checkoutConfirmation: false,
  accountDeletionWithCancellation: false,
  trialSeconds: 3 * 24 * 60 * 60,
};

export const DELETION_CONSENT_VERSION = "2026-11-27.stripe-cancellation.v1";

export async function fetchBillingCapabilities(): Promise<ClientBillingCapabilities> {
  try {
    const { data, error } = await supabase.functions.invoke("billing-capabilities", { body: null });
    if (error || !data) return DEFAULT_BILLING_CAPABILITIES;
    return {
      checkoutV2: data.checkout_v2 === true,
      checkoutConfirmation: data.checkout_confirmation === true,
      accountDeletionWithCancellation: data.account_deletion_with_cancellation === true,
      trialSeconds: typeof data.trial_seconds === "number" && data.trial_seconds > 0
        ? data.trial_seconds
        : DEFAULT_BILLING_CAPABILITIES.trialSeconds,
    };
  } catch {
    return DEFAULT_BILLING_CAPABILITIES;
  }
}