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

export interface FinanceData {
  income: number;
  categories: Category[];
  expenses: Expense[];
  currentMonth: string; // YYYY-MM
}

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
    name: "Reserva / Investimentos",
    percentage: 20,
    icon: "TrendingUp",
    subcategories: [
      { id: "emergencia", name: "Fundo de Emergência", categoryId: "reserva" },
      { id: "acoes", name: "Ações", categoryId: "reserva" },
      { id: "crypto", name: "Crypto", categoryId: "reserva" },
      { id: "aposentadoria", name: "Aposentadoria", categoryId: "reserva" },
    ],
  },
];
