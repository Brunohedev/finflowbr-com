import { useMemo } from "react";
import { FinanceData } from "@/types/finance";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface AnalyticsViewProps {
  data: FinanceData;
  getSpentByCategory: (id: string) => number;
  getBudget: (id: string) => number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const COLORS = [
  "hsl(158, 64%, 40%)",
  "hsl(42, 90%, 55%)",
  "hsl(250, 60%, 60%)",
  "hsl(200, 70%, 50%)",
];

const AnalyticsView = ({ data, getSpentByCategory, getBudget }: AnalyticsViewProps) => {
  const totalSpent = useMemo(
    () => data.categories.reduce((s, cat) => s + getSpentByCategory(cat.id), 0),
    [data.categories, getSpentByCategory]
  );

  const chartData = useMemo(
    () =>
      data.categories.map((cat, i) => ({
        name: cat.name,
        value: getSpentByCategory(cat.id),
        color: COLORS[i % COLORS.length],
      })),
    [data.categories, getSpentByCategory]
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h2 className="font-heading font-bold text-lg">Análise do Mês</h2>

      <div className="finance-card text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Utilizado</p>
        <p className="text-3xl font-bold font-heading mt-1">{formatCurrency(totalSpent)}</p>
        <p className="text-sm text-muted-foreground mt-1">
          de {formatCurrency(data.income)} ({((totalSpent / data.income) * 100).toFixed(0)}%)
        </p>
      </div>

      {totalSpent > 0 && (
        <div className="finance-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Distribuição</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.filter((d) => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" strokeWidth={2} stroke="hsl(var(--card))"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="finance-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Por Categoria</h3>
        <div className="space-y-4">
          {data.categories.map((cat, i) => {
            const spent = getSpentByCategory(cat.id);
            const budget = getBudget(cat.id);
            const pct = budget > 0 ? (spent / budget) * 100 : 0;
            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(spent)} / {formatCurrency(budget)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
