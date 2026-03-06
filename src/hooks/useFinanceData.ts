import { useState, useEffect, useCallback } from "react";
import { FinanceData, Expense, DEFAULT_CATEGORIES } from "@/types/finance";
import { format } from "date-fns";

const STORAGE_KEY = "finflow-data";

const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const getInitialData = (): FinanceData | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored) as FinanceData;
    // Auto-reset if month changed
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
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  const setupBudget = useCallback((income: number, percentages: { essenciais: number; desejos: number; reserva: number }) => {
    const categories = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      percentage: percentages[cat.id as keyof typeof percentages],
    }));
    setData({ income, categories, expenses: [], currentMonth: getCurrentMonth() });
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        expenses: [...prev.expenses, { ...expense, id: crypto.randomUUID() }],
      };
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
    });
  }, []);

  const updatePercentages = useCallback((percentages: { essenciais: number; desejos: number; reserva: number }) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) => ({
          ...cat,
          percentage: percentages[cat.id as keyof typeof percentages],
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
            ? {
                ...cat,
                subcategories: [
                  ...cat.subcategories,
                  { id: crypto.randomUUID(), name, categoryId },
                ],
              }
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

  const getSpentByCategory = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
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
    resetMonth,
    getSpentByCategory,
    getSpentBySubcategory,
    getBudget,
  };
}
