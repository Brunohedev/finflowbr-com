import { useMemo, useState } from "react";
import { Category, Expense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface CategoryCardProps {
  category: Category;
  budget: number;
  spent: number;
  expenses: Expense[];
  onClick: () => void;
  onAddExpense?: (categoryId: string) => void;
  onAddInvestment?: (name: string, amount: number, note?: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

const CategoryCard = ({ category, budget, spent, onClick, onAddExpense, onAddInvestment }: CategoryCardProps) => {
  const [showAddValue, setShowAddValue] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
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
    reserva_investimentos: "🛡️",
  };

  const showAddExpense = category.id !== "reserva_investimentos" && onAddExpense;
  const isReserva = category.id === "reserva_investimentos";

  return (
    <div className="finance-card w-full text-left group">
      <button onClick={onClick} className="w-full text-left cursor-pointer">
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
            {!isReserva && <span>Limite: {formatCurrency(budget)}</span>}
          </div>
          {!isReserva && (
            <>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${status.color}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className={`text-right text-xs font-medium ${remaining >= 0 ? "text-primary" : "text-destructive"}`}>
                {remaining >= 0 ? `Restam ${formatCurrency(remaining)}` : `Excedido em ${formatCurrency(Math.abs(remaining))}`}
              </p>
            </>
          )}
        </div>
      </button>
      {showAddExpense && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 h-8 text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); onAddExpense(category.id); }}
        >
          <Plus className="w-3 h-3" /> Nova despesa
        </Button>
      )}
      {isReserva && onAddInvestment && (
        showAddValue ? (
          <div className="space-y-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
              <Input placeholder="0,00" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className="h-8 text-xs pl-9" inputMode="decimal" autoFocus />
            </div>
            <Input placeholder="Descrição (opcional)" value={addNote} onChange={(e) => setAddNote(e.target.value)} className="h-8 text-xs" />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                disabled={parseNum(addAmount) <= 0}
                onClick={() => {
                  const val = parseNum(addAmount);
                  if (val > 0) {
                    onAddInvestment("Aporte geral", val, addNote.trim() || undefined);
                    setAddAmount(""); setAddNote(""); setShowAddValue(false);
                  }
                }}
              >
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAddValue(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 h-8 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); setShowAddValue(true); }}
          >
            <Plus className="w-3 h-3" /> Adicionar valor
          </Button>
        )
      )}
    </div>
);

export default CategoryCard;
