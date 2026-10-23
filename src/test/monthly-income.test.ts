import { describe, it, expect } from "vitest";
import { getIncomeSourcesForMonth, getTotalMonthlyIncome, IncomeSource } from "@/types/finance";

const base: IncomeSource[] = [{ id: "a", name: "Salário", amount: 3000, frequency: "monthly" }];

describe("salário independente por mês", () => {
  it("alterar um mês não muda os outros", () => {
    const data = {
      incomeSources: base,
      incomeSourcesByMonth: { "2026-11": [...base, { id: "b", name: "Extra", amount: 500, frequency: "monthly" as const }] },
    };
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, "2026-11"), "2026-11")).toBe(3500);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, "2026-10"), "2026-10")).toBe(3000);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, "2026-12"), "2026-12")).toBe(3000);
  });
});
