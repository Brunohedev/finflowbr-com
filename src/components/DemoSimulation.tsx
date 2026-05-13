import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  Play,
} from "lucide-react";

interface DemoSimulationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

type Category = "essentials" | "wants";

// Proportional weights inside each category (used to scale per-item amounts)
const ITEMS: { name: string; icon: any; category: Category; weight: number }[] = [
  { name: "Aluguel", icon: Home, category: "essentials", weight: 0.6 },
  { name: "Mercado", icon: ShoppingCart, category: "essentials", weight: 0.225 },
  { name: "Transporte", icon: Car, category: "essentials", weight: 0.175 },
  { name: "Restaurantes", icon: Utensils, category: "wants", weight: 0.583 },
  { name: "Compras", icon: ShoppingBag, category: "wants", weight: 0.417 },
];

const STEPS = [
  { key: "income", duration: 1200 },
  { key: "expenses", duration: 3000 },
  { key: "calc", duration: 1400 },
  { key: "reserve", duration: 1800 },
  { key: "done", duration: 0 },
];

const DemoSimulation = ({ open, onOpenChange }: DemoSimulationProps) => {
  const { t } = useLanguage();
  // Setup state
  const [income, setIncome] = useState(4000);
  const [essentialsPct, setEssentialsPct] = useState(50);
  const [wantsPct, setWantsPct] = useState(30);
  const [started, setStarted] = useState(false);

  // Simulation state
  const [stepIdx, setStepIdx] = useState(0);
  const [visibleExpenses, setVisibleExpenses] = useState(0);
  const [progress, setProgress] = useState(0);

  const reservePct = Math.max(0, 100 - essentialsPct - wantsPct);
  const essentialsTotal = (income * essentialsPct) / 100;
  const wantsTotal = (income * wantsPct) / 100;
  const remaining = (income * reservePct) / 100;

  const reset = () => {
    setStepIdx(0);
    setVisibleExpenses(0);
    setProgress(0);
  };

  useEffect(() => {
    if (!open) {
      reset();
      setStarted(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !started) return;
    const step = STEPS[stepIdx];
    if (!step || step.key === "done") return;

    if (step.key === "expenses") {
      setVisibleExpenses(0);
      const perItem = step.duration / ITEMS.length;
      const interval = setInterval(() => {
        setVisibleExpenses((v) => (v >= ITEMS.length ? v : v + 1));
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
  }, [stepIdx, open, started]);

  const currentKey = STEPS[stepIdx]?.key;
  const showIncome = started && stepIdx >= 0;
  const showExpenses = started && stepIdx >= 1;
  const showRemaining = started && stepIdx >= 2;
  const showReserve = started && stepIdx >= 3;
  const isDone = currentKey === "done";

  const handleEssentialsChange = (v: number) => {
    const next = Math.min(v, 100 - wantsPct);
    setEssentialsPct(next);
  };
  const handleWantsChange = (v: number) => {
    const next = Math.min(v, 100 - essentialsPct);
    setWantsPct(next);
  };

  const startSim = () => {
    reset();
    setStarted(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("Demonstração FinFlow")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t("Defina seu salário e a divisão do orçamento, depois veja a simulação.")}
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Setup panel */}
          {!started && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t("Renda mensal")}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={income}
                  onChange={(e) => setIncome(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div className="space-y-4">
                <SliderRow
                  label={t("Essenciais")}
                  color="text-blue-500"
                  pct={essentialsPct}
                  amount={essentialsTotal}
                  max={income}
                  onChangeAmount={(amt) => {
                    const maxAmt = income - (income * wantsPct) / 100;
                    const clamped = Math.min(amt, maxAmt);
                    setEssentialsPct(income > 0 ? (clamped / income) * 100 : 0);
                  }}
                />
                <SliderRow
                  label={t("Desejos")}
                  color="text-orange-500"
                  pct={wantsPct}
                  amount={wantsTotal}
                  max={income}
                  onChangeAmount={(amt) => {
                    const maxAmt = income - (income * essentialsPct) / 100;
                    const clamped = Math.min(amt, maxAmt);
                    setWantsPct(income > 0 ? (clamped / income) * 100 : 0);
                  }}
                />
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary">{t("Reserva (sobra)")}</p>
                    <p className="text-xs font-bold text-primary">
                      {Math.round(reservePct)}% · {fmt(remaining)}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("Ajuste as barras acima para mudar quanto sobra.")}
                  </p>
                </div>
              </div>

              <Button className="w-full" onClick={startSim} disabled={income <= 0}>
                <Play className="w-4 h-4 mr-1.5" /> {t("Rodar simulação")}
              </Button>
            </div>
          )}

          {/* Income */}
          {showIncome && (
            <div className="rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("Renda mensal")}</p>
                    <p className="font-heading font-bold text-lg leading-tight">{fmt(income)}</p>
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
                const visibleInCat = ITEMS.slice(0, visibleExpenses).filter((e) => e.category === cat);
                if (visibleInCat.length === 0) return null;
                const catTotal = cat === "essentials" ? essentialsTotal : wantsTotal;
                const catPct = cat === "essentials" ? essentialsPct : wantsPct;
                const catLabel = cat === "essentials" ? t("Essenciais") : t("Desejos");
                const catColor = cat === "essentials" ? "text-blue-500" : "text-orange-500";
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
                      const amt = catTotal * e.weight;
                      return (
                        <div
                          key={e.name}
                          className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${catColor}`} />
                            <span>{t(e.name)}</span>
                          </div>
                          <span className="font-medium">- {fmt(amt)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining = Reserve */}
          {showRemaining && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{t("Dinheiro Restante Este Mês")}</p>
                <p className="text-xs font-bold text-primary">{reservePct}% {t("Reserva")}</p>
              </div>
              <p className="font-heading font-bold text-3xl text-primary">{fmt(remaining)}</p>
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
                  <p className="text-xs text-muted-foreground">{t("Enviando para a Reserva")}</p>
                  <p className="font-heading font-bold">{fmt((remaining * progress) / 100)}</p>
                </div>
                {isDone && <CheckCircle2 className="w-5 h-5 text-primary" />}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {isDone && (
            <div className="text-center space-y-3 pt-2">
              <p className="text-sm font-medium">
                {t("É isso. Claro, simples, e seu dinheiro finalmente trabalhando para você.")}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => { setStarted(false); reset(); }}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {t("Ajustar")}
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  {t("Começar agora")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SliderRow = ({
  label,
  color,
  pct,
  amount,
  max,
  onChangeAmount,
}: {
  label: string;
  color: string;
  pct: number;
  amount: number;
  max: number;
  onChangeAmount: (amt: number) => void;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <p className={`text-xs font-bold ${color}`}>{label}</p>
      <p className="text-xs font-medium">
        <span className="text-muted-foreground mr-1.5">{fmt(amount)}</span>
        <span className="font-bold">{Math.round(pct)}%</span>
      </p>
    </div>
    <Slider
      value={[Math.round(amount)]}
      min={0}
      max={Math.max(0, Math.round(max))}
      step={1}
      onValueChange={(v) => onChangeAmount(v[0])}
    />
  </div>
);

export default DemoSimulation;
