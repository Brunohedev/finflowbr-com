import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGrowthSimulator } from "@/hooks/useGrowthSimulator";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface GrowthSimulatorProps {
  simulator: ReturnType<typeof useGrowthSimulator>;
}

const GrowthSimulator = React.memo(({ simulator }: GrowthSimulatorProps) => {
  const {
    monthlyContribution, setMonthlyContribution,
    currentBalance, setCurrentBalance,
    annualReturn, setAnnualReturn,
    timePeriod, setTimePeriod,
    finalBalance,
  } = simulator;

  return (
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
  );
});

GrowthSimulator.displayName = "GrowthSimulator";

export default GrowthSimulator;
