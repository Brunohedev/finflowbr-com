import { describe, expect, it, vi } from "vitest";
import {
  cancelBoundSubscriptions,
  SubscriptionCancellationError,
  type CancelableSubscription,
} from "../../supabase/functions/_shared/subscriptionCancellation";

const subscription = (id: string, status: string, customer = "cus_one"): CancelableSubscription => ({ id, status, customer });

const clientWith = (rows: CancelableSubscription[]) => {
  const state = new Map(rows.map((row) => [row.id, row]));
  return {
    state,
    list: vi.fn(async () => [...state.values()]),
    retrieve: vi.fn(async (id: string) => {
      const row = state.get(id);
      if (!row) throw new Error("missing");
      return row;
    }),
    cancel: vi.fn(async (id: string) => {
      const row = state.get(id);
      if (row) state.set(id, { ...row, status: "canceled" });
    }),
  };
};

describe("subscription cancellation before account deletion", () => {
  it("cancels active and trialing subscriptions using direct customer bindings", async () => {
    const client = clientWith([subscription("sub_active", "active"), subscription("sub_trial", "trialing")]);
    await expect(cancelBoundSubscriptions(["cus_one"], [], client)).resolves.toEqual(["sub_active", "sub_trial"]);
    expect(client.cancel.mock.calls).toEqual([["sub_active"], ["sub_trial"]]);
    expect(client.list).toHaveBeenCalledWith("cus_one");
  });

  it("does not cancel an already canceled subscription again", async () => {
    const client = clientWith([subscription("sub_old", "canceled")]);
    await expect(cancelBoundSubscriptions(["cus_one"], [], client)).resolves.toEqual([]);
    expect(client.cancel).not.toHaveBeenCalled();
  });

  it("fails when Stripe does not confirm cancellation", async () => {
    const client = clientWith([subscription("sub_active", "active")]);
    client.cancel.mockImplementationOnce(async () => {});
    await expect(cancelBoundSubscriptions(["cus_one"], [], client)).rejects.toThrow(SubscriptionCancellationError);
  });

  it("fails closed when a subscription remains after the first cancellation pass", async () => {
    const client = clientWith([subscription("sub_active", "active")]);
    client.list.mockResolvedValueOnce([subscription("sub_active", "active")])
      .mockResolvedValueOnce([subscription("sub_new", "active")]);
    await expect(cancelBoundSubscriptions(["cus_one"], [], client)).rejects.toThrow(SubscriptionCancellationError);
  });

  it("resolves a direct subscription binding without using email", async () => {
    const client = clientWith([subscription("sub_direct", "active", "cus_direct")]);
    await cancelBoundSubscriptions([], ["sub_direct"], client);
    expect(client.retrieve).toHaveBeenCalledWith("sub_direct");
    expect(client.list).toHaveBeenCalledWith("cus_direct");
  });
});
