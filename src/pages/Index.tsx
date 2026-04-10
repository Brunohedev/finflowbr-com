import { useState, useRef, useEffect } from "react";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/components/LoginScreen";
import SetupWizard from "@/components/SetupWizard";
import CategoryCard from "@/components/CategoryCard";
import CategoryDetail from "@/components/CategoryDetail";
import ExpenseDialog from "@/components/ExpenseDialog";
import SettingsDialog from "@/components/SettingsDialog";
import ReservaInvestimentosView from "@/components/ReservaInvestimentosView";
import SavingsTracker from "@/components/SavingsTracker";
import MonthlyReportPage from "@/components/report/MonthlyReportPage";

import PinnedItems from "@/components/PinnedItems";
import EndOfMonthPrediction from "@/components/EndOfMonthPrediction";
import FinancialInsightsBanner from "@/components/FinancialInsightsBanner";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Wallet, CalendarDays, LogOut, TrendingDown, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Percentages } from "@/types/finance";

const formatCurrency = (value: number) =>
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type View = "dashboard" | "category" | "report" | "reserva_investimentos";

const Index = () => {
  const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const selectedMonth = format(displayMonth, "yyyy-MM");

  const {
    data, isSetup, isSyncLoading, monthlyIncome, remainingToday, remainingMonth, activeMonth, monthPercentages,
    setupBudget, addExpense, deleteExpense, toggleExpenseStatus,
    updatePercentages, updateIncome, resetMonth, setMonthSalary, monthSavingsExtra, monthSavingsTotal,
    addSubcategory, deleteSubcategory,
    getSpentByCategory, getSpentBySubcategory, getBudget,
    addIncomeSource, deleteIncomeSource,
    addEmergencyReserve, deleteEmergencyReserve, updateEmergencyReserve,
    addReserveContribution, toggleReservePin,
    addFinancialGoal, deleteFinancialGoal, addGoalContribution, updateGoal, toggleGoalPin,
    addInvestment, deleteInvestment,
    addRecurringExpense, deleteRecurringExpense, toggleRecurringExpense
  } = useFinanceData(user?.id, selectedMonth);

  const [view, setView] = useState<View>("dashboard");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDefaultCategory, setExpenseDefaultCategory] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");
  const salaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSalary && salaryInputRef.current) {
      salaryInputRef.current.focus();
      salaryInputRef.current.select();
    }
  }, [editingSalary]);

  // Show loading while checking auth
  if (isLoading || isSyncLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} onRegister={register} />;
  }

  if (!isSetup || !data) {
    return <SetupWizard onComplete={setupBudget} />;
  }

  const totalSpent = data.categories.reduce((sum, category) => sum + getSpentByCategory(category.id), 0);
  const selectedCategory = data.categories.find((c) => c.id === selectedCategoryId);
  const moneyLeft = monthlyIncome - totalSpent;

  // Compute reserve & investment totals for the card
  const reserveTotal = data.emergencyReserves.reduce((s, r) => s + r.currentAmount, 0);
  const reserveTarget = data.emergencyReserves.reduce((s, r) => s + r.targetAmount, 0);
  const investmentTotal = data.investments.
  filter((i) => i.date.startsWith(activeMonth)).
  reduce((s, i) => s + i.amount, 0);

  const handleCategoryClick = (catId: string) => {
    if (catId === "reserva_investimentos") {
      setView("reserva_investimentos");
    } else {
      setSelectedCategoryId(catId);
      setView("category");
    }
  };

  const handleAddExpenseFromCategory = (categoryId: string) => {
    setExpenseDefaultCategory(categoryId);
    setExpenseOpen(true);
  };

  const goBack = () => {
    setView("dashboard");
    setSelectedCategoryId(null);
  };

  const pcts = monthPercentages;

  // Pending expenses count
  const pendingCount = data.expenses.filter((e) => e.status === "pending" && e.date.startsWith(activeMonth)).length;
  const monthExpenses = data.expenses.filter((e) => e.date.startsWith(activeMonth));

  return (
    <div className="min-h-screen pb-24 bg-[#ecf3f0]">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-20 relative overflow-hidden" style={{ mixBlendMode: 'multiply' }}>
              <video
                autoPlay
                muted
                playsInline
                className="h-full w-full object-contain"
                src="/finflow-logo.mp4"
              />
            </div>
            {user && <p className="text-[10px] text-muted-foreground leading-none">{user.user_metadata?.name || user.email}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "report" ? "secondary" : "ghost"}
              size="icon" className="rounded-xl"
              onClick={() => setView(view === "report" ? "dashboard" : "report")}>
              <CalendarDays className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5">
        {view === "report" ?
        <MonthlyReportPage
          data={data}
          monthlyIncome={monthlyIncome}
          getSpentByCategory={getSpentByCategory}
          getBudget={getBudget}
          onBack={goBack}
          onToggleExpenseStatus={toggleExpenseStatus} /> :

        view === "reserva_investimentos" ?
        <ReservaInvestimentosView
          budget={getBudget("reserva_investimentos")}
          spent={getSpentByCategory("reserva_investimentos")}
          emergencyReserves={data.emergencyReserves}
          financialGoals={data.financialGoals}
          investments={data.investments}
          currentMonth={data.currentMonth}
          onBack={goBack}
          onAddReserve={addEmergencyReserve}
          onDeleteReserve={deleteEmergencyReserve}
          onUpdateReserve={updateEmergencyReserve}
          onAddReserveContribution={addReserveContribution}
          onToggleReservePin={toggleReservePin}
          onAddGoal={addFinancialGoal}
          onDeleteGoal={deleteFinancialGoal}
          onAddGoalContribution={addGoalContribution}
          onUpdateGoal={updateGoal}
          onToggleGoalPin={toggleGoalPin}
          onAddInvestment={addInvestment}
          onDeleteInvestment={deleteInvestment} /> :

        view === "category" && selectedCategory ?
        <CategoryDetail
          category={selectedCategory}
          budget={getBudget(selectedCategory.id)}
          expenses={monthExpenses}
          getSpentBySubcategory={getSpentBySubcategory}
          onBack={goBack}
          onDeleteExpense={deleteExpense}
          onToggleExpenseStatus={toggleExpenseStatus}
          onAddSubcategory={addSubcategory}
          onDeleteSubcategory={deleteSubcategory} /> :


        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-heading font-semibold capitalize text-sm">
                {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* 1️⃣ Money Left This Month — PRIMARY METRIC */}
            <div className="finance-card text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Dinheiro Restante Este Mês</p>
              <p className={`text-4xl font-bold font-heading ${moneyLeft >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(moneyLeft)}
              </p>
              <div className="flex items-center justify-center gap-1">
                {moneyLeft >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-primary" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                <p className="text-xs text-muted-foreground">
                  Renda:{" "}
                  {editingSalary ? (
                    <input
                      ref={salaryInputRef}
                      type="number"
                      className="inline w-24 bg-transparent border-b border-primary text-xs font-medium text-foreground outline-none px-1"
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      onBlur={() => {
                        const val = parseFloat(salaryInput);
                        if (!isNaN(val) && val > 0) setMonthSalary(activeMonth, val);
                        setEditingSalary(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingSalary(false);
                      }}
                    />
                  ) : (
                    <span
                      className="cursor-pointer border-b border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-colors"
                      onClick={() => { setSalaryInput(String(monthlyIncome)); setEditingSalary(true); }}
                    >
                      {formatCurrency(monthlyIncome)}
                    </span>
                  )}
                  {" "}· Gastos: {formatCurrency(totalSpent)}
                </p>
              </div>
              {pendingCount > 0 &&
            <p className="text-[10px] text-warning">
                  {pendingCount} despesa{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}
                </p>
            }
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
              className={`h-full rounded-full transition-all duration-500 ${
              totalSpent / monthlyIncome >= 1 ? "bg-destructive" : totalSpent / monthlyIncome >= 0.8 ? "bg-warning" : "bg-primary"}`
              }
              style={{ width: `${Math.min(totalSpent / (monthlyIncome || 1) * 100, 100)}%` }} />
            
            </div>

            {/* 2️⃣ Budget Allocation Overview */}
            <div className="finance-card">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alocação do Orçamento</h3>
              <div className="space-y-3">
                {data.categories.map((cat) => {
                  const budget = getBudget(cat.id);
                  const spent = getSpentByCategory(cat.id);
                  const pct = budget > 0 ? spent / budget * 100 : 0;

                  if (cat.id === "reserva_investimentos") {
                    const monthContributions = data.emergencyReserves.reduce((s, r) =>
                      s + r.contributions.filter(c => c.date.startsWith(activeMonth)).reduce((a, c) => a + c.amount, 0), 0);
                    const monthInvestments = data.investments
                      .filter(i => i.date.startsWith(activeMonth))
                      .reduce((s, i) => s + i.amount, 0);
                    const monthlySaved = monthContributions + monthInvestments;

                    return (
                      <SavingsTracker
                        key={cat.id}
                        monthlyIncome={monthlyIncome}
                        savingsPercentage={pcts.reserva_investimentos}
                        monthlySaved={monthSavingsTotal}
                        totalReserve={reserveTotal}
                        currentGoal={reserveTarget || 10000}
                        extraContributions={monthSavingsExtra}
                      />
                    );
                  }

                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{cat.name} – {pcts[cat.id as keyof Percentages] ?? cat.percentage}% ({formatCurrency(budget)})</span>
                        <span className={`font-medium ${pct >= 100 ? "text-destructive" : pct >= 80 ? "text-warning" : "text-primary"}`}>
                          {formatCurrency(spent)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3️⃣ Financial Insights Banner */}
            <FinancialInsightsBanner
            data={data}
            monthlyIncome={monthlyIncome}
            activeMonth={activeMonth}
            getSpentByCategory={getSpentByCategory} />
          

            {/* Remaining today / month cards */}
            <div className="grid grid-cols-2 gap-3">
              







            
              







            
            </div>

            {/* Pinned items */}
            <PinnedItems
            reserves={data.emergencyReserves}
            goals={data.financialGoals}
            onUnpinReserve={toggleReservePin}
            onUnpinGoal={toggleGoalPin}
            onNavigateToReserva={() => handleCategoryClick("reserva_investimentos")} />
          

            {/* End of month prediction */}
            <EndOfMonthPrediction
            data={data}
            activeMonth={activeMonth}
            monthlyIncome={monthlyIncome}
            monthSavingsUsed={getSpentByCategory("reserva_investimentos")}
            getSpentByCategory={getSpentByCategory}
            onAddReserveContribution={addReserveContribution}
            onAddInvestment={addInvestment}
            firstReserveId={data.emergencyReserves[0]?.id} />
          

            {/* Categories */}
            <div className="space-y-3">
            {data.categories.map((cat) => {
              const isReserva = cat.id === "reserva_investimentos";

              return (
                <CategoryCard
                  key={cat.id}
                  category={{ ...cat, percentage: pcts[cat.id as keyof Percentages] ?? cat.percentage }}
                  budget={getBudget(cat.id)}
                  spent={getSpentByCategory(cat.id)}
                  expenses={monthExpenses.filter((e) => e.categoryId === cat.id)}
                  onClick={() => handleCategoryClick(cat.id)}
                  onAddExpense={handleAddExpenseFromCategory}
                  onAddInvestment={isReserva ? addInvestment : undefined}
                  onAddReserveContribution={isReserva ? addReserveContribution : undefined}
                  onUpdateReserveTarget={isReserva ? (newTarget: number) => {
                    const firstReserve = data.emergencyReserves[0];
                    if (firstReserve) updateEmergencyReserve(firstReserve.id, { targetAmount: newTarget });
                  } : undefined}
                  reserveTotal={isReserva ? reserveTotal : undefined}
                  reserveTarget={isReserva ? reserveTarget : undefined}
                  investmentTotal={isReserva ? investmentTotal : undefined}
                  firstReserveId={isReserva ? data.emergencyReserves[0]?.id : undefined}
                  monthlyIncome={isReserva ? monthlyIncome : undefined}
                  monthlySaved={isReserva ? monthSavingsTotal : undefined}
                  extraContributions={isReserva ? monthSavingsExtra : undefined}
                />
              );
            })}
            </div>

            {/* Recent expenses */}
            {monthExpenses.length > 0 &&
          <div className="finance-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Últimas Despesas</h3>
                <div className="space-y-2">
                  {monthExpenses.
              sort((a, b) => b.date.localeCompare(a.date)).
              slice(0, 5).
              map((expense) => {
                const cat = data.categories.find((c) => c.id === expense.categoryId);
                return (
                  <div key={expense.id} className="flex items-center justify-between py-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{expense.name}</p>
                              {expense.totalInstallments && expense.totalInstallments > 1 &&
                        <span className="text-[10px] text-muted-foreground shrink-0">
                                  {expense.installmentNumber}/{expense.totalInstallments}
                                </span>
                        }
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${expense.status === "paid" ? "bg-primary" : "bg-warning"}`} />
                            </div>
                            <p className="text-xs text-muted-foreground">{cat?.name}</p>
                          </div>
                          <span className="text-sm font-semibold font-heading ml-3">{formatCurrency(expense.amount)}</span>
                        </div>);

              })}
                </div>
              </div>
          }
          </div>
        }
      </main>

      {view === "dashboard" &&
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <Button
          size="lg"
          className="rounded-full h-14 px-6 shadow-lg shadow-primary/25 font-semibold text-base"
          onClick={() => {setExpenseDefaultCategory(undefined);setExpenseOpen(true);}}>
          
            <Plus className="w-5 h-5 mr-2" /> Nova Despesa
          </Button>
        </div>
      }

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        categories={data.categories}
        defaultCategoryId={expenseDefaultCategory}
        onAdd={addExpense} />
      

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        income={monthlyIncome}
        incomeSources={data.incomeSources}
        percentages={pcts}
        activeMonth={activeMonth}
        onSave={(p, income) => { updatePercentages(p); setMonthSalary(activeMonth, income); }}
        onReset={resetMonth}
        onAddSource={addIncomeSource}
        onDeleteSource={deleteIncomeSource} />
      
    </div>);

};

export default Index;