import { useState } from "react";
import { Category, Expense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Plus, X, Check, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CategoryDetailProps {
  category: Category;
  budget: number;
  expenses: Expense[];
  getSpentBySubcategory: (id: string) => number;
  onBack: () => void;
  onDeleteExpense: (id: string) => void;
  onToggleExpenseStatus: (id: string) => void;
  onAddSubcategory: (categoryId: string, name: string) => void;
  onDeleteSubcategory: (categoryId: string, subcategoryId: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CategoryDetail = ({ category, budget, expenses, getSpentBySubcategory, onBack, onDeleteExpense, onToggleExpenseStatus, onAddSubcategory, onDeleteSubcategory }: CategoryDetailProps) => {
  const categoryExpenses = expenses.filter((e) => e.categoryId === category.id);
  const totalSpent = categoryExpenses.reduce((s, e) => s + e.amount, 0);
  const pendingTotal = categoryExpenses.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (newName.trim()) {
      onAddSubcategory(category.id, newName.trim());
      setNewName("");
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-lg">{category.name}</h2>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(totalSpent)} de {formatCurrency(budget)}
            {pendingTotal > 0 && (
              <span className="text-warning ml-1">· {formatCurrency(pendingTotal)} pendente</span>
            )}
          </p>
        </div>
      </div>

      {/* Subcategories breakdown */}
      <div className="finance-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subcategorias</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(!adding)}>
            {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {adding ? "Cancelar" : "Nova"}
          </Button>
        </div>

        {adding && (
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Nome da subcategoria"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-9 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-9 px-3" onClick={handleAdd} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {category.subcategories.map((sub) => {
            const spent = getSpentBySubcategory(sub.id);
            return (
              <div key={sub.id} className="flex items-center justify-between group">
                <span className="text-sm">{sub.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-heading">{formatCurrency(spent)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteSubcategory(category.id, sub.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent expenses */}
      <div className="finance-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Despesas Recentes</h3>
        {categoryExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa registrada</p>
        ) : (
          <div className="space-y-2">
            {categoryExpenses
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((expense) => {
                const sub = category.subcategories.find((s) => s.id === expense.subcategoryId);
                return (
                  <div key={expense.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{expense.name}</p>
                        {expense.totalInstallments && expense.totalInstallments > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            {expense.installmentNumber}/{expense.totalInstallments}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub?.name} · {format(parseISO(expense.date), "dd MMM", { locale: ptBR })}
                      </p>
                      {expense.note && <p className="text-xs text-muted-foreground italic mt-0.5">{expense.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-semibold font-heading">{formatCurrency(expense.amount)}</span>
                      <button
                        onClick={() => onToggleExpenseStatus(expense.id)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          expense.status === "paid"
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "bg-warning/15 border-warning/30 text-warning"
                        }`}
                        title={expense.status === "paid" ? "Pago" : "Pendente"}
                      >
                        {expense.status === "paid" ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      </button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteExpense(expense.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryDetail;
