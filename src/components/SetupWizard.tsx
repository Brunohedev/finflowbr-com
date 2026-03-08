import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Percent, ArrowRight } from "lucide-react";
import { Percentages } from "@/types/finance";

interface SetupWizardProps {
  onComplete: (income: number, percentages: Percentages) => void;
}

const SetupWizard = ({ onComplete }: SetupWizardProps) => {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [percentages, setPercentages] = useState<Percentages>({
    essenciais: 50, desejos: 30, reserva_investimentos: 20,
  });

  const total = percentages.essenciais + percentages.desejos + percentages.reserva_investimentos;
  const isValidTotal = total === 100;
  const incomeValue = parseFloat(income.replace(/[^\d.,]/g, "").replace(",", "."));

  const handleSliderChange = (key: keyof Percentages, value: number) => {
    setPercentages((prev) => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-heading">FinFlow</h1>
            <p className="text-muted-foreground">
              Organize suas finanças com o método 50-30-20 personalizável.
            </p>
          </div>
          <div className="finance-card space-y-4">
            <label className="text-sm font-medium text-muted-foreground">Renda mensal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="pl-10 text-2xl h-14 font-heading font-semibold"
              />
            </div>
          </div>
          <Button className="w-full h-12 text-base font-semibold" disabled={!incomeValue || incomeValue <= 0} onClick={() => setStep(1)}>
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
            Renda: <span className="font-semibold text-foreground">{formatCurrency(incomeValue)}</span>
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
                    {formatCurrency((incomeValue * percentages[key]) / 100)}
                  </p>
                </div>
              </div>
              <Slider
                value={[percentages[key]]}
                onValueChange={([v]) => handleSliderChange(key, v)}
                max={100}
                min={0}
                step={1}
              />
            </div>
          ))}
        </div>

        <div className={`text-center text-sm font-medium ${isValidTotal ? "text-primary" : "text-destructive"}`}>
          Total: {total}% {!isValidTotal && "(deve ser 100%)"}
        </div>

        <Button className="w-full h-12 text-base font-semibold" disabled={!isValidTotal} onClick={() => onComplete(incomeValue, percentages)}>
          Começar a controlar <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SetupWizard;
