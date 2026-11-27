import { describe, expect, it, vi } from "vitest";
import {
  DELETION_CONSENT_VERSION,
  cancelThenDelete,
  hasValidDeletionConsent,
} from "../../supabase/functions/delete-account-v2/orchestration";

describe("consented billing-aware deletion", () => {
  it("requires DELETE, the exact consent version and explicit cancellation consent", () => {
    expect(hasValidDeletionConsent({
      confirmation: "DELETE",
      consent_version: DELETION_CONSENT_VERSION,
      cancel_subscriptions: true,
    })).toBe(true);
    expect(hasValidDeletionConsent({
      confirmation: "DELETE",
      consent_version: "old-screen",
      cancel_subscriptions: true,
    })).toBe(false);
    expect(hasValidDeletionConsent({
      confirmation: "DELETE",
      consent_version: DELETION_CONSENT_VERSION,
      cancel_subscriptions: false,
    })).toBe(false);
  });

  it("cancels billing before invoking bank and account deletion", async () => {
    const calls: string[] = [];
    await cancelThenDelete(
      async () => { calls.push("cancel"); },
      async () => { calls.push("delete"); },
    );
    expect(calls).toEqual(["cancel", "delete"]);
  });

  it("does not start bank or account deletion after a cancellation failure", async () => {
    const deletion = vi.fn();
    await expect(cancelThenDelete(async () => { throw new Error("cancel failed"); }, deletion)).rejects.toThrow();
    expect(deletion).not.toHaveBeenCalled();
  });
});
