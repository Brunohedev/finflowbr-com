import { useState, useEffect, useCallback } from "react";
import {
  FinanceData, Expense, Percentages, Contribution,
  FinancialGoal, Investment, EmergencyReserve,
  DEFAULT_CATEGORIES, DEFAULT_EMERGENCY_RESERVES, DEFAULT_GOALS,
} from "@/types/finance";
import { format } from "date-fns";

const STORAGE_KEY = "finflow-data";
const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const getInitialData = (): FinanceData | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as any;

    // Migrate from old 4-category or 3-category model to new merged model
    if (!data.categories.find((c: any) => c.id === "reserva_investimentos")) {
      const reservaCat = data.categories.find((c: any) => c.id === "reserva");
      const investCat = data.categories.find((c: any) => c.id === "investimentos");
      const reservaPct = reservaCat?.percentage ?? 10;
      const investPct = investCat?.percentage ?? 10;
      data.categories = data.categories.filter((c: any) => c.id !== "reserva" && c.id !== "investimentos");
      data.categories.push({
        id: "reserva_investimentos",
        name: "Reserva / Investimentos",
        percentage: reservaPct + investPct,
        icon: "Shield",
        subcategories: [],
      });
    }

    // Migrate emergencyFund (single) -> emergencyReserves (array)
    if (!data.emergencyReserves) {
      if (data.emergencyFund) {
        data.emergencyReserves = [{
          id: "reserva-migrated",
          name: "Reserva de Emergência",
          targetAmount: data.emergencyFund.targetAmount || 0,
          currentAmount: data.emergencyFund.currentAmount || 0,
          contributions: data.emergencyFund.contributions || [],
          pinnedToDashboard: false,
        }];
        delete data.emergencyFund;
      } else {
        data.emergencyReserves = [...DEFAULT_EMERGENCY_RESERVES];
      }
    }

    if (!data.financialGoals) data.financialGoals = [...DEFAULT_GOALS];
    if (!data.investments) data.investments = [];

    // Ensure pinnedToDashboard exists
    data.emergencyReserves.forEach((r: any) => { if (r.pinnedToDashboard === undefined) r.pinnedToDashboard = false; });
    data.financialGoals.forEach((g: any) => { if (g.pinnedToDashboard === undefined) g.pinnedToDashboard = false; });

    if (data.currentMonth !== getCurrentMonth()) {
      return { ...data, expenses: [], currentMonth: getCurrentMonth() } as FinanceData;
    }
    return data as FinanceData;
  } catch {
    return null;
  }
};

