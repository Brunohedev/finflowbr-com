import { describe, it, expect } from "vitest";
import { format, addMonths } from "date-fns";
import { getIncomeSourcesForMonth, getTotalMonthlyIncome, IncomeSource } from "@/types/finance";

const base: IncomeSource[] = [{ id: "a", name: "Salário", amount: 3000, frequency: "monthly" }];

const monthKey = (offset: number) => format(addMonths(new Date(), offset), "yyyy-MM");

describe("salário independente por mês", () => {
  it("meses editados têm lista própria e não afetam os outros", () => {
    const edited = monthKey(1);
    const other = monthKey(2);
    const data = {
      incomeSources: base,
      incomeSourcesByMonth: { [edited]: [...base, { id: "b", name: "Extra", amount: 500, frequency: "monthly" as const }] },
    };
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, edited), edited)).toBe(3500);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, other), other)).toBe(0);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, monthKey(-1)), monthKey(-1))).toBe(3000);
  });

  it("mês futuro sem edição começa vazio, sem herdar a renda base", () => {
    const future = monthKey(1);
    const data = { incomeSources: base, incomeSourcesByMonth: {} };
    expect(getIncomeSourcesForMonth(data, future)).toEqual([]);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, future), future)).toBe(0);
  });

  it("mês atual e meses passados continuam usando a renda base", () => {
    const current = monthKey(0);
    const past = monthKey(-1);
    const data = { incomeSources: base, incomeSourcesByMonth: {} };
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, current), current)).toBe(3000);
    expect(getTotalMonthlyIncome(getIncomeSourcesForMonth(data, past), past)).toBe(3000);
  });

  it("lista própria do mês futuro vale mesmo depois de criada vazia ou editada", () => {
    const future = monthKey(1);
    const data = { incomeSources: base, incomeSourcesByMonth: { [future]: [] } };
    expect(getIncomeSourcesForMonth(data, future)).toEqual([]);
  });
});
