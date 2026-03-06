import { useMemo } from "react";
import { Category, Expense } from "@/types/finance";

interface CategoryCardProps {
  category: Category;
  budget: number;
  spent: number;
  expenses: Expense[];
  onClick: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CategoryCard = ({ category, budget, spent, onClick }: CategoryCardProps) => {
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;

  const status = useMemo(() => {
    if (percentage >= 100) return { color: "bg-destructive", textColor: "text-destructive", label: "Excedido" };
    if (percentage >= 80) return { color: "bg-warning", textColor: "text-warning", label: "Atenção" };
    return { color: "bg-primary", textColor: "text-primary", label: "No limite" };
  }, [percentage]);

  const emojis: Record<string, string> = {
    essenciais: "🏠",
    desejos: "💜",
    reserva: "🛡️",
    investimentos: "📈",
  };

  return (
    <button onClick={onClick} className="finance-card w-full text-left group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{emojis[category.id] || "📊"}</span>
          <div>
            <h3 className="font-semibold font-heading text-sm">{category.name}</h3>
            <p className="text-xs text-muted-foreground">{category.percentage}% da renda</p>
          </div>
        </div>
        {percentage >= 80 && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}/15 ${status.textColor}`}>
            {status.label}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Usado: {formatCurrency(spent)}</span>
          <span>Limite: {formatCurrency(budget)}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${status.color}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <p className={`text-right text-xs font-medium ${remaining >= 0 ? "text-primary" : "text-destructive"}`}>
          {remaining >= 0 ? `Restam ${formatCurrency(remaining)}` : `Excedido em ${formatCurrency(Math.abs(remaining))}`}
        </p>
      </div>
    </button>
  );
};

export default CategoryCard;
