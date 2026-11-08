export type Connection = { access_token: string; item_id: string | null };
export type DeletionCode = "BANK_READ_FAILED" | "BANK_REVOCATION_FAILED" | "SHARED_BANK_CONNECTION" | "DATA_CLEANUP_FAILED" | "AUTH_DELETE_FAILED";

export class DeletionError extends Error {
  constructor(public readonly code: DeletionCode) { super(code); }
}

export interface DeletionStore {
  connections(userId: string): Promise<Connection[]>;
  shared(userId: string, token: string, itemId: string | null): Promise<boolean>;
  cleanNonCascading(userId: string): Promise<void>;
  deleteIdentity(userId: string): Promise<void>;
}

export async function deleteOwnedAccount(userId: string, store: DeletionStore, plaid: {
  resolveItem(token: string): Promise<string | null>;
  remove(token: string): Promise<void>;
}) {
  const connections = await store.connections(userId);
  const items = new Map<string, string>();
  // Complete ownership checks before any irreversible provider operation.
  for (const connection of connections) {
    if (!connection.access_token) throw new DeletionError("BANK_REVOCATION_FAILED");
    const itemId = connection.item_id || await plaid.resolveItem(connection.access_token);
    if (await store.shared(userId, connection.access_token, itemId)) {
      throw new DeletionError("SHARED_BANK_CONNECTION");
    }
    // A null resolved Item is explicitly ITEM_NOT_FOUND, not an invalid token.
    if (itemId) items.set(itemId, connection.access_token);
  }
  for (const token of items.values()) await plaid.remove(token);
  await store.cleanNonCascading(userId);
  // Existing cascades/triggers remove the main data and credentials atomically
  // with auth deletion. Never delete credentials early or alter the schema.
  await store.deleteIdentity(userId);
}

export function productionPlaid(clientId: string | undefined, secret: string | undefined, request: typeof fetch = fetch) {
  const call = async (endpoint: "get" | "remove", token: string): Promise<Record<string, unknown> | null> => {
    if (!clientId || !secret) throw new DeletionError("BANK_REVOCATION_FAILED");
    try {
      const response = await request(`https://production.plaid.com/item/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, secret, access_token: token }),
        signal: AbortSignal.timeout(10_000),
      });
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new DeletionError("BANK_REVOCATION_FAILED");
      const payload = body as Record<string, unknown>;
      if (!response.ok) {
        if (payload.error_code === "ITEM_NOT_FOUND") return null;
        throw new DeletionError("BANK_REVOCATION_FAILED");
      }
      if (typeof payload.request_id !== "string" || payload.error_code) throw new DeletionError("BANK_REVOCATION_FAILED");
      return payload;
    } catch {
      // Never propagate raw provider/network messages containing credentials.
      throw new DeletionError("BANK_REVOCATION_FAILED");
    }
  };
  return {
    async resolveItem(token: string) {
      const payload = await call("get", token);
      if (!payload) return null;
      const item = payload.item;
      if (!item || typeof item !== "object" || !("item_id" in item) || typeof item.item_id !== "string" || !item.item_id) {
        throw new DeletionError("BANK_REVOCATION_FAILED");
      }
      return item.item_id;
    },
    async remove(token: string) { await call("remove", token); },
  };
}