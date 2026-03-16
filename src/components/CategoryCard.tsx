import { useMemo, useState } from "react";
import { Category, Expense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SavingsTracker from "@/components/SavingsTracker";
import { Plus, Target, PiggyBank, TrendingUp } from "lucide-react";

interface CategoryCardProps {
  category: Category;
  budget: number;
  spent: number;
  expenses: Expense[];
  onClick: () => void;
  onAddExpense?: (categoryId: string) => void;
  onAddInvestment?: (name: string, amount: number, note?: string) => void;
  onAddReserveContribution?: (reserveId: string, amount: number, note?: string) => void;
  onUpdateReserveTarget?: (newTarget: number) => void;
  reserveTotal?: number;
  reserveTarget?: number;
  investmentTotal?: number;
  firstReserveId?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

type AddMode = null | "reserve" | "investment";

const CategoryCard = ({
  category, budget, spent, onClick, onAddExpense, onAddInvestment,
  onAddReserveContribution, onUpdateReserveTarget,
  reserveTotal = 0, reserveTarget = 0, investmentTotal = 0, firstReserveId
}: CategoryCardProps) => {
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [customTarget, setCustomTarget] = useState("");

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

  const reservePct = reserveTarget > 0 ? Math.min((reserveTotal / reserveTarget) * 100, 100) : 0;
  const reserveGoalReached = reserveTarget > 0 && reserveTotal >= reserveTarget;
  const suggestedNewTarget = reserveTarget > 0 ? reserveTarget * 2 : reserveTotal * 2;

  const handleAddReserve = () => {
    const val = parseNum(addAmount);
    if (val > 0 && onAddReserveContribution && firstReserveId) {
      onAddReserveContribution(firstReserveId, val, addNote.trim() || undefined);
      setAddAmount(""); setAddNote(""); setAddMode(null);
    }
  };

  const handleAddInvestment = () => {
    const val = parseNum(addAmount);
    if (val > 0 && onAddInvestment) {
      onAddInvestment("Investimento", val, addNote.trim() || undefined);
      setAddAmount(""); setAddNote(""); setAddMode(null);
    }
  };

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
          {!isReserva && percentage >= 80 && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}/15 ${status.textColor}`}>
              {status.label}
            </span>
          )}
        </div>

        {!isReserva && (
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
        )}

        {isReserva && (
          <div className="space-y-3">
            {/* Reserva section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {reserveGoalReached ? <Trophy className="w-3 h-3 text-[hsl(217,91%,60%)]" /> : <Shield className="w-3 h-3 text-[hsl(217,91%,60%)]" />}
                <span className="text-xs font-medium">Reserva</span>
                {reserveGoalReached && <span className="text-[9px] font-bold text-[hsl(217,91%,60%)] bg-[hsl(217,91%,60%)]/10 px-1.5 py-0.5 rounded-full">Meta atingida! 🎉</span>}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{formatCurrency(reserveTotal)}</span>
                <span>{reserveTarget > 0 ? `Meta: ${formatCurrency(reserveTarget)}` : "Sem meta"}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-[hsl(217,91%,60%)] transition-all duration-500" style={{ width: `${reserveTarget > 0 ? reservePct : (reserveTotal > 0 ? 100 : 0)}%` }} />
              </div>
            </div>

            {/* Goal reached suggestion */}
            {reserveGoalReached && onUpdateReserveTarget && (
              <div className="bg-[hsl(217,91%,60%)]/10 rounded-lg p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-[11px] text-[hsl(217,91%,60%)] font-medium">Continue sua jornada! Nova meta sugerida:</p>
                <Button size="sm" className="w-full h-7 text-[10px] bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)]"
                  onClick={() => onUpdateReserveTarget(suggestedNewTarget)}>
                  <Target className="w-3 h-3 mr-1" /> {formatCurrency(suggestedNewTarget)}
                </Button>
              </div>
            )}

            {/* Set initial target */}
            {!reserveTarget && onUpdateReserveTarget && (
              <div className="space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                  <Input placeholder="Definir meta..." value={customTarget} onChange={(e) => setCustomTarget(e.target.value)}
                    className="h-7 text-xs pl-9" inputMode="decimal" />
                </div>
                {parseNum(customTarget) > 0 && (
                  <Button size="sm" className="w-full h-7 text-[10px] bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)]"
                    onClick={() => { onUpdateReserveTarget(parseNum(customTarget)); setCustomTarget(""); }}>
                    <Target className="w-3 h-3 mr-1" /> Definir meta
                  </Button>
                )}
              </div>
            )}

            {/* Investimentos section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-accent-foreground" />
                <span className="text-xs font-medium">Investimentos</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{formatCurrency(investmentTotal)}</span>
                <span>este mês</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${investmentTotal > 0 ? 100 : 0}%` }} />
              </div>
            </div>
          </div>
        )}
      </button>

      {/* Regular category: add expense */}
      {showAddExpense && (
        <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); onAddExpense(category.id); }}>
          <Plus className="w-3 h-3" /> Nova despesa
        </Button>
      )}

      {/* Reserva / Investimentos: two action buttons */}
      {isReserva && (onAddReserveContribution || onAddInvestment) && addMode === null && (
        <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          {onAddReserveContribution && firstReserveId && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1 flex-col py-1"
              onClick={() => setAddMode("reserve")}>
              <PiggyBank className="w-4 h-4 text-[hsl(217,91%,60%)]" />
              <span>Adicionar à Reserva</span>
            </Button>
          )}
          {onAddInvestment && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1 flex-col py-1"
              onClick={() => setAddMode("investment")}>
              <TrendingUp className="w-4 h-4 text-accent-foreground" />
              <span>Adicionar aos Investimentos</span>
            </Button>
          )}
        </div>
      )}

      {/* Add to Reserva form */}
      {isReserva && addMode === "reserve" && (
        <div className="space-y-2 mt-3 p-3 rounded-lg bg-[hsl(217,91%,60%)]/5 border border-[hsl(217,91%,60%)]/20"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-[hsl(217,91%,60%)]" />
            <span className="text-xs font-semibold">Adicionar à Reserva</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
            <Input placeholder="0,00" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
              className="h-8 text-xs pl-9" inputMode="decimal" autoFocus />
          </div>
          <Input placeholder="Nota (opcional)" value={addNote} onChange={(e) => setAddNote(e.target.value)}
            className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)]"
              disabled={parseNum(addAmount) <= 0} onClick={handleAddReserve}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => { setAddMode(null); setAddAmount(""); setAddNote(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Add to Investimentos form */}
      {isReserva && addMode === "investment" && (
        <div className="space-y-2 mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-foreground" />
            <span className="text-xs font-semibold">Adicionar aos Investimentos</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
            <Input placeholder="0,00" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
              className="h-8 text-xs pl-9" inputMode="decimal" autoFocus />
          </div>
          <Input placeholder="Nota (opcional)" value={addNote} onChange={(e) => setAddNote(e.target.value)}
            className="h-8 text-xs" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs"
              disabled={parseNum(addAmount) <= 0} onClick={handleAddInvestment}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => { setAddMode(null); setAddAmount(""); setAddNote(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryCard;