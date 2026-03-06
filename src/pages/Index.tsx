import { useState } from "react";
import { useFinanceData } from "@/hooks/useFinanceData";
import SetupWizard from "@/components/SetupWizard";
import CategoryCard from "@/components/CategoryCard";
import CategoryDetail from "@/components/CategoryDetail";
import ExpenseDialog from "@/components/ExpenseDialog";
import AnalyticsView from "@/components/AnalyticsView";
import SettingsDialog from "@/components/SettingsDialog";
import ReservaView from "@/components/ReservaView";
import InvestimentosView from "@/components/InvestimentosView";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, Settings, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Percentages } from "@/types/finance";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type View = "dashboard" | "category" | "analytics" | "reserva" | "investimentos";

const Index = () => {
  const {
    data, isSetup, setupBudget, addExpense, deleteExpense,
    updatePercentages, updateIncome, resetMonth,
    addSubcategory, deleteSubcategory,
    getSpentByCategory, getSpentBySubcategory, getBudget,
    updateEmergencyFundTarget, addEmergencyContribution,
    addFinancialGoal, deleteFinancialGoal, addGoalContribution, updateGoal,
    addInvestment, deleteInvestment,
  } = useFinanceData();

  const [view, setView] = useState<View>("dashboard");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!isSetup || !data) {
    return <SetupWizard onComplete={setupBudget} />;
  }

  const totalSpent = data.categories.reduce((s, cat) => s + getSpentByCategory(cat.id), 0);
  const selectedCategory = data.categories.find((c) => c.id === selectedCategoryId);
  const currentMonth = format(new Date(), "MMMM yyyy", { locale: ptBR });

  const handleCategoryClick = (catId: string) => {
    if (catId === "reserva") {
      setView("reserva");
    } else if (catId === "investimentos") {
      setView("investimentos");
    } else {
      setSelectedCategoryId(catId);
      setView("category");
    }
  };

  const goBack = () => {
    setView("dashboard");
    setSelectedCategoryId(null);
  };

  const pcts: Percentages = {
    essenciais: data.categories.find((c) => c.id === "essenciais")?.percentage ?? 50,
    desejos: data.categories.find((c) => c.id === "desejos")?.percentage ?? 30,
    reserva: data.categories.find((c) => c.id === "reserva")?.percentage ?? 10,
    investimentos: data.categories.find((c) => c.id === "investimentos")?.percentage ?? 10,
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <span className="font-heading font-bold text-lg">FinFlow</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "analytics" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-xl"
              onClick={() => setView(view === "analytics" ? "dashboard" : "analytics")}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5">
        {view === "analytics" ? (
          <AnalyticsView data={data} getSpentByCategory={getSpentByCategory} getBudget={getBudget} />
        ) : view === "reserva" ? (
          <ReservaView
            budget={getBudget("reserva")}
            spent={getSpentByCategory("reserva")}
            emergencyFund={data.emergencyFund}
            financialGoals={data.financialGoals}
            onBack={goBack}
            onUpdateEmergencyTarget={updateEmergencyFundTarget}
            onAddEmergencyContribution={addEmergencyContribution}
            onAddGoal={addFinancialGoal}
            onDeleteGoal={deleteFinancialGoal}
            onAddGoalContribution={addGoalContribution}
            onUpdateGoal={updateGoal}
          />
        ) : view === "investimentos" ? (
          <InvestimentosView
            budget={getBudget("investimentos")}
            spent={getSpentByCategory("investimentos")}
            investments={data.investments}
            currentMonth={data.currentMonth}
            onBack={goBack}
            onAddInvestment={addInvestment}
            onDeleteInvestment={deleteInvestment}
          />
        ) : view === "category" && selectedCategory ? (
          <CategoryDetail
            category={selectedCategory}
            budget={getBudget(selectedCategory.id)}
            expenses={data.expenses}
            getSpentBySubcategory={getSpentBySubcategory}
            onBack={goBack}
            onDeleteExpense={deleteExpense}
            onAddSubcategory={addSubcategory}
            onDeleteSubcategory={deleteSubcategory}
          />
        ) : (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{currentMonth}</p>
              <p className="text-3xl font-bold font-heading">{formatCurrency(data.income)}</p>
              <p className="text-sm text-muted-foreground">
                Utilizado: {formatCurrency(totalSpent)} · Restam: {formatCurrency(data.income - totalSpent)}
              </p>
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  totalSpent / data.income >= 1 ? "bg-destructive" : totalSpent / data.income >= 0.8 ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${Math.min((totalSpent / data.income) * 100, 100)}%` }}
              />
            </div>

            <div className="space-y-3">
              {data.categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  budget={getBudget(cat.id)}
                  spent={getSpentByCategory(cat.id)}
                  expenses={data.expenses.filter((e) => e.categoryId === cat.id)}
                  onClick={() => handleCategoryClick(cat.id)}
                />
              ))}
            </div>

            {data.expenses.length > 0 && (
              <div className="finance-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Últimas Despesas</h3>
                <div className="space-y-2">
                  {data.expenses
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5)
                    .map((expense) => {
                      const cat = data.categories.find((c) => c.id === expense.categoryId);
                      return (
                        <div key={expense.id} className="flex items-center justify-between py-1.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{expense.name}</p>
                            <p className="text-xs text-muted-foreground">{cat?.name}</p>
                          </div>
                          <span className="text-sm font-semibold font-heading ml-3">{formatCurrency(expense.amount)}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {view === "dashboard" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <Button
            size="lg"
            className="rounded-full h-14 px-6 shadow-lg shadow-primary/25 font-semibold text-base"
            onClick={() => setExpenseOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" /> Nova Despesa
          </Button>
        </div>
      )}

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        categories={data.categories}
        defaultCategoryId={selectedCategoryId || undefined}
        onAdd={addExpense}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        income={data.income}
        percentages={pcts}
        onSave={(income, p) => { updateIncome(income); updatePercentages(p); }}
        onReset={resetMonth}
      />
    </div>
  );
};

export default Index;
