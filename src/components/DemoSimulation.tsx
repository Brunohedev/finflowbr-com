import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  ShoppingCart,
  Home,
  Utensils,
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
const EXPENSES = [
  { name: "Rent", amount: 1200, icon: Home, color: "text-blue-500" },
  { name: "Groceries", amount: 450, icon: ShoppingCart, color: "text-orange-500" },
  { name: "Restaurants", amount: 280, icon: Utensils, color: "text-pink-500" },
  { name: "Transport", amount: 170, icon: TrendingUp, color: "text-purple-500" },
];

const TOTAL_EXPENSES = EXPENSES.reduce((s, e) => s + e.amount, 0);
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

          {/* Expenses */}
          {showExpenses && (
            <div className="rounded-lg border bg-card p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Expenses</p>
                <p className="text-xs font-bold text-destructive">- {fmt(TOTAL_EXPENSES)}</p>
              </div>
              <div className="space-y-1.5">
                {EXPENSES.slice(0, visibleExpenses).map((e) => {
                  const Icon = e.icon;
                  return (
                    <div
                      key={e.name}
                      className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${e.color}`} />
                        <span>{e.name}</span>
                      </div>
                      <span className="font-medium">- {fmt(e.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remaining */}
          {showRemaining && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 animate-in fade-in zoom-in-95 duration-500">
              <p className="text-xs text-muted-foreground mb-1">Money Left This Month</p>
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
