import { useState, useMemo } from "react";
import { FinanceData, getTotalDailyIncome } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyCalendarProps {
  data: FinanceData;
  onBack: () => void;
  onToggleExpenseStatus: (id: string) => void;
}

const fmt = (v: number) =>
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

const fmtFull = (v: number) =>
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const MonthlyCalendar = ({ data, onBack, onToggleExpenseStatus }: MonthlyCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const dailyIncome = useMemo(() => getTotalDailyIncome(data.incomeSources), [data.incomeSources]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const dayData = useMemo(() => {
    const map: Record<string, {income: number;expenses: number;}> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { income: dailyIncome, expenses: 0 };
    });
    data.expenses.forEach((e) => {
      if (map[e.date]) map[e.date].expenses += e.amount;
    });
    data.emergencyReserves.flatMap((r) => r.contributions).forEach((c) => {
      if (map[c.date]) map[c.date].expenses += c.amount;
    });
    data.financialGoals.flatMap((g) => g.contributions).forEach((c) => {
      if (map[c.date]) map[c.date].expenses += c.amount;
    });
    data.investments.forEach((i) => {
      if (map[i.date]) map[i.date].expenses += i.amount;
    });
    return map;
  }, [days, data, dailyIncome]);

  const selectedDayKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDayData = selectedDayKey ? dayData[selectedDayKey] : null;

  const selectedDayExpenses = useMemo(() => {
    if (!selectedDayKey) return [];
    return data.expenses.filter((e) => e.date === selectedDayKey);
  }, [data.expenses, selectedDayKey]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const monthKey = format(currentDate, "yyyy-MM");
  const monthTotals = useMemo(() => {
    const daysInMonth = days.length;
    const totalIncome = dailyIncome * daysInMonth;
    const totalExpenses = Object.entries(dayData).
    filter(([k]) => k.startsWith(monthKey)).
    reduce((s, [, v]) => s + v.expenses, 0);
    return { income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses };
  }, [dayData, dailyIncome, days.length, monthKey]);

  // Monthly expenses breakdown by category
  const monthExpenses = useMemo(() => {
    return data.expenses.filter((e) => e.date.startsWith(monthKey));
  }, [data.expenses, monthKey]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, {name: string;total: number;count: number;}> = {};
    monthExpenses.forEach((e) => {
      const cat = data.categories.find((c) => c.id === e.categoryId);
      if (!map[e.categoryId]) {
        map[e.categoryId] = { name: cat?.name || e.categoryId, total: 0, count: 0 };
      }
      map[e.categoryId].total += e.amount;
      map[e.categoryId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthExpenses, data.categories]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="font-heading font-bold text-lg">Relatório Mensal</h2>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-heading font-semibold capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* 1️⃣ Calendar Section */}
      <div className="finance-card">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Calendário</h3>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-secondary/50">
            <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
            <p className="text-sm font-bold text-primary font-heading">{fmt(monthTotals.income)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/50">
            <p className="text-[10px] text-muted-foreground uppercase">Despesas</p>
            <p className="text-sm font-bold text-destructive font-heading">{fmt(monthTotals.expenses)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/50">
            <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
            <p className={`text-sm font-bold font-heading ${monthTotals.balance >= 0 ? "text-primary" : "text-destructive"}`}>
              {fmt(monthTotals.balance)}
            </p>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((d) =>
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDayOfWeek }).map((_, i) =>
          <div key={`empty-${i}`} />
          )}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dd = dayData[key];
            const balance = dd ? dd.income - dd.expenses : 0;
            const hasExpenses = dd && dd.expenses > 0;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative p-1 rounded-lg text-center transition-all text-xs min-h-[44px] flex flex-col items-center justify-center gap-0.5
                  ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary" : "hover:bg-secondary"}
                  ${isToday && !isSelected ? "ring-1 ring-primary/30" : ""}
                `}>
                
                <span className="font-medium">{format(day, "d")}</span>
                {hasExpenses &&
                <span className={`text-[8px] font-medium ${isSelected ? "text-primary-foreground/80" : balance >= 0 ? "text-primary" : "text-destructive"}`}>
                    {fmt(dd.expenses)}
                  </span>
                }
              </button>);

          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && selectedDayData &&
      <div className="finance-card space-y-3">
          <h3 className="font-heading font-semibold text-sm capitalize">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Receita</p>
              <p className="text-sm font-semibold text-primary">{fmtFull(selectedDayData.income)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Despesas</p>
              <p className="text-sm font-semibold text-destructive">{fmtFull(selectedDayData.expenses)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Saldo</p>
              <p className={`text-sm font-semibold ${selectedDayData.income - selectedDayData.expenses >= 0 ? "text-primary" : "text-destructive"}`}>
                {fmtFull(selectedDayData.income - selectedDayData.expenses)}
              </p>
            </div>
          </div>
          {selectedDayExpenses.length > 0 &&
        <div className="space-y-1.5 pt-1 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Despesas do dia</p>
              {selectedDayExpenses.map((e) =>
          <div key={e.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{e.name}</span>
                    {e.totalInstallments && e.totalInstallments > 1 &&
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                        {e.installmentNumber}/{e.totalInstallments}
                      </Badge>
              }
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="font-medium">{fmtFull(e.amount)}</span>
                    <button
                onClick={() => onToggleExpenseStatus(e.id)}
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                e.status === "paid" ?
                "bg-primary/15 border-primary/30 text-primary" :
                "bg-warning/15 border-warning/30 text-warning"}`
                }>
                
                      {e.status === "paid" ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </div>
          )}
            </div>
        }
        </div>
      }

      {/* 2️⃣ Monthly Analysis */}
      
















      

      {/* 3️⃣ Recurring Expenses summary */}
      
























      
    </div>);

};

export default MonthlyCalendar;