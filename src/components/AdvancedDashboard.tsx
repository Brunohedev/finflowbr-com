import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowLeft, TrendingUp, DollarSign, Target, PiggyBank, BarChart } from "lucide-react";
import { FinanceData } from "@/types/finance";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface AdvancedDashboardProps {
  data: FinanceData;
  getSpentByCategory: (categoryId: string) => number;
  onBack: () => void;
}

interface SimulationData {
  month: number;
  year: number;
  balance: number;
  totalInvested: number;
  totalProfit: number;
}

const AdvancedDashboard = ({ data, getSpentByCategory, onBack }: AdvancedDashboardProps) => {
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [annualReturn, setAnnualReturn] = useState(10);
  const [timePeriod, setTimePeriod] = useState(10);

  // Calculate current financial metrics
  const totalSaved = data.emergencyReserves.reduce((s, r) => s + r.currentAmount, 0);
  const monthlyInvestments = data.investments
    .filter((i) => i.date.startsWith(data.currentMonth))
    .reduce((s, i) => s + i.amount, 0);
  const totalInvestments = data.investments.reduce((s, i) => s + i.amount, 0);
  const activeGoals = data.financialGoals.length;
  const totalGoalProgress = data.financialGoals.reduce((s, g) => s + g.currentAmount, 0);

  // Calculate compound interest simulation
  const calculateSimulation = (): SimulationData[] => {
    const monthlyRate = annualReturn / 100 / 12;
    const totalMonths = timePeriod * 12;
    const simulation: SimulationData[] = [];
    
    let balance = currentBalance;
    
    for (let month = 0; month <= totalMonths; month++) {
      const totalInvested = currentBalance + (monthlyContribution * month);
      const totalProfit = balance - totalInvested;
      
      simulation.push({
        month,
        year: Math.floor(month / 12),
        balance,
        totalInvested,
        totalProfit
      });
      
      if (month < totalMonths) {
        balance = (balance + monthlyContribution) * (1 + monthlyRate);
      }
    }
    
    return simulation;
  };

  const simulationData = calculateSimulation();
  const finalBalance = simulationData[simulationData.length - 1];
  const yearlyData = simulationData.filter((_, index) => index % 12 === 0);

  const chartConfig = {
    balance: {
      label: "Saldo Total",
      color: "hsl(var(--primary))",
    },
    totalInvested: {
      label: "Total Investido",
      color: "hsl(var(--muted-foreground))",
    },
    totalProfit: {
      label: "Lucro Acumulado",
      color: "hsl(217, 91%, 60%)",
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold font-heading">Dashboard Avançado</h1>
          <p className="text-sm text-muted-foreground">Análise completa e simulações financeiras</p>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">SALDO ATUAL</p>
          </div>
          <p className="text-lg font-bold font-heading">{formatCurrency(totalSaved + totalInvestments)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-accent" />
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
            <Target className="w-4 h-4 text-secondary-foreground" />
            <p className="text-xs font-medium text-muted-foreground">METAS ATIVAS</p>
          </div>
          <p className="text-lg font-bold font-heading">{activeGoals}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">PROGRESSO</p>
          </div>
          <p className="text-lg font-bold font-heading">{formatCurrency(totalGoalProgress)}</p>
        </Card>
      </div>

      {/* Financial Growth Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulador de Crescimento Financeiro</CardTitle>
          <CardDescription>
            Projete seu crescimento patrimonial com diferentes cenários de investimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly">Contribuição Mensal</Label>
              <Input
                id="monthly"
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value) || 0)}
                placeholder="R$ 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Saldo Inicial</Label>
              <Input
                id="balance"
                type="number"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(Number(e.target.value) || 0)}
                placeholder="R$ 0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return">Retorno Anual (%)</Label>
              <Input
                id="return"
                type="number"
                step="0.1"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Período (anos)</Label>
              <Input
                id="period"
                type="number"
                value={timePeriod}
                onChange={(e) => setTimePeriod(Number(e.target.value) || 1)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <h3 className="font-semibold text-primary mb-2">Resultado da Simulação</h3>
            <p className="text-lg font-heading">
              Investindo <strong>{formatCurrency(monthlyContribution)}/mês por {timePeriod} anos</strong>, 
              você terá <strong className="text-primary">{formatCurrency(finalBalance.balance)}</strong>
            </p>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
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
                <p className="font-semibold">{(finalBalance.balance / finalBalance.totalInvested).toFixed(1)}x</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projection Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Projeção de Crescimento</CardTitle>
          <CardDescription>
            Visualize como seus investimentos crescem ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearlyData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="year" 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value).replace('R$', 'R$')}
                />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => [formatCurrency(value as number), name]}
                      labelFormatter={(year) => `Ano ${year}`}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="totalInvested"
                  stackId="1"
                  stroke="hsl(var(--muted-foreground))"
                  fill="url(#colorInvested)"
                  name="Total Investido"
                />
                <Area
                  type="monotone"
                  dataKey="totalProfit"
                  stackId="1"
                  stroke="hsl(217, 91%, 60%)"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.6}
                  name="Lucro Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly breakdown table */}
      {timePeriod <= 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução Ano a Ano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {yearlyData.slice(1).map((data, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="font-medium">Ano {data.year}</span>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(data.balance)}</p>
                    <p className="text-xs text-muted-foreground">
                      Lucro: {formatCurrency(data.totalProfit)}
                    </p>
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