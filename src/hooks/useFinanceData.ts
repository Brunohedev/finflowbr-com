import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FinanceData, Expense, Percentages, Contribution,
  FinancialGoal, Investment, EmergencyReserve, IncomeSource, IncomeFrequency,
  RecurringExpense, RecurringFrequency,
  DEFAULT_CATEGORIES, DEFAULT_EMERGENCY_RESERVES, DEFAULT_GOALS,
  getTotalMonthlyIncome,
} from "@/types/finance";
import { format, addMonths, parseISO } from "date-fns";
import { getSavingsAllocationForMonth, getPercentagesForMonth } from "@/lib/savingsAllocation";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const getStorageKey = (userId?: string) => userId ? `finflow-data-${userId}` : "finflow-data";
const getCurrentMonth = () => format(new Date(), "yyyy-MM");

const withSyncedIncome = (financeData: FinanceData, month?: string): FinanceData => ({
  ...financeData,
  income: getTotalMonthlyIncome(financeData.incomeSources, month),
});

const saveToLocalStorage = (userId: string | undefined, financeData: FinanceData) => {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(financeData));
};

const toFinanceJson = (financeData: FinanceData): Json => financeData as unknown as Json;

const getMonthExpenseTotal = (data: FinanceData, monthKey: string) =>
  data.expenses
    .filter((expense) => expense.date.startsWith(monthKey))
    .reduce((sum, expense) => sum + expense.amount, 0);

const logSavingsBalanceUpdate = (source: string, data: FinanceData, deposit: number) => {
  const monthKey = format(new Date(), "yyyy-MM");
  const savingsAllocation = getSavingsAllocationForMonth(data, monthKey);
  const remainingCap = Math.max(0, savingsAllocation.reserveCap - savingsAllocation.reserveUsed);
  const budgetPart = Math.min(deposit, remainingCap);
  const extraPart = deposit - budgetPart;
  const balanceBefore = savingsAllocation.salary - (getMonthExpenseTotal(data, monthKey) + savingsAllocation.reserveUsed);
  const balanceAfter = balanceBefore - budgetPart;

  console.log({
    source,
    deposit,
    budget_part: budgetPart,
    extra_part: extraPart,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  });
};

const normalizeFinanceData = (raw: unknown): FinanceData | null => {
  if (!raw || typeof raw !== "object") return null;

  try {
    const data = JSON.parse(JSON.stringify(raw)) as any;

    if (!Array.isArray(data.categories) || !Array.isArray(data.expenses)) {
      return null;
    }

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
    if (!data.salaryByMonth) data.salaryByMonth = {};

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
    return withSyncedIncome(data as FinanceData);
  } catch {
    return null;
  }
};

const getInitialData = (userId?: string): FinanceData | null => {
  const stored = localStorage.getItem(getStorageKey(userId));
  if (!stored) return null;

  try {
    return normalizeFinanceData(JSON.parse(stored));
  } catch {
    return null;
  }
};

