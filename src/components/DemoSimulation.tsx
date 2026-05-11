import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Car,
  ShoppingCart,
  Home,
  Utensils,
  ShoppingBag,
  PiggyBank,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface DemoSimulationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const INCOME = 4000;
const ESSENTIALS_PCT = 50;
const WANTS_PCT = 30;
const RESERVE_PCT = 20;

type Category = "essentials" | "wants";

const EXPENSES: { name: string; amount: number; icon: any; category: Category }[] = [
  // Essentials = 50% of $4000 = $2000
  { name: "Rent", amount: 1200, icon: Home, category: "essentials" },
  { name: "Groceries", amount: 450, icon: ShoppingCart, category: "essentials" },
  { name: "Transport", amount: 350, icon: Car, category: "essentials" },
  // Wants = 30% of $4000 = $1200
  { name: "Restaurants", amount: 700, icon: Utensils, category: "wants" },
  { name: "Shopping", amount: 500, icon: ShoppingBag, category: "wants" },
];

const TOTAL_EXPENSES = EXPENSES.reduce((s, e) => s + e.amount, 0);
const ESSENTIALS_TOTAL = EXPENSES.filter((e) => e.category === "essentials").reduce((s, e) => s + e.amount, 0);
const WANTS_TOTAL = EXPENSES.filter((e) => e.category === "wants").reduce((s, e) => s + e.amount, 0);
const REMAINING = INCOME - TOTAL_EXPENSES;

const STEPS = [
  { key: "income", label: "Adding monthly income", duration: 1400 },
  { key: "expenses", label: "Tracking your expenses", duration: 3200 },
  { key: "calc", label: "Calculating money left", duration: 1600 },
  { key: "reserve", label: "Sending to your reserve", duration: 2000 },
  { key: "done", label: "Done!", duration: 0 },
];

const DemoSimulation = ({ open, onOpenChange }: DemoSimulationProps) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [visibleExpenses, setVisibleExpenses] = useState(0);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setStepIdx(0);
    setVisibleExpenses(0);
    setProgress(0);
  };

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const step = STEPS[stepIdx];
    if (!step || step.key === "done") return;

    if (step.key === "expenses") {
      setVisibleExpenses(0);
      const perItem = step.duration / EXPENSES.length;
      const interval = setInterval(() => {
        setVisibleExpenses((v) => {
          if (v >= EXPENSES.length) {
            clearInterval(interval);
            return v;
          }
          return v + 1;
        });
      }, perItem);
      const t = setTimeout(() => setStepIdx((i) => i + 1), step.duration + 200);
      return () => {
        clearInterval(interval);
        clearTimeout(t);
      };
    }

    if (step.key === "reserve") {
      setProgress(0);
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, (elapsed / step.duration) * 100);
        setProgress(pct);
        if (pct >= 100) clearInterval(interval);
      }, 40);
      const t = setTimeout(() => setStepIdx((i) => i + 1), step.duration + 200);
      return () => {
        clearInterval(interval);
        clearTimeout(t);
      };
    }

    const t = setTimeout(() => setStepIdx((i) => i + 1), step.duration);
    return () => clearTimeout(t);
  }, [stepIdx, open]);

  const currentKey = STEPS[stepIdx]?.key;
  const showIncome = stepIdx >= 0;
  const showExpenses = stepIdx >= 1;
  const showRemaining = stepIdx >= 2;
  const showReserve = stepIdx >= 3;
  const isDone = currentKey === "done";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Sparkles className="w-4 h-4 text-primary" />
            FinFlow Demo
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Watch how FinFlow turns your salary into real savings.
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Income */}
          {showIncome && (
            <div className="rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Income</p>
                    <p className="font-heading font-bold text-lg leading-tight">{fmt(INCOME)}</p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            </div>
          )}

          {/* Expenses grouped by category */}
          {showExpenses && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
              {(["essentials", "wants"] as Category[]).map((cat) => {
                const items = EXPENSES.filter((e) => e.category === cat).slice(
                  0,
                  Math.max(
                    0,
                    visibleExpenses -
                      EXPENSES.filter((e, idx) => e.category !== cat && idx < EXPENSES.findIndex((x) => x.category === cat)).length
                  )
                );
                const visibleInCat = EXPENSES.slice(0, visibleExpenses).filter((e) => e.category === cat);
                const catTotal = cat === "essentials" ? ESSENTIALS_TOTAL : WANTS_TOTAL;
                const catPct = cat === "essentials" ? ESSENTIALS_PCT : WANTS_PCT;
                const catLabel = cat === "essentials" ? "Essentials" : "Wants";
                const catColor = cat === "essentials" ? "text-blue-500" : "text-orange-500";
                if (visibleInCat.length === 0) return null;
                return (
                  <div key={cat} className="rounded-lg border bg-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-bold ${catColor}`}>
                        {catLabel} <span className="text-muted-foreground font-normal">· {catPct}%</span>
                      </p>
                      <p className="text-xs font-bold text-destructive">- {fmt(catTotal)}</p>
                    </div>
                    {visibleInCat.map((e) => {
                      const Icon = e.icon;
                      return (
                        <div
                          key={e.name}
                          className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${catColor}`} />
                            <span>{e.name}</span>
                          </div>
                          <span className="font-medium">- {fmt(e.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining = 20% Reserve */}
          {showRemaining && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Money Left This Month</p>
                <p className="text-xs font-bold text-primary">{RESERVE_PCT}% Reserve</p>
              </div>
              <p className="font-heading font-bold text-3xl text-primary">{fmt(REMAINING)}</p>
            </div>
          )}

          {/* Reserve */}
          {showReserve && (
            <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <PiggyBank className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Sending to Reserve</p>
                  <p className="font-heading font-bold">{fmt((REMAINING * progress) / 100)}</p>
                </div>
                {isDone && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Active step indicator */}
          {!isDone && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              {STEPS[stepIdx]?.label}…
            </p>
          )}

          {isDone && (
            <div className="text-center space-y-3 pt-2">
              <p className="text-sm font-medium">
                That's it. Clear, simple, and your money is finally working for you.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Replay
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Get started
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoSimulation;
