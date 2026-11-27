export const DELETION_CONSENT_VERSION = "2026-11-27.stripe-cancellation.v1";
export const DELETION_CONFIRMATION = "DELETE";

export function hasValidDeletionConsent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return body.confirmation === DELETION_CONFIRMATION &&
    body.consent_version === DELETION_CONSENT_VERSION &&
    body.cancel_subscriptions === true;
}

/** Cancellation is an all-or-nothing gate before any bank or account deletion. */
export async function cancelThenDelete(
  cancelSubscriptions: () => Promise<void>,
  deleteAccount: () => Promise<void>,
): Promise<void> {
  await cancelSubscriptions();
  await deleteAccount();
}
