export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId: string;
  date: string;
  note?: string;
  status: "paid" | "pending";
  installmentGroupId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface Category {
  id: string;
  name: string;
  percentage: number;
  icon: string;
  subcategories: Subcategory[];
}

export interface Contribution {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface EmergencyReserve {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  contributions: Contribution[];
  pinnedToDashboard?: boolean;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  contributions: Contribution[];
  pinnedToDashboard?: boolean;
}

export interface Investment {
  id: string;
  name: string;
  amount: number;
  note?: string;
  date: string;
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  categoryId: string;
  subcategoryId?: string;
  nextDueDate: string;
  active: boolean;
}

export type IncomeFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "once";

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: IncomeFrequency;
}

export interface FinanceData {
  income: number;
  incomeSources: IncomeSource[];
  categories: Category[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  emergencyReserves: EmergencyReserve[];
  financialGoals: FinancialGoal[];
  investments: Investment[];
  currentMonth: string;
}

export type Percentages = {
  essenciais: number;
  desejos: number;
  reserva_investimentos: number;
};

export const normalizeToMonthly = (amount: number, frequency: IncomeFrequency): number => {
  switch (frequency) {
    case "daily": return amount * 30;
    case "weekly": return amount * 4.33;
    case "biweekly": return amount * 2;
    case "monthly": return amount;
    case "once": return amount;
  }
};

export const normalizeToDaily = (amount: number, frequency: IncomeFrequency): number => {
  switch (frequency) {
    case "daily": return amount;
    case "weekly": return amount / 7;
    case "biweekly": return amount / 14;
    case "monthly": return amount / 30;
    case "once": return amount / 30;
  }
};

export const getTotalMonthlyIncome = (sources: IncomeSource[]): number =>
  sources.reduce((sum, s) => sum + normalizeToMonthly(s.amount, s.frequency), 0);

export const getTotalDailyIncome = (sources: IncomeSource[]): number =>
  sources.reduce((sum, s) => sum + normalizeToDaily(s.amount, s.frequency), 0);

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "essenciais",
    name: "Essenciais",
    percentage: 50,
    icon: "Home",
    subcategories: [
      { id: "aluguel", name: "Aluguel", categoryId: "essenciais" },
      { id: "mercado", name: "Mercado", categoryId: "essenciais" },
      { id: "transporte", name: "Transporte", categoryId: "essenciais" },
      { id: "contas", name: "Contas", categoryId: "essenciais" },
    ],
  },
  {
    id: "desejos",
    name: "Desejos",
    percentage: 30,
    icon: "Heart",
    subcategories: [
      { id: "restaurantes", name: "Restaurantes", categoryId: "desejos" },
      { id: "entretenimento", name: "Entretenimento", categoryId: "desejos" },
      { id: "compras", name: "Compras", categoryId: "desejos" },
      { id: "assinaturas", name: "Assinaturas", categoryId: "desejos" },
    ],
  },
  {
    id: "reserva_investimentos",
    name: "Reserva / Investimentos",
    percentage: 20,
    icon: "Shield",
    subcategories: [],
  },
];

export const DEFAULT_EMERGENCY_RESERVES: EmergencyReserve[] = [
  {
    id: "reserva-default",
    name: "Reserva de Emergência",
    targetAmount: 0,
    currentAmount: 0,
    contributions: [],
    pinnedToDashboard: true,
  },
];

export const DEFAULT_GOALS: FinancialGoal[] = [
  {
    id: "meta-default",
    name: "Meta Pessoal",
    targetAmount: 0,
    currentAmount: 0,
    deadline: undefined,
    contributions: [],
    pinnedToDashboard: true,
  },
];

// Auth types (localStorage based)
export interface UserAccount {
  id: string;
  email: string;
  password: string; // In a real app, this would be hashed
  name: string;
  createdAt: string;
}
