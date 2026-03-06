import { useState, useEffect, useCallback } from "react";
import {
  FinanceData, Expense, Percentages, Contribution,
  FinancialGoal, Investment,
  DEFAULT_CATEGORIES, DEFAULT_EMERGENCY_FUND, DEFAULT_GOALS,
} from "@/types/finance";
import { format } from "date-fns";

const STORAGE_KEY = "finflow-data";
const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const getInitialData = (): FinanceData | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as FinanceData;
    // Migrate old data: add missing fields
    if (!data.emergencyFund) data.emergencyFund = DEFAULT_EMERGENCY_FUND;
    if (!data.financialGoals) data.financialGoals = DEFAULT_GOALS;
    if (!data.investments) data.investments = [];
    // Ensure 4 categories exist (migrate from 3)
    if (!data.categories.find((c) => c.id === "investimentos")) {
      const reservaCat = data.categories.find((c) => c.id === "reserva");
      if (reservaCat) {
        const oldPct = reservaCat.percentage;
        reservaCat.percentage = Math.ceil(oldPct / 2);
        reservaCat.name = "Reserva";
        reservaCat.subcategories = [];
        data.categories.push({
          id: "investimentos",
          name: "Investimentos",
          percentage: Math.floor(oldPct / 2),
          icon: "TrendingUp",
          subcategories: [],
        });
      }
    }
    if (data.currentMonth !== getCurrentMonth()) {
      return { ...data, expenses: [], currentMonth: getCurrentMonth() };
    }
    return data;
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
      emergencyFund: { ...DEFAULT_EMERGENCY_FUND },
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

  // Emergency Fund
  const updateEmergencyFundTarget = useCallback((targetAmount: number) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, emergencyFund: { ...prev.emergencyFund, targetAmount } };
    });
  }, []);

  const addEmergencyContribution = useCallback((amount: number, note?: string) => {
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
        emergencyFund: {
          ...prev.emergencyFund,
          currentAmount: prev.emergencyFund.currentAmount + amount,
          contributions: [...prev.emergencyFund.contributions, contribution],
        },
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
      if (categoryId === "reserva") {
        const monthContribs = data.emergencyFund.contributions
          .filter((c) => c.date.startsWith(data.currentMonth))
          .reduce((s, c) => s + c.amount, 0);
        const goalContribs = data.financialGoals
          .flatMap((g) => g.contributions)
          .filter((c) => c.date.startsWith(data.currentMonth))
          .reduce((s, c) => s + c.amount, 0);
        return monthContribs + goalContribs;
      }
      if (categoryId === "investimentos") {
        return data.investments
          .filter((i) => i.date.startsWith(data.currentMonth))
          .reduce((s, i) => s + i.amount, 0);
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
    // Emergency Fund
    updateEmergencyFundTarget,
    addEmergencyContribution,
    // Goals
    addFinancialGoal,
    deleteFinancialGoal,
    addGoalContribution,
    updateGoal,
    // Investments
    addInvestment,
    deleteInvestment,
  };
}