export function useFinanceData(userId?: string, selectedMonth?: string) {
  const activeMonth = selectedMonth || getCurrentMonth();

  // When a userId is present, start with null and wait for Supabase to respond.
  // This prevents showing stale/other-user localStorage data before the remote check.
  const [data, setData] = useState<FinanceData | null>(() => userId ? null : getInitialData(undefined));
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "loaded">(userId ? "loading" : "idle");
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  // Version of the cloud row we last read/wrote. Saves only succeed if the cloud
  // still has this version, so a stale device/tab can never erase newer data.
  const remoteUpdatedAtRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef<FinanceData | null>(null);
  const isSyncLoading = !!userId && syncStatus !== "loaded";

  const applyRemote = useCallback((uid: string, remote: { data: unknown; updated_at: string }) => {
    const remoteData = normalizeFinanceData(remote.data);
    remoteUpdatedAtRef.current = remote.updated_at;
    if (!remoteData) return;
    saveToLocalStorage(uid, remoteData);
    lastSyncedSnapshotRef.current = JSON.stringify(withSyncedIncome(remoteData));
    setData(remoteData);
  }, []);

  const flushSave = useCallback(async (uid: string) => {
    if (savingRef.current || !pendingRef.current) return;
    const toSave = pendingRef.current;
    pendingRef.current = null;
    savingRef.current = true;
    const result = await saveFinanceDataSafely(uid, toFinanceJson(toSave), remoteUpdatedAtRef.current);
    savingRef.current = false;

    if (result.ok) {
      remoteUpdatedAtRef.current = result.updatedAt;
      if (pendingRef.current) void flushSave(uid);
      return;
    }
    if (result.conflict) {
      pendingRef.current = null;
      if (result.remote) applyRemote(uid, result.remote);
      toast.warning("Seus dados foram atualizados em outro aparelho. Carregamos a versão mais recente — refaça a última alteração, se necessário.");
      return;
    }
    console.error("Finance sync save error:", result.error);
    lastSyncedSnapshotRef.current = null;
  }, [applyRemote]);

  useEffect(() => {
    if (!userId) {
      const localData = getInitialData(undefined);
      setData(localData);
      lastSyncedSnapshotRef.current = localData ? JSON.stringify(withSyncedIncome(localData)) : null;
      setSyncStatus("idle");
      return;
    }

    // For authenticated users, always start blank and wait for Supabase.
    setData(null);
    lastSyncedSnapshotRef.current = null;
    remoteUpdatedAtRef.current = null;
    pendingRef.current = null;

    let cancelled = false;
    setSyncStatus("loading");

    const hydrateFromSupabase = async () => {
      const { data: remoteRow, error } = await supabase
        .from("finance_data")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Finance sync load error:", error.message);
        setSyncStatus("loaded");
        return;
      }

      const remoteData = normalizeFinanceData(remoteRow?.data);

      if (remoteData && remoteRow) {
        remoteUpdatedAtRef.current = remoteRow.updated_at;
        saveToLocalStorage(userId, remoteData);
        lastSyncedSnapshotRef.current = JSON.stringify(remoteData);
        setData(remoteData);
        setSyncStatus("loaded");
        return;
      }

      // No remote data = new user. Clear any leftover local data so they see the SetupWizard.
      console.log("New user detected – no remote finance data. Starting fresh onboarding.");
      localStorage.removeItem(getStorageKey(userId));
      localStorage.removeItem(getStorageKey(undefined)); // clear generic key too
      setData(null);
      lastSyncedSnapshotRef.current = null;
      setSyncStatus("loaded");
    };

    void hydrateFromSupabase();

    // When the user comes back to this tab/app, pull newer cloud data first.
    const refreshIfStale = async () => {
      if (document.visibilityState !== "visible" || savingRef.current || pendingRef.current) return;
      const remote = await fetchRemote(userId);
      if (cancelled || !remote || savingRef.current || pendingRef.current) return;
      if (remoteUpdatedAtRef.current && remote.updated_at !== remoteUpdatedAtRef.current) {
        applyRemote(userId, remote);
      }
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [userId, applyRemote]);

  useEffect(() => {
    if (!data) {
      lastSyncedSnapshotRef.current = null;
      return;
    }

    const synced = withSyncedIncome(data);
    const snapshot = JSON.stringify(synced);

    saveToLocalStorage(userId, synced);

    if (!userId || syncStatus !== "loaded" || lastSyncedSnapshotRef.current === snapshot) {
      return;
    }

    lastSyncedSnapshotRef.current = snapshot;
    pendingRef.current = synced;
    void flushSave(userId);
  }, [data, userId, syncStatus, flushSave]);

  const defaultIncome = useMemo(() => data ? getTotalMonthlyIncome(data.incomeSources, activeMonth) : 0, [data, activeMonth]);
  const monthlyIncome = useMemo(() => {
    if (!data) return 0;
    const override = data.salaryByMonth?.[activeMonth];
    return override !== undefined ? override : defaultIncome;
  }, [data, activeMonth, defaultIncome]);
  const dailyIncome = useMemo(() => monthlyIncome / 30, [monthlyIncome]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isCurrentMonth = activeMonth === getCurrentMonth();

  const expenseOnlyToday = useMemo(() => {
    if (!data || !isCurrentMonth) return 0;
    return data.expenses.filter((e) => e.date === todayStr).reduce((s, e) => s + e.amount, 0);
  }, [data, todayStr, isCurrentMonth]);

  const savingsAllocation = useMemo(() => {
    if (!data) return null;
    return getSavingsAllocationForMonth(data, activeMonth);
  }, [data, activeMonth]);

  const monthSavingsTotal = savingsAllocation?.reserveTotal ?? 0;
  const monthSavingsUsed = savingsAllocation?.reserveUsed ?? 0;
  const savingsBudget = savingsAllocation?.reserveCap ?? 0;
  const monthSavingsExtra = savingsAllocation?.reserveExtra ?? 0;

  const todaySavingsUsed = useMemo(() => {
    if (!isCurrentMonth || !savingsAllocation) return 0;
    return savingsAllocation.entries
      .filter((entry) => entry.date === todayStr)
      .reduce((sum, entry) => sum + entry.budgetPart, 0);
  }, [isCurrentMonth, savingsAllocation, todayStr]);

  const todayExpenses = expenseOnlyToday + todaySavingsUsed;

  const monthExpenses = useMemo(() => {
    if (!data) return 0;
    return getMonthExpenseTotal(data, activeMonth) + monthSavingsUsed;
  }, [data, activeMonth, monthSavingsUsed]);
  const remainingToday = dailyIncome - todayExpenses;
  const remainingMonth = monthlyIncome - monthExpenses;

  const setupBudget = useCallback((incomeSources: IncomeSource[], percentages: Percentages) => {
    const categories = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat, percentage: percentages[cat.id as keyof Percentages],
    }));
    setData({
      income: getTotalMonthlyIncome(incomeSources, getCurrentMonth()),
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
      const source: IncomeSource = { id: crypto.randomUUID(), name, amount, frequency, ...(frequency === "once" ? { month: activeMonth } : {}) };
      const newSources = [...prev.incomeSources, source];
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources, activeMonth) };
    });
  }, [activeMonth]);

  const deleteIncomeSource = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const newSources = prev.incomeSources.filter((s) => s.id !== id);
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources, activeMonth) };
    });
  }, []);

  const updateIncomeSource = useCallback((id: string, updates: Partial<Omit<IncomeSource, "id">>) => {
    setData((prev) => {
      if (!prev) return prev;
      const newSources = prev.incomeSources.map((s) => s.id === id ? { ...s, ...updates } : s);
      return { ...prev, incomeSources: newSources, income: getTotalMonthlyIncome(newSources, activeMonth) };
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

  const updateExpense = useCallback((id: string, updates: Partial<Expense>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        expenses: prev.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      };
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
      const percentagesByMonth = { ...(prev.percentagesByMonth || {}), [activeMonth]: percentages };
      return { ...prev, percentagesByMonth };
    });
  }, [activeMonth]);

  const updateIncome = useCallback((income: number) => {
    setData((prev) => (prev ? { ...prev, income } : prev));
  }, []);

  const setMonthSalary = useCallback((month: string, amount: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const defaultIncome = getTotalMonthlyIncome(prev.incomeSources, month);
      const salaryByMonth = { ...(prev.salaryByMonth || {}) };

      if (Math.abs(amount - defaultIncome) < 0.01) {
        delete salaryByMonth[month];
      } else {
        salaryByMonth[month] = amount;
      }

      return { ...prev, salaryByMonth };
    });
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
      logSavingsBalanceUpdate("deposit", prev, amount);
      // Use activeMonth so the contribution is scoped to the selected month
      const contributionDate = `${activeMonth}-15`;
      const contribution: Contribution = { id: crypto.randomUUID(), amount, date: contributionDate, note };
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) =>
          r.id === reserveId ? { ...r, currentAmount: r.currentAmount + amount, contributions: [...r.contributions, contribution] } : r
        ),
      };
    });
  }, [activeMonth]);

  const updateReserveContribution = useCallback((reserveId: string, contributionId: string, updates: { amount?: number; note?: string }) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) => {
          if (r.id !== reserveId) return r;
          const old = r.contributions.find((c) => c.id === contributionId);
          if (!old) return r;
          const newAmount = updates.amount ?? old.amount;
          return {
            ...r,
            currentAmount: r.currentAmount - old.amount + newAmount,
            contributions: r.contributions.map((c) =>
              c.id === contributionId ? { ...c, amount: newAmount, note: updates.note !== undefined ? updates.note : c.note } : c
            ),
          };
        }),
      };
    });
  }, []);

  const deleteReserveContribution = useCallback((reserveId: string, contributionId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emergencyReserves: prev.emergencyReserves.map((r) => {
          if (r.id !== reserveId) return r;
          const old = r.contributions.find((c) => c.id === contributionId);
          if (!old) return r;
          return { ...r, currentAmount: r.currentAmount - old.amount, contributions: r.contributions.filter((c) => c.id !== contributionId) };
        }),
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
      logSavingsBalanceUpdate("deposit", prev, amount);
      // Use activeMonth so the contribution is scoped to the selected month
      const contributionDate = `${activeMonth}-15`;
      const contribution: Contribution = { id: crypto.randomUUID(), amount, date: contributionDate, note };
      return {
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount, contributions: [...g.contributions, contribution] } : g
        ),
      };
    });
  }, [activeMonth]);

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
      logSavingsBalanceUpdate("deposit", prev, amount);
      // Use activeMonth so the investment is scoped to the selected month
      const investmentDate = `${activeMonth}-15`;
      const investment: Investment = { id: crypto.randomUUID(), name, amount, note, date: investmentDate };
      return { ...prev, investments: [...prev.investments, investment] };
    });
  }, [activeMonth]);

  const updateInvestment = useCallback((id: string, updates: { name?: string; amount?: number; note?: string }) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, investments: prev.investments.map((i) => i.id === id ? { ...i, ...updates } : i) };
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
      if (categoryId === "reserva_investimentos") {
        return monthSavingsUsed;
      }
      return data.expenses
        .filter((e) => e.categoryId === categoryId && e.date.startsWith(activeMonth))
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [data, activeMonth, monthSavingsUsed]
  );

  const getSpentBySubcategory = useCallback(
    (subcategoryId: string) => {
      if (!data) return 0;
      return data.expenses
        .filter((e) => e.subcategoryId === subcategoryId && e.date.startsWith(activeMonth))
        .reduce((sum, e) => sum + e.amount, 0);
    },
    [data, activeMonth]
  );

  const monthPercentages = useMemo(() => {
    if (!data) return { essenciais: 50, desejos: 30, reserva_investimentos: 20 };
    return getPercentagesForMonth(data, activeMonth);
  }, [data, activeMonth]);

  const getBudget = useCallback(
    (categoryId: string) => {
      if (!data) return 0;
      const pct = monthPercentages[categoryId as keyof Percentages];
      return pct !== undefined ? (monthlyIncome * pct) / 100 : 0;
    },
    [data, monthlyIncome, monthPercentages]
  );

  return {
    data, isSetup: !!data, isSyncLoading, monthlyIncome, dailyIncome, remainingToday, remainingMonth, activeMonth, setMonthSalary, monthSavingsExtra, monthSavingsTotal, monthSavingsUsed, savingsBudget, monthPercentages,
    setupBudget, addExpense, deleteExpense, updateExpense, toggleExpenseStatus, updatePercentages, updateIncome,
    addSubcategory, deleteSubcategory, resetMonth,
    getSpentByCategory, getSpentBySubcategory, getBudget,
    addIncomeSource, deleteIncomeSource, updateIncomeSource,
    addEmergencyReserve, deleteEmergencyReserve, updateEmergencyReserve, addReserveContribution, updateReserveContribution, deleteReserveContribution, toggleReservePin,
    addFinancialGoal, deleteFinancialGoal, addGoalContribution, updateGoal, toggleGoalPin,
    addInvestment, updateInvestment, deleteInvestment,
    addRecurringExpense, deleteRecurringExpense, toggleRecurringExpense,
  };
}
