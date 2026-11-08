import { describe, expect, it, vi } from "vitest";
import { deleteOwnedAccount, DeletionError, productionPlaid, type Connection } from "../../supabase/functions/delete-account/deletion";

const setup = (connections: Connection[] = []) => {
  const store = {
    connections: vi.fn().mockResolvedValue(connections),
    shared: vi.fn().mockResolvedValue(false),
    cleanNonCascading: vi.fn().mockResolvedValue(undefined),
    deleteIdentity: vi.fn().mockResolvedValue(undefined),
  };
  const plaid = { resolveItem: vi.fn().mockResolvedValue("resolved-item"), remove: vi.fn().mockResolvedValue(undefined) };
  return { store, plaid };
};

describe("account deletion orchestration", () => {
  it("revokes every distinct Item before cleanup and deletes auth last", async () => {
    const { store, plaid } = setup([{ access_token: "a", item_id: "one" }, { access_token: "b", item_id: "two" }, { access_token: "a", item_id: "one" }]);
    await deleteOwnedAccount("owner", store, plaid);
    expect(plaid.remove.mock.calls).toEqual([["a"], ["b"]]);
    expect(store.shared.mock.calls).toEqual([["owner", "a", "one"], ["owner", "b", "two"], ["owner", "a", "one"]]);
    expect(store.cleanNonCascading).toHaveBeenCalledWith("owner");
    expect(store.deleteIdentity).toHaveBeenCalledWith("owner");
    expect(plaid.remove.mock.invocationCallOrder[1]).toBeLessThan(store.cleanNonCascading.mock.invocationCallOrder[0]);
    expect(store.cleanNonCascading.mock.invocationCallOrder[0]).toBeLessThan(store.deleteIdentity.mock.invocationCallOrder[0]);
  });
  it("retains account and local credentials when a second revocation fails", async () => {
    const { store, plaid } = setup([{ access_token: "a", item_id: "one" }, { access_token: "b", item_id: "two" }]);
    plaid.remove.mockRejectedValueOnce(new DeletionError("BANK_REVOCATION_FAILED"));
    await expect(deleteOwnedAccount("owner", store, plaid)).rejects.toThrow("BANK_REVOCATION_FAILED");
    expect(store.cleanNonCascading).not.toHaveBeenCalled();
    expect(store.deleteIdentity).not.toHaveBeenCalled();
  });
  it("does not revoke any Item if a shared connection is found", async () => {
    const { store, plaid } = setup([{ access_token: "a", item_id: "one" }, { access_token: "b", item_id: "two" }]);
    store.shared.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(deleteOwnedAccount("owner", store, plaid)).rejects.toThrow("SHARED_BANK_CONNECTION");
    expect(plaid.remove).not.toHaveBeenCalled();
    expect(store.deleteIdentity).not.toHaveBeenCalled();
  });
  it("resolves legacy missing Item IDs before revocation", async () => {
    const { store, plaid } = setup([{ access_token: "a", item_id: null }]);
    await deleteOwnedAccount("owner", store, plaid);
    expect(plaid.resolveItem).toHaveBeenCalledWith("a");
    expect(store.shared).toHaveBeenCalledWith("owner", "a", "resolved-item");
    expect(plaid.remove).toHaveBeenCalledWith("a");
  });
  it("blocks identity deletion after non-cascading cleanup failure", async () => {
    const { store, plaid } = setup();
    store.cleanNonCascading.mockRejectedValue(new DeletionError("DATA_CLEANUP_FAILED"));
    await expect(deleteOwnedAccount("owner", store, plaid)).rejects.toThrow("DATA_CLEANUP_FAILED");
    expect(store.deleteIdentity).not.toHaveBeenCalled();
  });
  it("never reports success when auth deletion fails", async () => {
    const { store, plaid } = setup();
    store.deleteIdentity.mockRejectedValue(new DeletionError("AUTH_DELETE_FAILED"));
    await expect(deleteOwnedAccount("owner", store, plaid)).rejects.toThrow("AUTH_DELETE_FAILED");
  });
  it("blocks all changes if loading connections fails", async () => {
    const { store, plaid } = setup();
    store.connections.mockRejectedValue(new DeletionError("BANK_READ_FAILED"));
    await expect(deleteOwnedAccount("owner", store, plaid)).rejects.toThrow("BANK_READ_FAILED");
    expect(plaid.remove).not.toHaveBeenCalled();
    expect(store.cleanNonCascading).not.toHaveBeenCalled();
  });
});

describe("production Plaid deletion", () => {
  it("calls production /item/remove server-side", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: "request" }), { status: 200 }));
    await productionPlaid("client", "secret", request).remove("token");
    expect(request.mock.calls[0][0]).toBe("https://production.plaid.com/item/remove");
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ client_id: "client", secret: "secret", access_token: "token" });
  });
  it("permits a retry when an Item was already removed", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_code: "ITEM_NOT_FOUND" }), { status: 400 }));
    await expect(productionPlaid("client", "secret", request).remove("token")).resolves.toBeUndefined();
  });
  it.each(["INVALID_ACCESS_TOKEN", "INTERNAL_SERVER_ERROR"])("does not treat %s as success or expose upstream credentials", async code => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_code: code, error_message: "token-secret" }), { status: 400 }));
    await expect(productionPlaid("client", "secret", request).remove("token-secret")).rejects.toThrow(/^BANK_REVOCATION_FAILED$/);
  });
  it("rejects malformed success and missing credentials", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(productionPlaid("client", "secret", request).remove("a")).rejects.toThrow("BANK_REVOCATION_FAILED");
    await expect(productionPlaid(undefined, undefined, request).remove("a")).rejects.toThrow("BANK_REVOCATION_FAILED");
    expect(request).toHaveBeenCalledTimes(1);
  });
});