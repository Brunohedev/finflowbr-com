export const SUPPORTED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type WebhookIdentifiers = {
  eventId: string;
  type: string;
  eventCreatedIso: string;
  customerId: string | null;
  subscriptionId: string | null;
  sessionId: string | null;
  ownerUserId: string | null;
  customerEmail: string | null;
  plan: string | null;
};

const asId = (value: unknown): string | null => {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
};

// deno-lint-ignore no-explicit-any
export function extractWebhookIdentifiers(event: any): WebhookIdentifiers {
  const obj = event?.data?.object ?? {};
  const type = String(event?.type ?? "");
  const createdSec = typeof event?.created === "number" && event.created > 0
    ? event.created
    : Math.floor(Date.now() / 1000);

  let customerId = asId(obj.customer);
  let subscriptionId: string | null = null;
  let sessionId: string | null = null;
  let ownerUserId: string | null = null;
  let customerEmail: string | null = null;
  let plan: string | null = null;

  if (type.startsWith("checkout.session.")) {
    sessionId = asId(obj.id);
    subscriptionId = asId(obj.subscription);
    ownerUserId = typeof obj.client_reference_id === "string" && obj.client_reference_id
      ? obj.client_reference_id
      : typeof obj.metadata?.supabase_user_id === "string" && obj.metadata.supabase_user_id
      ? obj.metadata.supabase_user_id
      : null;
    customerEmail = obj.customer_details?.email ?? obj.customer_email ?? null;
    plan = typeof obj.metadata?.plan === "string" ? obj.metadata.plan : null;
  } else if (type.startsWith("customer.subscription.")) {
    subscriptionId = asId(obj.id);
    ownerUserId = typeof obj.metadata?.supabase_user_id === "string" ? obj.metadata.supabase_user_id : null;
  } else if (type.startsWith("invoice.")) {
    subscriptionId = asId(obj.subscription) ??
      asId(obj.parent?.subscription_details?.subscription) ??
      asId(obj.lines?.data?.[0]?.subscription);
  }

  if (!customerId && typeof obj.customer === "string") customerId = obj.customer;

  return {
    eventId: String(event?.id ?? ""),
    type,
    eventCreatedIso: new Date(createdSec * 1000).toISOString(),
    customerId,
    subscriptionId,
    sessionId,
    ownerUserId,
    customerEmail,
    plan,
  };
}

export type WebhookDependencies = {
  claim: (ids: WebhookIdentifiers, owner: string) => Promise<number | null>;
  isProcessed: (eventId: string) => Promise<boolean>;
  complete: (eventId: string, owner: string, token: number) => Promise<boolean>;
  release: (eventId: string, owner: string, token: number, errorCode: string, retrySeconds: number) => Promise<boolean>;
  releaseExpiredSession: (sessionId: string) => Promise<void>;
  provisionLegacyGuest: (ids: WebhookIdentifiers) => Promise<string | null>;
  syncSubscription: (subscriptionId: string) => Promise<{ userId: string } | null>;
  generateOwnerId?: () => string;
};

export type WebhookOutcome = {
  status: number;
  body: Record<string, unknown>;
};

const sanitizeErrorCode = (code: string) =>
  code.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64) || "processing_error";

export async function processStripeWebhookEvent(
  // deno-lint-ignore no-explicit-any
  event: any,
  deps: WebhookDependencies,
): Promise<WebhookOutcome> {
  const ids = extractWebhookIdentifiers(event);
  const owner = deps.generateOwnerId ? deps.generateOwnerId() : crypto.randomUUID();

  const token = await deps.claim(ids, owner);
  if (token === null) {
    const alreadyDone = await deps.isProcessed(ids.eventId);
    if (alreadyDone) return { status: 200, body: { received: true, duplicate: true } };
    return { status: 503, body: { error: "Event currently leased or scheduled for retry", retry: true } };
  }

  try {
    if (ids.type === "checkout.session.expired") {
      if (ids.sessionId) await deps.releaseExpiredSession(ids.sessionId);
    } else if (ids.type === "checkout.session.completed") {
      if (!ids.ownerUserId && ids.customerEmail) {
        await deps.provisionLegacyGuest(ids);
      }
      if (ids.subscriptionId) {
        await deps.syncSubscription(ids.subscriptionId);
      }
    } else if (ids.type.startsWith("customer.subscription.") || ids.type.startsWith("invoice.")) {
      if (ids.subscriptionId) {
        const synced = await deps.syncSubscription(ids.subscriptionId);
        if (!synced && ids.type === "customer.subscription.created") {
          const ageMs = Date.now() - new Date(ids.eventCreatedIso).getTime();
          if (ageMs < 5 * 60 * 1000) {
            await deps.release(ids.eventId, owner, token, "unmapped_retry", 30);
            return { status: 503, body: { error: "Subscription binding pending", retry: true } };
          }
        }
      }
    }

    await deps.complete(ids.eventId, owner, token);
    return { status: 200, body: { received: true } };
  } catch (error) {
    const code = sanitizeErrorCode(error instanceof Error ? error.name : "processing_error");
    await deps.release(ids.eventId, owner, token, code, 30).catch(() => false);
    return { status: 500, body: { error: "Webhook processing failed", code } };
  }
}