import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, TrendingDown, AlertTriangle, PiggyBank, LineChart as LineChartIcon,
  Clock, DollarSign, ArrowRight, Sparkles } from
"lucide-react";
import { FinanceData, RecurringExpense } from "@/types/finance";
import { getDaysInMonth, getDate, format } from "date-fns";

const formatCurrency = (value: number) =>
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const frequencyToMonthly = (amount: number, frequency: RecurringExpense["frequency"]) => {
  switch (frequency) {
    case "weekly":return amount * 4.33;
    case "monthly":return amount;
    case "yearly":return amount / 12;
  }
};

interface Props {
  data: FinanceData;
  monthlyIncome: number;
  getSpentByCategory: (catId: string) => number;
  onAddReserveContribution: (reserveId: string, amount: number, note?: string) => void;
  onAddInvestment: (name: string, amount: number, note?: string) => void;
  firstReserveId?: string;
}

type QuickAction = "reserve" | "investment" | null;

export default function EndOfMonthPrediction({
  data, monthlyIncome, getSpentByCategory,
  onAddReserveContribution, onAddInvestment, firstReserveId
}: Props) {
  const [actionType, setActionType] = useState<QuickAction>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");

  const prediction = useMemo(() => {
    const now = new Date();
    const totalDays = getDaysInMonth(now);
    const dayOfMonth = getDate(now);
    const daysRemaining = totalDays - dayOfMonth;

    // Total expenses recorded this month (uses centralized getSpentByCategory)
    const currentMonth = format(now, "yyyy-MM");
    const totalExpenses = data.categories.
    filter((c) => c.id !== "reserva_investimentos").
    reduce((s, cat) => s + getSpentByCategory(cat.id), 0);

    // Recurring expenses remaining this month (active ones, monthly equivalent prorated)
    const recurringRemaining = data.recurringExpenses.
    filter((e) => e.active).
    reduce((s, e) => {
      const monthly = frequencyToMonthly(e.amount, e.frequency);
      // Estimate remaining portion based on days left
      const dailyRate = monthly / totalDays;
      return s + dailyRate * daysRemaining;
    }, 0);

    // Daily spending rate projected for remaining days
    const dailySpendRate = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
    const projectedAdditionalSpending = dailySpendRate * daysRemaining;

    const totalProjectedExpenses = totalExpenses + projectedAdditionalSpending + recurringRemaining;
    const predictedBalance = monthlyIncome - totalProjectedExpenses;

    // Reserve/investment contributions this month
    const reserveContribs = data.emergencyReserves.
    flatMap((r) => r.contributions).
    filter((c) => c.date.startsWith(currentMonth)).
    reduce((s, c) => s + c.amount, 0);
    const investContribs = data.investments.
    filter((i) => i.date.startsWith(currentMonth)).
    reduce((s, i) => s + i.amount, 0);

    const alreadyAllocated = reserveContribs + investContribs;
    const availableToSave = Math.max(0, predictedBalance - alreadyAllocated);

    return {
      totalExpenses,
      recurringRemaining: Math.round(recurringRemaining),
      projectedAdditionalSpending: Math.round(projectedAdditionalSpending),
      totalProjectedExpenses: Math.round(totalProjectedExpenses),
      predictedBalance: Math.round(predictedBalance),
      availableToSave: Math.round(availableToSave),
      daysRemaining,
      ratio: monthlyIncome > 0 ? predictedBalance / monthlyIncome : 0
    };
  }, [data, monthlyIncome, getSpentByCategory]);

  const getStatus = () => {
    if (prediction.predictedBalance <= 0) return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: TrendingDown, label: "Projeção negativa" };
    if (prediction.ratio < 0.05) return { color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", icon: AlertTriangle, label: "Margem apertada" };
    return { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: TrendingUp, label: "Projeção positiva" };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  const handleConfirmAction = () => {
    const amount = parseFloat(actionAmount);
    if (!amount || amount <= 0) return;
    if (actionType === "reserve" && firstReserveId) {
      onAddReserveContribution(firstReserveId, amount, actionNote || "Via projeção de fim de mês");
    } else if (actionType === "investment") {
      onAddInvestment("Investimento", amount, actionNote || "Via projeção de fim de mês");
    }
    setActionType(null);
    setActionAmount("");
    setActionNote("");
  };

  const getSuggestionText = () => {
    if (prediction.availableToSave > 0) {
      return `Você pode ter ${formatCurrency(prediction.availableToSave)} disponível para poupar ou investir este mês.`;
    }
    if (prediction.predictedBalance > 0) {
      return "Boa gestão! Seu saldo projetado é positivo, mas já está alocado.";
    }
    return "Atenção: considere reduzir gastos para fechar o mês no positivo.";
  };

  return (
    <>
      <Card className={`${status.bg} ${status.border} border overflow-hidden`}>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center`}>
                <StatusIcon className={`w-4 h-4 ${status.color}`} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Projeção Fim do Mês
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {prediction.daysRemaining} dias restantes
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Main prediction */}
          <div className="text-center py-2">
            <p className={`text-2xl font-bold font-heading ${status.color}`}>
              {formatCurrency(prediction.predictedBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">saldo projetado</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            





            
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-background/60">
              <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />
              <div>
                <p className="text-muted-foreground">Gastos atuais</p>
                <p className="font-semibold">{formatCurrency(prediction.totalExpenses)}</p>
              </div>
            </div>
            





            
            





            
          </div>

          {/* Suggestion */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-background/80 border border-border/50">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{getSuggestionText()}</p>
          </div>

          {/* Quick actions */}
          {prediction.availableToSave > 0 &&
          <div className="grid grid-cols-3 gap-2">
              <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1 border-primary/20 text-primary hover:bg-primary/10"
              onClick={() => setActionType("reserve")}>
              
                <PiggyBank className="w-3 h-3" />
                Reserva
              </Button>
              <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1 border-accent/50 text-accent-foreground hover:bg-accent/50"
              onClick={() => setActionType("investment")}>
              
                <LineChartIcon className="w-3 h-3" />
                Investir
              </Button>
              <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-muted-foreground"
              disabled>
              
                Alocar depois
              </Button>
            </div>
          }
        </CardContent>
      </Card>

      {/* Quick action dialog */}
      <Dialog open={actionType !== null} onOpenChange={(o) => !o && setActionType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {actionType === "reserve" ? "Adicionar à Reserva" : "Adicionar aos Investimentos"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor</label>
              <Input
                type="number"
                placeholder="0,00"
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                min="0"
                step="0.01" />
              
              {prediction.availableToSave > 0 &&
              <button
                className="text-[10px] text-primary mt-1 hover:underline"
                onClick={() => setActionAmount(String(prediction.availableToSave))}>
                
                  Usar projeção: {formatCurrency(prediction.availableToSave)}
                </button>
              }
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nota (opcional)</label>
              <Input
                placeholder="Descrição"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)} />
              
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setActionType(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleConfirmAction} disabled={!actionAmount || parseFloat(actionAmount) <= 0}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}