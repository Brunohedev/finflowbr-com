import { FinanceData, getTotalMonthlyIncome } from "@/types/finance";

export interface SavingsAllocationEntry {
  id: string;
  amount: number;
  budgetPart: number;
  date: string;
  extraPart: number;
  name: string;
  source: "goal" | "investment" | "reserve";
}

export interface SavingsAllocationSummary {
  entries: SavingsAllocationEntry[];
  reserveCap: number;
  reserveExtra: number;
  reservePercentage: number;
  reserveTotal: number;
  reserveUsed: number;
  salary: number;
}

const getReservePercentage = (data: FinanceData) =>
  data.categories.find((category) => category.id === "reserva_investimentos")?.percentage ?? 0;

export const getMonthlyIncomeForMonth = (data: FinanceData, monthKey: string) => {
  const override = data.salaryByMonth?.[monthKey];
  return override !== undefined ? override : getTotalMonthlyIncome(data.incomeSources ?? []);
};

export const getSavingsAllocationForMonth = (data: FinanceData, monthKey: string): SavingsAllocationSummary => {
  const salary = getMonthlyIncomeForMonth(data, monthKey);
  const reservePercentage = getReservePercentage(data);
  const reserveCap = (salary * reservePercentage) / 100;

  const entries = [
    ...data.emergencyReserves.flatMap((reserve) =>
      reserve.contributions
        .filter((contribution) => contribution.date.startsWith(monthKey))
        .map((contribution) => ({
          amount: contribution.amount,
          date: contribution.date,
          id: contribution.id,
          name: reserve.name,
          source: "reserve" as const,
        }))
    ),
    ...data.financialGoals.flatMap((goal) =>
      goal.contributions
        .filter((contribution) => contribution.date.startsWith(monthKey))
        .map((contribution) => ({
          amount: contribution.amount,
          date: contribution.date,
          id: contribution.id,
          name: goal.name,
          source: "goal" as const,
        }))
    ),
    ...data.investments
      .filter((investment) => investment.date.startsWith(monthKey))
      .map((investment) => ({
        amount: investment.amount,
        date: investment.date,
        id: investment.id,
        name: investment.name,
        source: "investment" as const,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let reserveUsedSoFar = 0;

  const allocatedEntries = entries.map((entry) => {
    const remainingCap = Math.max(0, reserveCap - reserveUsedSoFar);
    const budgetPart = Math.min(entry.amount, remainingCap);
    const extraPart = entry.amount - budgetPart;

    reserveUsedSoFar += budgetPart;

    return {
      ...entry,
      budgetPart,
      extraPart,
    };
  });

  const reserveTotal = allocatedEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const reserveUsed = allocatedEntries.reduce((sum, entry) => sum + entry.budgetPart, 0);
  const reserveExtra = allocatedEntries.reduce((sum, entry) => sum + entry.extraPart, 0);

  return {
    entries: allocatedEntries,
    reserveCap,
    reserveExtra,
    reservePercentage,
    reserveTotal,
    reserveUsed,
    salary,
  };
};