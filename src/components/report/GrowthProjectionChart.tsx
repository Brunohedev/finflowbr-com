import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from "recharts";
import type { SimulationDataPoint } from "@/hooks/useGrowthSimulator";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

interface GrowthProjectionChartProps {
  yearlyData: SimulationDataPoint[];
  timePeriod: number;
}

const chartConfig = {
  totalInvested: { label: "Total Investido", color: "hsl(var(--muted-foreground))" },
  totalProfit: { label: "Lucro Acumulado", color: "hsl(var(--accent))" },
};

const GrowthProjectionChart = React.memo(({ yearlyData, timePeriod }: GrowthProjectionChartProps) => {
  return (
    <div className="space-y-4">
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
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
});

GrowthProjectionChart.displayName = "GrowthProjectionChart";

export default GrowthProjectionChart;
