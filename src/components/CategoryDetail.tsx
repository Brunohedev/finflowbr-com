import { Category, Expense } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CategoryDetailProps {
  category: Category;
  budget: number;
  expenses: Expense[];
  getSpentBySubcategory: (id: string) => number;
  onBack: () => void;
  onDeleteExpense: (id: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CategoryDetail = ({ category, budget, expenses, getSpentBySubcategory, onBack, onDeleteExpense }: CategoryDetailProps) => {
  const categoryExpenses = expenses.filter((e) => e.categoryId === category.id);
  const totalSpent = categoryExpenses.reduce((s, e) => s + e.amount, 0);

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
          </p>
        </div>
      </div>

      {/* Subcategories breakdown */}
      <div className="finance-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subcategorias</h3>
        <div className="space-y-3">
          {category.subcategories.map((sub) => {
            const spent = getSpentBySubcategory(sub.id);
            return (
              <div key={sub.id} className="flex items-center justify-between">
                <span className="text-sm">{sub.name}</span>
                <span className="text-sm font-semibold font-heading">{formatCurrency(spent)}</span>
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
                      <p className="text-sm font-medium truncate">{expense.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub?.name} · {format(parseISO(expense.date), "dd MMM", { locale: ptBR })}
                      </p>
                      {expense.note && <p className="text-xs text-muted-foreground italic mt-0.5">{expense.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-semibold font-heading">{formatCurrency(expense.amount)}</span>
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
