// Pure cancellation orchestration. Callers provide direct customer/subscription
// bindings; this module deliberately has no email-based lookup.

export type CancelableSubscription = {
  id: string;
  status: string;
  customer?: string | { id: string } | null;
};

export interface SubscriptionCancellationClient {
  list(customerId: string): Promise<CancelableSubscription[]>;
  cancel(subscriptionId: string): Promise<void>;
  retrieve(subscriptionId: string): Promise<CancelableSubscription>;
}

export class SubscriptionCancellationError extends Error {
  constructor() {
    super("STRIPE_CANCELLATION_FAILED");
    this.name = "SubscriptionCancellationError";
  }
}

const isFinal = (status: string) => status === "canceled" || status === "incomplete_expired";
const customerIdOf = (subscription: CancelableSubscription) =>
  typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

export async function cancelBoundSubscriptions(
  boundCustomerIds: string[],
  boundSubscriptionIds: string[],
  client: SubscriptionCancellationClient,
): Promise<string[]> {
  try {
    const customerIds = new Set(boundCustomerIds);
    const subscriptions = new Map<string, CancelableSubscription>();

    for (const subscriptionId of new Set(boundSubscriptionIds)) {
      const subscription = await client.retrieve(subscriptionId);
      subscriptions.set(subscription.id, subscription);
      const customerId = customerIdOf(subscription);
      if (customerId) customerIds.add(customerId);
    }

    for (const customerId of customerIds) {
      for (const subscription of await client.list(customerId)) {
        subscriptions.set(subscription.id, subscription);
      }
    }

    const canceled: string[] = [];
    for (const subscription of subscriptions.values()) {
      if (isFinal(subscription.status)) continue;
      await client.cancel(subscription.id);
      const confirmed = await client.retrieve(subscription.id);
      if (!isFinal(confirmed.status)) throw new SubscriptionCancellationError();
      canceled.push(subscription.id);
    }

    // Catch a subscription created or changed while the first pass was running.
    for (const customerId of customerIds) {
      const remaining = await client.list(customerId);
      if (remaining.some((subscription) => !isFinal(subscription.status))) {
        throw new SubscriptionCancellationError();
      }
    }
    return canceled;
  } catch (error) {
    if (error instanceof SubscriptionCancellationError) throw error;
    throw new SubscriptionCancellationError();
  }
}
