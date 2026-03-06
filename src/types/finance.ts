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

export interface EmergencyFund {
  targetAmount: number;
  currentAmount: number;
  contributions: Contribution[];
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  contributions: Contribution[];
}

export interface Investment {
  id: string;
  name: string;
  amount: number;
  note?: string;
  date: string;
}

export interface FinanceData {
  income: number;
  categories: Category[];
  expenses: Expense[];
  emergencyFund: EmergencyFund;
  financialGoals: FinancialGoal[];
  investments: Investment[];
  currentMonth: string; // YYYY-MM
}

export type Percentages = {
  essenciais: number;
  desejos: number;
  reserva: number;
  investimentos: number;
};

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
    id: "reserva",
    name: "Reserva",
    percentage: 10,
    icon: "Shield",
    subcategories: [],
  },
  {
    id: "investimentos",
    name: "Investimentos",
    percentage: 10,
    icon: "TrendingUp",
    subcategories: [],
  },
];

export const DEFAULT_EMERGENCY_FUND: EmergencyFund = {
  targetAmount: 0,
  currentAmount: 0,
  contributions: [],
};

export const DEFAULT_GOALS: FinancialGoal[] = [
  {
    id: "meta-default",
    name: "Meta Pessoal",
    targetAmount: 0,
    currentAmount: 0,
    deadline: undefined,
    contributions: [],
  },
];
