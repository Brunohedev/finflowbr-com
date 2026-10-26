import { describe, it, expect } from "vitest";
import { resetMonthExpenses } from "@/lib/monthlyReset";

const past = { id: "1", name: "Aluguel setembro", amount: 1200, date: "2026-09-10", categoryId: "essenciais" };
const selected = { id: "2", name: "Supermercado outubro", amount: 90, date: "2026-10-05", categoryId: "essenciais" };
const next = { id: "3", name: "Cinema novembro", amount: 25, date: "2026-11-02", categoryId: "desejos" };

const expenses = [past, selected, next];

describe("resetar mês", () => {
  it("reseta somente o mês selecionado e preserva os outros meses", () => {
    const result = resetMonthExpenses(expenses, "2026-10");
    expect(result.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("despesas de qualquer dia do mês selecionado são removidas", () => {
    const result = resetMonthExpenses(expenses, "2026-09");
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });
});
