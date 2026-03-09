import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Target, PiggyBank, BarChart,
  Plus, Trash2, RotateCcw, Lightbulb, CalendarClock, Clock, AlertTriangle, CheckCircle2
} from "lucide-react";
import { FinanceData, RecurringFrequency } from "@/types/finance";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const frequencyLabels: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

const frequencyToMonthly = (amount: number, freq: RecurringFrequency) => {
  switch (freq) {
    case "weekly": return amount * 4.33;
    case "monthly": return amount;
    case "yearly": return amount / 12;
  }
};

interface AdvancedDashboardProps {
  data: FinanceData;
  monthlyIncome: number;
  getSpentByCategory: (categoryId: string) => number;
  onBack: () => void;
  onAddRecurring: (name: string, amount: number, frequency: RecurringFrequency, categoryId: string, subcategoryId?: string) => void;
  onDeleteRecurring: (id: string) => void;
  onToggleRecurring: (id: string) => void;
}

const AdvancedDashboard = ({
  data, monthlyIncome, getSpentByCategory, onBack,
  onAddRecurring, onDeleteRecurring, onToggleRecurring,
}: AdvancedDashboardProps) => {
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [annualReturn, setAnnualReturn] = useState(10);
  const [timePeriod, setTimePeriod] = useState(10);

  // New recurring expense form
  const [newRecName, setNewRecName] = useState("");
  const [newRecAmount, setNewRecAmount] = useState("");
  const [newRecFreq, setNewRecFreq] = useState<RecurringFrequency>("monthly");
  const [newRecCategory, setNewRecCategory] = useState("");

  // Financial metrics
  const totalSaved = data.emergencyReserves.reduce((s, r) => s + r.currentAmount, 0);
  const totalInvestments = data.investments.reduce((s, i) => s + i.amount, 0);
  const activeGoals = data.financialGoals.length;
  const totalGoalProgress = data.financialGoals.reduce((s, g) => s + g.currentAmount, 0);

  // Recurring expenses monthly total
  const recurringMonthlyTotal = useMemo(() =>
    data.recurringExpenses.filter((r) => r.active).reduce((s, r) => s + frequencyToMonthly(r.amount, r.frequency), 0),
    [data.recurringExpenses]
  );

  // Compound interest simulation
  const simulationData = useMemo(() => {
    const monthlyRate = annualReturn / 100 / 12;
    const totalMonths = timePeriod * 12;
    const result = [];
    let balance = currentBalance;
    for (let month = 0; month <= totalMonths; month++) {
      const totalInvested = currentBalance + monthlyContribution * month;
      result.push({ month, year: Math.floor(month / 12), balance, totalInvested, totalProfit: balance - totalInvested });
      if (month < totalMonths) balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }
    return result;
  }, [monthlyContribution, currentBalance, annualReturn, timePeriod]);

  const finalBalance = simulationData[simulationData.length - 1];
  const yearlyData = simulationData.filter((_, i) => i % 12 === 0);

  // Automated insights
  const insights = useMemo(() => {
    const list: { type: "success" | "warning" | "info"; text: string }[] = [];
    const totalSpent = data.categories.reduce((s, cat) => s + getSpentByCategory(cat.id), 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - totalSpent) / monthlyIncome) * 100 : 0;

    if (savingsRate >= 20) list.push({ type: "success", text: `Ótimo! Você está economizando ${savingsRate.toFixed(0)}% da sua renda este mês.` });
    else if (savingsRate >= 0) list.push({ type: "warning", text: `Sua taxa de poupança está em ${savingsRate.toFixed(0)}%. Tente chegar a 20% para ter maior segurança.` });
    else list.push({ type: "warning", text: `Atenção! Seus gastos estão superando sua renda em ${formatCurrency(Math.abs(monthlyIncome - totalSpent))}.` });

    if (recurringMonthlyTotal > monthlyIncome * 0.5) {
      list.push({ type: "warning", text: `Despesas recorrentes representam ${((recurringMonthlyTotal / monthlyIncome) * 100).toFixed(0)}% da renda. Avalie cancelar assinaturas não essenciais.` });
    }

    const essenciaisSpent = getSpentByCategory("essenciais");
    const essenciaisBudget = data.categories.find((c) => c.id === "essenciais");
    if (essenciaisBudget && essenciaisSpent > (monthlyIncome * essenciaisBudget.percentage / 100)) {
      list.push({ type: "warning", text: "Gastos essenciais ultrapassaram o orçamento. Revise aluguel, mercado e contas." });
    }

    const desejosSpent = getSpentByCategory("desejos");
    const desejosBudget = data.categories.find((c) => c.id === "desejos");
    if (desejosBudget && desejosSpent < (monthlyIncome * desejosBudget.percentage / 100) * 0.5) {
      list.push({ type: "success", text: "Seus gastos com desejos estão bem controlados. Continue assim!" });
    }

    const goalsWithDeadline = data.financialGoals.filter((g) => g.deadline && g.currentAmount < g.targetAmount);
    goalsWithDeadline.forEach((g) => {
      const daysLeft = differenceInDays(parseISO(g.deadline!), new Date());
      if (daysLeft > 0 && daysLeft <= 30) {
        const remaining = g.targetAmount - g.currentAmount;
        list.push({ type: "info", text: `Meta "${g.name}" vence em ${daysLeft} dias. Faltam ${formatCurrency(remaining)}.` });
      }
    });

    if (totalSaved > 0 && data.emergencyReserves.some((r) => r.currentAmount >= r.targetAmount && r.targetAmount > 0)) {
      list.push({ type: "success", text: "Parabéns! Você atingiu a meta de uma reserva de emergência. Considere aumentar a meta." });
    }

    if (list.length === 0) list.push({ type: "info", text: "Continue registrando suas despesas para receber insights personalizados." });
    return list;
  }, [data, monthlyIncome, getSpentByCategory, recurringMonthlyTotal, totalSaved]);

  const chartConfig = {
    totalInvested: { label: "Total Investido", color: "hsl(var(--muted-foreground))" },
    totalProfit: { label: "Lucro Acumulado", color: "hsl(var(--accent))" },
  };

  const handleAddRecurring = () => {
    if (!newRecName || !newRecAmount || !newRecCategory) return;
    onAddRecurring(newRecName, Number(newRecAmount), newRecFreq, newRecCategory);
    setNewRecName("");
    setNewRecAmount("");
    setNewRecCategory("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold font-heading">Dashboard Avançado</h1>
          <p className="text-sm text-muted-foreground">Análise completa e simulações financeiras</p>
        </div>
      </div>

      {/* 1. Financial Overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">SALDO TOTAL</p>
          </div>
          <p className="text-lg font-bold font-heading">{formatCurrency(totalSaved + totalInvestments)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-accent-foreground" />
            <p className="text-xs font-medium text-muted-foreground">RESERVAS</p>
          </div>
          <p className="text-lg font-bold font-heading">{formatCurrency(totalSaved)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">INVESTIMENTOS</p>
          </div>
          <p className="text-lg font-bold font-heading">{formatCurrency(totalInvestments)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">METAS ATIVAS</p>
          </div>
          <p className="text-lg font-bold font-heading">{activeGoals}</p>
        </Card>
      </div>

      {/* 5. Recurring Expenses Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            Despesas Recorrentes
          </CardTitle>
          <CardDescription>
            Total mensal: <strong>{formatCurrency(recurringMonthlyTotal)}</strong>
            {monthlyIncome > 0 && (
              <span className="text-muted-foreground"> ({((recurringMonthlyTotal / monthlyIncome) * 100).toFixed(0)}% da renda)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nome (ex: Netflix)" value={newRecName} onChange={(e) => setNewRecName(e.target.value)} />
            <Input placeholder="Valor" type="number" value={newRecAmount} onChange={(e) => setNewRecAmount(e.target.value)} />
            <Select value={newRecFreq} onValueChange={(v) => setNewRecFreq(v as RecurringFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newRecCategory} onValueChange={setNewRecCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {data.categories.filter((c) => c.id !== "reserva_investimentos").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleAddRecurring} disabled={!newRecName || !newRecAmount || !newRecCategory}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>

          {/* List */}
          <div className="space-y-2">
            {data.recurringExpenses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa recorrente cadastrada</p>
            )}
            {data.recurringExpenses.map((rec) => (
              <div key={rec.id} className={`flex items-center justify-between p-3 rounded-lg border ${rec.active ? "border-border" : "border-border/50 opacity-60"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <Switch checked={rec.active} onCheckedChange={() => onToggleRecurring(rec.id)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rec.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{frequencyLabels[rec.frequency]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {data.categories.find((c) => c.id === rec.categoryId)?.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-heading">{formatCurrency(rec.amount)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteRecurring(rec.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. Financial Goals Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Resumo de Metas Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.financialGoals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta cadastrada</p>
          )}
          {data.financialGoals.map((goal) => {
            const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
            const isCompleted = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0;

            // Forecast: months to complete at current contribution rate
            const monthlyContribs = goal.contributions
              .filter((c) => c.date.startsWith(data.currentMonth))
              .reduce((s, c) => s + c.amount, 0);
            const remaining = goal.targetAmount - goal.currentAmount;
            const monthsToComplete = monthlyContribs > 0 ? Math.ceil(remaining / monthlyContribs) : null;

            return (
              <div key={goal.id} className="space-y-2 p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <CalendarClock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{goal.name}</span>
                  </div>
                  {isCompleted && <Badge className="bg-primary/10 text-primary border-0">Concluída!</Badge>}
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />

                <div className="flex flex-wrap gap-2 text-xs">
                  {daysLeft !== null && !isCompleted && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {daysLeft > 0 ? `${daysLeft} dias restantes` : "Prazo vencido"}
                    </Badge>
                  )}
                  {monthsToComplete !== null && !isCompleted && monthsToComplete > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Previsão: {monthsToComplete} {monthsToComplete === 1 ? "mês" : "meses"}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 7. Automated Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Insights Financeiros
          </CardTitle>
          <CardDescription>Análise automática dos seus hábitos financeiros</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                insight.type === "success"
                  ? "border-primary/30 bg-primary/5"
                  : insight.type === "warning"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/30"
              }`}
            >
              {insight.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              ) : insight.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
              ) : (
                <Lightbulb className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <p className="text-sm">{insight.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 2. Financial Growth Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulador de Crescimento</CardTitle>
          <CardDescription>Projete seu crescimento patrimonial com juros compostos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contribuição Mensal</Label>
              <Input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Saldo Inicial</Label>
              <Input type="number" value={currentBalance} onChange={(e) => setCurrentBalance(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Retorno Anual (%)</Label>
              <Input type="number" step="0.1" value={annualReturn} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Período (anos)</Label>
              <Input type="number" value={timePeriod} onChange={(e) => setTimePeriod(Number(e.target.value) || 1)} />
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <h3 className="font-semibold text-primary mb-2">Resultado da Simulação</h3>
            <p className="text-sm font-heading">
              Investindo <strong>{formatCurrency(monthlyContribution)}/mês por {timePeriod} anos</strong>,
              você terá <strong className="text-primary text-lg">{formatCurrency(finalBalance.balance)}</strong>
            </p>
            <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Total Investido</p>
                <p className="font-semibold">{formatCurrency(finalBalance.totalInvested)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lucro Total</p>
                <p className="font-semibold text-primary">{formatCurrency(finalBalance.totalProfit)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Multiplicador</p>
                <p className="font-semibold">{finalBalance.totalInvested > 0 ? (finalBalance.balance / finalBalance.totalInvested).toFixed(1) : "0"}x</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Projection Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Projeção de Crescimento</CardTitle>
          <CardDescription>Total investido vs lucro acumulado ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearlyData}>
                <defs>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [formatCurrency(value as number), name]}
                      labelFormatter={(year) => `Ano ${year}`}
                    />
                  }
                />
                <Area type="monotone" dataKey="totalInvested" stackId="1" stroke="hsl(var(--muted-foreground))" fill="url(#colorInvested)" name="Total Investido" />
                <Area type="monotone" dataKey="totalProfit" stackId="1" stroke="hsl(var(--primary))" fill="url(#colorProfit)" name="Lucro Acumulado" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Year-by-year breakdown (short periods) */}
      {timePeriod <= 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução Ano a Ano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {yearlyData.slice(1).map((d, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="font-medium text-sm">Ano {d.year}</span>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(d.balance)}</p>
                    <p className="text-xs text-muted-foreground">Lucro: {formatCurrency(d.totalProfit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvancedDashboard;