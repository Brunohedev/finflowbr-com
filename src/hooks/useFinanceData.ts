import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FinanceData, Expense, Percentages, Contribution,
  FinancialGoal, Investment, EmergencyReserve, IncomeSource, IncomeFrequency,
  RecurringExpense, RecurringFrequency,
  DEFAULT_CATEGORIES, DEFAULT_EMERGENCY_RESERVES, DEFAULT_GOALS,
  getTotalMonthlyIncome, getTotalDailyIncome,
} from "@/types/finance";
import { format, addMonths, parseISO } from "date-fns";

const getStorageKey = (userId?: string) => userId ? `finflow-data-${userId}` : "finflow-data";
const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const getInitialData = (userId?: string): FinanceData | null => {
  const stored = localStorage.getItem(getStorageKey(userId));
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
    if (!data.recurringExpenses) data.recurringExpenses = [];

    // Migrate single income to incomeSources
    if (!data.incomeSources) {
      data.incomeSources = data.income > 0
        ? [{ id: crypto.randomUUID(), name: "Renda Principal", amount: data.income, frequency: "monthly" as IncomeFrequency }]
        : [];
    }

    // Ensure pinnedToDashboard
    data.emergencyReserves.forEach((r: any) => { if (r.pinnedToDashboard === undefined) r.pinnedToDashboard = false; });
    data.financialGoals.forEach((g: any) => { if (g.pinnedToDashboard === undefined) g.pinnedToDashboard = false; });

    // Migrate expenses without status
    if (data.expenses) {
      data.expenses = data.expenses.map((e: any) => ({ ...e, status: e.status || "paid" }));
    }

    if (data.currentMonth !== getCurrentMonth()) {
      return { ...data, expenses: data.expenses || [], currentMonth: getCurrentMonth() } as FinanceData;
    }
    return data as FinanceData;
  } catch {
    return null;
  }
};

export function useFinanceData(userId?: string) {
  const [data, setData] = useState<FinanceData | null>(() => getInitialData(userId));

  // Reset data when userId changes (account switch)
  useEffect(() => {
    setData(getInitialData(userId));
  }, [userId]);

  useEffect(() => {
    if (data) {
      const synced = { ...data, income: getTotalMonthlyIncome(data.incomeSources) };
      localStorage.setItem(getStorageKey(userId), JSON.stringify(synced));
    }
  }, [data, userId]);

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
      recurringExpenses: [],
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

  const addExpense = useCallback((expense: Omit<Expense, "id"> & { installments?: number }) => {
    setData((prev) => {
      if (!prev) return prev;

      const installmentCount = expense.installments && expense.installments > 1 ? expense.installments : 1;

      if (installmentCount > 1) {
        const groupId = crypto.randomUUID();
        const installmentAmount = Math.round((expense.amount / installmentCount) * 100) / 100;
        const startDate = parseISO(expense.date);
        const newExpenses: Expense[] = [];

        for (let i = 0; i < installmentCount; i++) {
          const installmentDate = addMonths(startDate, i);
          newExpenses.push({
            id: crypto.randomUUID(),
            name: expense.name,
            amount: installmentAmount,
            categoryId: expense.categoryId,
            subcategoryId: expense.subcategoryId,
            date: format(installmentDate, "yyyy-MM-dd"),
            note: expense.note,
            status: i === 0 ? expense.status : "pending",
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            totalInstallments: installmentCount,
          });
        }

        return { ...prev, expenses: [...prev.expenses, ...newExpenses] };
      }

      return {
        ...prev,
        expenses: [...prev.expenses, {
          id: crypto.randomUUID(),
          name: expense.name,
          amount: expense.amount,
          categoryId: expense.categoryId,
          subcategoryId: expense.subcategoryId,
          date: expense.date,
          note: expense.note,
          status: expense.status || "paid",
        }],
      };
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
    });
  }, []);

  const toggleExpenseStatus = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        expenses: prev.expenses.map((e) =>
          e.id === id ? { ...e, status: e.status === "paid" ? "pending" as const : "paid" as const } : e
        ),
      };
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

  // Recurring Expenses
  const addRecurringExpense = useCallback((name: string, amount: number, frequency: RecurringFrequency, categoryId: string, subcategoryId?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const re: RecurringExpense = {
        id: crypto.randomUUID(), name, amount, frequency, categoryId,
        subcategoryId, nextDueDate: format(new Date(), "yyyy-MM-dd"), active: true,
      };
      return { ...prev, recurringExpenses: [...prev.recurringExpenses, re] };
    });
  }, []);

  const deleteRecurringExpense = useCallback((id: string) => {
    setData((prev) => prev ? { ...prev, recurringExpenses: prev.recurringExpenses.filter((r) => r.id !== id) } : prev);
  }, []);

  const toggleRecurringExpense = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, recurringExpenses: prev.recurringExpenses.map((r) => r.id === id ? { ...r, active: !r.active } : r) };
    });
  }, []);

  const getSpentByCategory = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      const month = data.currentMonth;
      if (categoryId === "reserva_investimentos") {
        const rc = data.emergencyReserves.flatMap((r) => r.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
        const gc = data.financialGoals.flatMap((g) => g.contributions).filter((c) => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
        const ic = data.investments.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
        return rc + gc + ic;
      }
      return data.expenses
        .filter((e) => e.categoryId === categoryId && e.date.startsWith(month))
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [data]
  );

  const getSpentBySubcategory = useCallback(
    (subcategoryId: string) => {
      if (!data) return 0;
      const month = data.currentMonth;
      return data.expenses
        .filter((e) => e.subcategoryId === subcategoryId && e.date.startsWith(month))
        .reduce((sum, e) => sum + e.amount, 0);
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
    setupBudget, addExpense, deleteExpense, toggleExpenseStatus, updatePercentages, updateIncome,
    addSubcategory, deleteSubcategory, resetMonth,
    getSpentByCategory, getSpentBySubcategory, getBudget,
    addIncomeSource, deleteIncomeSource, updateIncomeSource,
    addEmergencyReserve, deleteEmergencyReserve, updateEmergencyReserve, addReserveContribution, toggleReservePin,
    addFinancialGoal, deleteFinancialGoal, addGoalContribution, updateGoal, toggleGoalPin,
    addInvestment, deleteInvestment,
    addRecurringExpense, deleteRecurringExpense, toggleRecurringExpense,
  };
}
