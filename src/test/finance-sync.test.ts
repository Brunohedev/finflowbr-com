import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { updateRows: [] as any[], remote: null as any };
const calls: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const builder = (op: string) => {
    const b: any = {
      _filters: [] as any[],
      eq(col: string, val: any) { this._filters.push([col, val]); return this; },
      select() {
        if (op === "update" || op === "insert") {
          calls.push({ op, filters: this._filters });
          return Promise.resolve({ data: op === "update" ? state.updateRows : [{ updated_at: "v1" }], error: null });
        }
        return this;
      },
      maybeSingle() { return Promise.resolve({ data: state.remote, error: null }); },
    };
    return b;
  };
  return {
    supabase: {
      from: () => ({
        update: () => builder("update"),
        insert: () => builder("insert"),
        select: () => builder("select"),
      }),
    },
  };
});

import { saveFinanceDataSafely } from "@/lib/financeSync";

describe("saveFinanceDataSafely", () => {
  beforeEach(() => { calls.length = 0; state.updateRows = []; state.remote = null; });

  it("only overwrites when the cloud still has the version we loaded", async () => {
    state.updateRows = [{ updated_at: "v2" }];
    const res = await saveFinanceDataSafely("u1", { expenses: [] }, "v1");
    expect(res).toEqual({ ok: true, updatedAt: "v2" });
    expect(calls[0].filters).toContainEqual(["updated_at", "v1"]);
  });

  it("reports a conflict instead of erasing newer data from another device", async () => {
    state.updateRows = [];
    state.remote = { data: { expenses: [{ id: "x" }] }, updated_at: "v3" };
    const res = await saveFinanceDataSafely("u1", { expenses: [] }, "v1");
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ conflict: true, remote: { updated_at: "v3" } });
  });

  it("never replaces an existing row when no version is known", async () => {
    state.remote = { data: { expenses: [{ id: "x" }] }, updated_at: "v3" };
    const res = await saveFinanceDataSafely("u1", { expenses: [] }, null);
    expect(res).toMatchObject({ ok: false, conflict: true });
    expect(calls.find((c) => c.op === "insert")).toBeUndefined();
  });
});