export function useFinanceData() {
  const [data, setData] = useState<FinanceData | null>(getInitialData);

  useEffect(() => {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const setupBudget = useCallback((income: number, percentages: Percentages) => {
    const categories = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      percentage: percentages[cat.id as keyof Percentages],
    }));
    setData({
      income,
      categories,
      expenses: [],
      emergencyReserves: DEFAULT_EMERGENCY_RESERVES.map((r) => ({ ...r, contributions: [] })),
      financialGoals: DEFAULT_GOALS.map((g) => ({ ...g, contributions: [] })),
      investments: [],
      currentMonth: getCurrentMonth(),
    });
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, expenses: [...prev.expenses, { ...expense, id: crypto.randomUUID() }] };
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
    });
  }, []);

  const updatePercentages = useCallback((percentages: Percentages) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) => ({
          ...cat,
          percentage: percentages[cat.id as keyof Percentages] ?? cat.percentage,
        })),
      };
    });
  }, []);

  const updateIncome = useCallback((income: number) => {
    setData((prev) => (prev ? { ...prev, income } : prev));
  }, []);

  const addSubcategory = useCallback((categoryId: string, name: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, subcategories: [...cat.subcategories, { id: crypto.randomUUID(), name, categoryId }] }
            : cat
        ),
      };
    });
  }, []);

  const deleteSubcategory = useCallback((categoryId: string, subcategoryId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, subcategories: cat.subcategories.filter((s) => s.id !== subcategoryId) }
            : cat
        ),
        expenses: prev.expenses.filter((e) => e.subcategoryId !== subcategoryId),
      };
    });
  }, []);

  const resetMonth = useCallback(() => {
    setData((prev) => (prev ? { ...prev, expenses: [], currentMonth: getCurrentMonth() } : prev));
  }, []);

  // Emergency Reserves (multiple)
  const addEmergencyReserve = useCallback((name: string, targetAmount: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const reserve: EmergencyReserve = {
        id: crypto.randomUUID(),
        name,
        targetAmount,
        currentAmount: 0,
        contributions: [],
        pinnedToDashboard: false,
      };
      return { ...prev, emergencyReserves: [...prev.emergencyReserves, reserve] };
    });
  }, []);

  const deleteEmergencyReserve = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, emergencyReserves: prev.emergencyReserves.filter((r) => r.id !== id) };
    });
  }, []);

  const updateEmergencyReserve = useCallback((id: string, updates: { name?: string; targetAmount?: number }) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      };
    });
  }, []);

  const addReserveContribution = useCallback((reserveId: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const contribution: Contribution = {
        id: crypto.randomUUID(),
        amount,
        date: format(new Date(), "yyyy-MM-dd"),
        note,
      };
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) =>
          r.id === reserveId
            ? { ...r, currentAmount: r.currentAmount + amount, contributions: [...r.contributions, contribution] }
            : r
        ),
      };
    });
  }, []);

  const toggleReservePin = useCallback((reserveId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) =>
          r.id === reserveId ? { ...r, pinnedToDashboard: !r.pinnedToDashboard } : r
        ),
      };
    });
  }, []);

  // Financial Goals
  const addFinancialGoal = useCallback((name: string, targetAmount: number, deadline?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const goal: FinancialGoal = {
        id: crypto.randomUUID(),
        name,
        targetAmount,
        currentAmount: 0,
        deadline,
        contributions: [],
        pinnedToDashboard: false,
      };
      return { ...prev, financialGoals: [...prev.financialGoals, goal] };
    });
  }, []);

  const deleteFinancialGoal = useCallback((goalId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, financialGoals: prev.financialGoals.filter((g) => g.id !== goalId) };
    });
  }, []);

  const addGoalContribution = useCallback((goalId: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const contribution: Contribution = {
        id: crypto.randomUUID(),
        amount,
        date: format(new Date(), "yyyy-MM-dd"),
        note,
      };
      return {
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === goalId
            ? { ...g, currentAmount: g.currentAmount + amount, contributions: [...g.contributions, contribution] }
            : g
        ),
      };
    });
  }, []);

  const updateGoal = useCallback((goalId: string, updates: { name?: string; targetAmount?: number; deadline?: string }) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === goalId ? { ...g, ...updates } : g
        ),
      };
    });
  }, []);

  const toggleGoalPin = useCallback((goalId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === goalId ? { ...g, pinnedToDashboard: !g.pinnedToDashboard } : g
        ),
      };
    });
  }, []);

  // Investments
  const addInvestment = useCallback((name: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const investment: Investment = {
        id: crypto.randomUUID(),
        name,
        amount,
        note,
        date: format(new Date(), "yyyy-MM-dd"),
      };
      return { ...prev, investments: [...prev.investments, investment] };
    });
  }, []);

  const deleteInvestment = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, investments: prev.investments.filter((i) => i.id !== id) };
    });
  }, []);

  const getSpentByCategory = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      if (categoryId === "reserva_investimentos") {
        const reserveContribs = data.emergencyReserves
          .flatMap((r) => r.contributions)
          .filter((c) => c.date.startsWith(data.currentMonth))
          .reduce((s, c) => s + c.amount, 0);
        const goalContribs = data.financialGoals
          .flatMap((g) => g.contributions)
          .filter((c) => c.date.startsWith(data.currentMonth))
          .reduce((s, c) => s + c.amount, 0);
        const investContribs = data.investments
          .filter((i) => i.date.startsWith(data.currentMonth))
          .reduce((s, i) => s + i.amount, 0);
        return reserveContribs + goalContribs + investContribs;
      }
      return data.expenses
        .filter((e) => e.categoryId === categoryId)
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [data]
  );

  const getSpentBySubcategory = useCallback(
    (subcategoryId: string) => {
      if (!data) return 0;
      return data.expenses
        .filter((e) => e.subcategoryId === subcategoryId)
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [data]
  );

  const getBudget = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      const cat = data.categories.find((c) => c.id === categoryId);
      return cat ? (data.income * cat.percentage) / 100 : 0;
    },
    [data]
  );

  return {
    data,
    isSetup: !!data,
    setupBudget,
    addExpense,
    deleteExpense,
    updatePercentages,
    updateIncome,
    addSubcategory,
    deleteSubcategory,
    resetMonth,
    getSpentByCategory,
    getSpentBySubcategory,
    getBudget,
    // Emergency Reserves
    addEmergencyReserve,
    deleteEmergencyReserve,
    updateEmergencyReserve,
    addReserveContribution,
    toggleReservePin,
    // Goals
    addFinancialGoal,
    deleteFinancialGoal,
    addGoalContribution,
    updateGoal,
    toggleGoalPin,
    // Investments
    addInvestment,
    deleteInvestment,
  };
}
