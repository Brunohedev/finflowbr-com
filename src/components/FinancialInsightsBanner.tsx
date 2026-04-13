import { useState, useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { FinanceData } from "@/types/finance";
import { getSavingsAllocationForMonth, getPercentagesForMonth } from "@/lib/savingsAllocation";

interface Props {
  data: FinanceData;
  monthlyIncome: number;
  activeMonth: string;
  getSpentByCategory: (id: string) => number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function FinancialInsightsBanner({ data, monthlyIncome, activeMonth, getSpentByCategory }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const insights = useMemo(() => {
    const list: string[] = [];
    const totalSpent = data.categories.reduce((sum, category) => sum + getSpentByCategory(category.id), 0);
    const remaining = monthlyIncome - totalSpent;
    const savingsRate = monthlyIncome > 0 ? ((remaining) / monthlyIncome) * 100 : 0;

    if (remaining > 0) {
      list.push(`Você ainda tem ${formatCurrency(remaining)} disponível este mês. 💪`);
    }

    if (savingsRate >= 20) {
      list.push(`Ótimo! Você está economizando ${savingsRate.toFixed(0)}% da sua renda. 🎉`);
    }

    if (remaining > 0) {
      const yearProjection = remaining * 12;
      list.push(`Nesse ritmo, você pode guardar ${formatCurrency(yearProjection)} em um ano. 📈`);
    }

    const reserveTotal = data.emergencyReserves.reduce((s, r) => s + r.currentAmount, 0);
    if (reserveTotal > 0) {
      list.push(`Sua reserva de emergência está em ${formatCurrency(reserveTotal)}. Continue assim! 🛡️`);
    }

    const goalsWithProgress = data.financialGoals.filter(g => g.targetAmount > 0 && g.currentAmount > 0);
    goalsWithProgress.forEach(g => {
      const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
      if (pct >= 80) {
        list.push(`Você está quase lá! Meta "${g.name}" em ${pct}%. 🏆`);
      }
    });

    const desejosSpent = getSpentByCategory("desejos");
    const desejosPct = getPercentagesForMonth(data, activeMonth).desejos;
    const desejosBudget = (desejosPct / 100) * monthlyIncome;
    if (desejosSpent < desejosBudget * 0.5 && monthlyIncome > 0) {
      list.push(`Seus gastos com desejos estão bem controlados. Parabéns! ✨`);
    }

    if (totalSpent === 0 && monthlyIncome > 0) {
      list.push(`Comece a registrar suas despesas para acompanhar seu progresso. 📝`);
    }

    if (list.length === 0) {
      list.push("Registre suas despesas para receber insights personalizados. 💡");
    }

    return list;
  }, [data, monthlyIncome, getSpentByCategory]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [insights.length]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <p
          key={currentIndex}
          className="text-sm text-foreground/80 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {insights[currentIndex]}
        </p>
      </div>
      {insights.length > 1 && (
        <div className="flex gap-1 justify-center mt-2">
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentIndex ? "bg-primary w-3" : "bg-primary/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
