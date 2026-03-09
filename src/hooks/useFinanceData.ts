import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FinanceData, Expense, Percentages, Contribution,
  FinancialGoal, Investment, EmergencyReserve, IncomeSource, IncomeFrequency,
  DEFAULT_CATEGORIES, DEFAULT_EMERGENCY_RESERVES, DEFAULT_GOALS,
  getTotalMonthlyIncome, getTotalDailyIncome,
} from "@/types/finance";
import { format } from "date-fns";

const getStorageKey = (userId?: string) => userId ? `finflow-data-${userId}` : "finflow-data";
const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const getInitialData = (): FinanceData | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as any;

    // Migrate to merged reserva_investimentos
    if (!data.categories.find((c: any) => c.id === "reserva_investimentos")) {
      const reservaCat = data.categories.find((c: any) => c.id === "reserva");
      const investCat = data.categories.find((c: any) => c.id === "investimentos");
      const reservaPct = reservaCat?.percentage ?? 10;
      const investPct = investCat?.percentage ?? 10;
      data.categories = data.categories.filter((c: any) => c.id !== "reserva" && c.id !== "investimentos");
      data.categories.push({
        id: "reserva_investimentos", name: "Reserva / Investimentos",
        percentage: reservaPct + investPct, icon: "Shield", subcategories: [],
      });
    }

    // Migrate emergencyFund -> emergencyReserves
    if (!data.emergencyReserves) {
      if (data.emergencyFund) {
        data.emergencyReserves = [{
          id: "reserva-migrated", name: "Reserva de Emergência",
          targetAmount: data.emergencyFund.targetAmount || 0,
          currentAmount: data.emergencyFund.currentAmount || 0,
          contributions: data.emergencyFund.contributions || [],
          pinnedToDashboard: true,
        }];
        delete data.emergencyFund;
      } else {
        data.emergencyReserves = [...DEFAULT_EMERGENCY_RESERVES];
      }
    }

    if (!data.financialGoals) data.financialGoals = [...DEFAULT_GOALS];
    if (!data.investments) data.investments = [];

    // Migrate single income to incomeSources
    if (!data.incomeSources) {
      data.incomeSources = data.income > 0
        ? [{ id: crypto.randomUUID(), name: "Renda Principal", amount: data.income, frequency: "monthly" as IncomeFrequency }]
        : [];
    }

    // Ensure pinnedToDashboard
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
    if (data) {
      // Keep income in sync with incomeSources
      const synced = { ...data, income: getTotalMonthlyIncome(data.incomeSources) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
    }
  }, [data]);

  const monthlyIncome = useMemo(() => data ? getTotalMonthlyIncome(data.incomeSources) : 0, [data]);
  const dailyIncome = useMemo(() => data ? getTotalDailyIncome(data.incomeSources) : 0, [data]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayExpenses = useMemo(() => {
    if (!data) return 0;
    return data.expenses.filter((e) => e.date === todayStr).reduce((s, e) => s + e.amount, 0);
  }, [data, todayStr]);

  const monthExpenses = useMemo(() => {
    if (!data) return 0;
    const month = getCurrentMonth();
    const expenses = data.expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
    const reserveContribs = data.emergencyReserves.flatMap((r) => r.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
    const goalContribs = data.financialGoals.flatMap((g) => g.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
    const investContribs = data.investments.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
    return expenses + reserveContribs + goalContribs + investContribs;
  }, [data]);

  const remainingToday = dailyIncome - todayExpenses;
  const remainingMonth = monthlyIncome - monthExpenses;

  const setupBudget = useCallback((incomeSources: IncomeSource[], percentages: Percentages) => {
    const categories = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat, percentage: percentages[cat.id as keyof Percentages],
    }));
    setData({
      income: getTotalMonthlyIncome(incomeSources),
      incomeSources,
      categories,
      expenses: [],
      emergencyReserves: DEFAULT_EMERGENCY_RESERVES.map((r) => ({ ...r, contributions: [] })),
      financialGoals: DEFAULT_GOALS.map((g) => ({ ...g, contributions: [] })),
      investments: [],
      currentMonth: getCurrentMonth(),
    });
  }, []);

  // Income sources
  const addIncomeSource = useCallback((name: string, amount: number, frequency: IncomeFrequency) => {
    setData((prev) => {
      if (!prev) return prev;
      const source: IncomeSource = { id: crypto.randomUUID(), name, amount, frequency };
      const newSources = [...prev.incomeSources, source];
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources) };
    });
  }, []);

  const deleteIncomeSource = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const newSources = prev.incomeSources.filter((s) => s.id !== id);
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources) };
    });
  }, []);

  const updateIncomeSource = useCallback((id: string, updates: Partial<Omit<IncomeSource, "id">>) => {
    setData((prev) => {
      if (!prev) return prev;
      const newSources = prev.incomeSources.map((s) => s.id === id ? { ...s, ...updates } : s);
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources) };
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
          ...cat, percentage: percentages[cat.id as keyof Percentages] ?? cat.percentage,
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

  // Emergency Reserves
  const addEmergencyReserve = useCallback((name: string, targetAmount: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const reserve: EmergencyReserve = { id: crypto.randomUUID(), name, targetAmount, currentAmount: 0, contributions: [], pinnedToDashboard: false };
      return { ...prev, emergencyReserves: [...prev.emergencyReserves, reserve] };
    });
  }, []);

  const deleteEmergencyReserve = useCallback((id: string) => {
    setData((prev) => prev ? { ...prev, emergencyReserves: prev.emergencyReserves.filter((r) => r.id !== id) } : prev);
  }, []);

  const updateEmergencyReserve = useCallback((id: string, updates: { name?: string; targetAmount?: number }) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, emergencyReserves: prev.emergencyReserves.map((r) => r.id === id ? { ...r, ...updates } : r) };
    });
  }, []);

  const addReserveContribution = useCallback((reserveId: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const contribution: Contribution = { id: crypto.randomUUID(), amount, date: format(new Date(), "yyyy-MM-dd"), note };
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) =>
          r.id === reserveId ? { ...r, currentAmount: r.currentAmount + amount, contributions: [...r.contributions, contribution] } : r
        ),
      };
    });
  }, []);

  const toggleReservePin = useCallback((reserveId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, emergencyReserves: prev.emergencyReserves.map((r) => r.id === reserveId ? { ...r, pinnedToDashboard: !r.pinnedToDashboard } : r) };
    });
  }, []);

  // Financial Goals
  const addFinancialGoal = useCallback((name: string, targetAmount: number, deadline?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const goal: FinancialGoal = { id: crypto.randomUUID(), name, targetAmount, currentAmount: 0, deadline, contributions: [], pinnedToDashboard: false };
      return { ...prev, financialGoals: [...prev.financialGoals, goal] };
    });
  }, []);

  const deleteFinancialGoal = useCallback((goalId: string) => {
    setData((prev) => prev ? { ...prev, financialGoals: prev.financialGoals.filter((g) => g.id !== goalId) } : prev);
  }, []);

  const addGoalContribution = useCallback((goalId: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const contribution: Contribution = { id: crypto.randomUUID(), amount, date: format(new Date(), "yyyy-MM-dd"), note };
      return {
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount, contributions: [...g.contributions, contribution] } : g
        ),
      };
    });
  }, []);

  const updateGoal = useCallback((goalId: string, updates: { name?: string; targetAmount?: number; deadline?: string }) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, financialGoals: prev.financialGoals.map((g) => g.id === goalId ? { ...g, ...updates } : g) };
    });
  }, []);

  const toggleGoalPin = useCallback((goalId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, financialGoals: prev.financialGoals.map((g) => g.id === goalId ? { ...g, pinnedToDashboard: !g.pinnedToDashboard } : g) };
    });
  }, []);

  // Investments
  const addInvestment = useCallback((name: string, amount: number, note?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const investment: Investment = { id: crypto.randomUUID(), name, amount, note, date: format(new Date(), "yyyy-MM-dd") };
      return { ...prev, investments: [...prev.investments, investment] };
    });
  }, []);

  const deleteInvestment = useCallback((id: string) => {
    setData((prev) => prev ? { ...prev, investments: prev.investments.filter((i) => i.id !== id) } : prev);
  }, []);

  const getSpentByCategory = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      if (categoryId === "reserva_investimentos") {
        const month = data.currentMonth;
        const rc = data.emergencyReserves.flatMap((r) => r.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
        const gc = data.financialGoals.flatMap((g) => g.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
        const ic = data.investments.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
        return rc + gc + ic;
      }
      return data.expenses.filter((e) => e.categoryId === categoryId).reduce((sum, e) => sum + e.amount, 0);
    },
    [data]
  );

  const getSpentBySubcategory = useCallback(
    (subcategoryId: string) => {
      if (!data) return 0;
      return data.expenses.filter((e) => e.subcategoryId === subcategoryId).reduce((sum, e) => sum + e.amount, 0);
    },
    [data]
  );

  const getBudget = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      const cat = data.categories.find((c) => c.id === categoryId);
      return cat ? (monthlyIncome * cat.percentage) / 100 : 0;
    },
    [data, monthlyIncome]
  );

  return {
    data, isSetup: !!data, monthlyIncome, dailyIncome, remainingToday, remainingMonth,
    setupBudget, addExpense, deleteExpense, updatePercentages, updateIncome,
    addSubcategory, deleteSubcategory, resetMonth,
    getSpentByCategory, getSpentBySubcategory, getBudget,
    addIncomeSource, deleteIncomeSource, updateIncomeSource,
    addEmergencyReserve, deleteEmergencyReserve, updateEmergencyReserve, addReserveContribution, toggleReservePin,
    addFinancialGoal, deleteFinancialGoal, addGoalContribution, updateGoal, toggleGoalPin,
    addInvestment, deleteInvestment,
  };
}
