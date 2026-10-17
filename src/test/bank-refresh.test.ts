import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { refreshBankTransactions } from "@/lib/bankRefresh";
import { useBankForegroundRefresh } from "@/hooks/useBankForegroundRefresh";

describe("bank refresh", () => {
  beforeEach(() => { invoke.mockReset(); invoke.mockResolvedValue({ data: { ok: true }, error: null }); });

  it("refreshes when the app opens, without requiring the bank page", async () => {
    const { unmount } = renderHook(() => useBankForegroundRefresh("u1"));
    await act(async () => {});
    expect(invoke).toHaveBeenCalledWith("plaid-refresh", { body: {} });
    unmount();
  });

  it("refreshes again after returning from a purchase, without a one-minute blocked window", async () => {
    const { unmount } = renderHook(() => useBankForegroundRefresh("u2"));
    await act(async () => {});
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(invoke).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("shares concurrent requests and signals the bank list after ingestion", async () => {
    let complete: ((value: unknown) => void) | undefined;
    invoke.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const notified = vi.fn();
    window.addEventListener("bank-transactions-refreshed", notified);
    const first = refreshBankTransactions("u3");
    const second = refreshBankTransactions("u3");
    expect(first).toBe(second);
    expect(invoke).toHaveBeenCalledTimes(1);
    complete?.({ data: { ok: true }, error: null });
    await first;
    expect(notified).toHaveBeenCalledOnce();
    window.removeEventListener("bank-transactions-refreshed", notified);
  });

  it("does not claim success when a bank sync fails, and permits retry", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(refreshBankTransactions("u4")).rejects.toThrow();
    await refreshBankTransactions("u4");
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});