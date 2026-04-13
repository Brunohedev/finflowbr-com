import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Percent, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Percentages, IncomeSource, IncomeFrequency, normalizeToMonthly, getTotalMonthlyIncome } from "@/types/finance";

interface SetupWizardProps {
  onComplete: (incomeSources: IncomeSource[], percentages: Percentages) => void;
}

const FREQ_LABELS: Record<IncomeFrequency, string> = {
  daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", once: "Valor único",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

const SetupWizard = ({ onComplete }: SetupWizardProps) => {
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [newName, setNewName] = useState("Salário");
  const [newAmount, setNewAmount] = useState("");
  const [newFreq, setNewFreq] = useState<IncomeFrequency>("monthly");
  const [percentages, setPercentages] = useState<Percentages>({
    essenciais: 50, desejos: 30, reserva_investimentos: 20,
  });

  const total = percentages.essenciais + percentages.desejos + percentages.reserva_investimentos;
  const isValidTotal = total === 100;
  const totalMonthly = getTotalMonthlyIncome(sources);

  const pendingValid = newName.trim() && parseNum(newAmount) > 0;

  const addSource = () => {
    const val = parseNum(newAmount);
    if (!newName.trim() || val <= 0) return;
    setSources([...sources, { id: crypto.randomUUID(), name: newName.trim(), amount: val, frequency: newFreq }]);
    setNewName(""); setNewAmount(""); setNewFreq("monthly");
  };

  const canContinue = sources.length > 0 || pendingValid;

  const handleContinue = () => {
    let finalSources = [...sources];
    if (pendingValid) {
      finalSources.push({ id: crypto.randomUUID(), name: newName.trim(), amount: parseNum(newAmount), frequency: newFreq });
    }
    setSources(finalSources);
    setStep(1);
  };

  const removeSource = (id: string) => setSources(sources.filter((s) => s.id !== id));

  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-in fade-in duration-500">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-heading">FinFlow</h1>
            <p className="text-muted-foreground">Adicione suas fontes de renda para começar.</p>
          </div>

          <div className="finance-card space-y-3">
            <label className="text-xs font-medium text-muted-foreground">Fontes de Renda</label>

            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(s.amount)} {s.frequency === "once" ? "(único)" : `${FREQ_LABELS[s.frequency].toLowerCase()} → ${formatCurrency(normalizeToMonthly(s.amount, s.frequency))}/mês`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeSource(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
              <Input placeholder="Nome (ex: Salário)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input placeholder="0,00" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="h-9 text-sm pl-9" inputMode="decimal" />
                </div>
                <Select value={newFreq} onValueChange={(v) => setNewFreq(v as IncomeFrequency)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ_LABELS) as IncomeFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-full h-9" disabled={!newName.trim() || parseNum(newAmount) <= 0} onClick={addSource}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Renda
              </Button>
            </div>

            {(sources.length > 0 || pendingValid) && (
              <div className="text-center pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Renda mensal total</p>
                <p className="text-2xl font-bold font-heading">{formatCurrency(
                  totalMonthly + (pendingValid ? normalizeToMonthly(parseNum(newAmount), newFreq) : 0)
                )}</p>
              </div>
            )}
          </div>

          <Button className="w-full h-12 text-base font-semibold" disabled={!canContinue} onClick={handleContinue}>
            Continuar <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  const sliders = [
    { key: "essenciais" as const, label: "Essenciais", emoji: "🏠" },
    { key: "desejos" as const, label: "Desejos", emoji: "💜" },
    { key: "reserva_investimentos" as const, label: "Reserva / Investimentos", emoji: "🛡️" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-1">
            <Percent className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-heading">Defina suas proporções</h2>
          <p className="text-sm text-muted-foreground">
            Renda: <span className="font-semibold text-foreground">{formatCurrency(totalMonthly)}</span>
          </p>
        </div>

        <div className="space-y-4">
          {sliders.map(({ key, label, emoji }) => (
            <div key={key} className="finance-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <span className="font-medium text-sm">{label}</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-heading">{percentages[key]}%</span>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency((totalMonthly * percentages[key]) / 100)}
                  </p>
                </div>
              </div>
              <Slider value={[percentages[key]]} onValueChange={([v]) => setPercentages((p) => ({ ...p, [key]: v }))} max={100} min={0} step={1} />
            </div>
          ))}
        </div>

        <div className={`text-center text-sm font-medium ${isValidTotal ? "text-primary" : "text-destructive"}`}>
          Total: {total}% {!isValidTotal && "(deve ser 100%)"}
        </div>

        <Button className="w-full h-12 text-base font-semibold" disabled={!isValidTotal} onClick={() => onComplete(sources, percentages)}>
          Começar a controlar <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SetupWizard;
