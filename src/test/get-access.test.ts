import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

const invoke = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

import { getAccess } from "@/lib/getAccess";
const user = { id: "u1", email: "a@b.com" } as User;

describe("access after payment", () => {
  beforeEach(() => { invoke.mockReset(); maybeSingle.mockReset().mockResolvedValue({ data: null }); });

  it("preserves an administrative grant without calling Stripe", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { email: user.email } });
    expect(await getAccess(user)).toBe("unlimited");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preserves a manual unlimited entitlement without calling Stripe", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: { access_type: "unlimited" } });
    expect(await getAccess(user)).toBe("unlimited");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("unlocks the app when Stripe confirms an active subscription", async () => {
    invoke.mockResolvedValue({ data: { subscribed: true }, error: null });
    expect(await getAccess(user)).toBe("pro");
  });

  it("keeps the app locked without an active subscription", async () => {
    invoke.mockResolvedValue({ data: { subscribed: false }, error: null });
    expect(await getAccess(user)).toBe("none");
  });

  it("retries when the check fails right after checkout", async () => {
    vi.useFakeTimers();
    invoke.mockResolvedValueOnce({ data: null, error: new Error("x") })
      .mockResolvedValueOnce({ data: { subscribed: true }, error: null });
    const p = getAccess(user);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toBe("pro");
    vi.useRealTimers();
  });
});
