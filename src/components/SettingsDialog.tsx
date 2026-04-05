import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Percentages, IncomeSource, IncomeFrequency, getTotalMonthlyIncome } from "@/types/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import IncomeManager from "@/components/IncomeManager";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: number;
  incomeSources: IncomeSource[];
  percentages: Percentages;
  onSave: (percentages: Percentages, income: number) => void;
  onReset: () => void;
  onAddSource: (name: string, amount: number, frequency: IncomeFrequency) => void;
  onDeleteSource: (id: string) => void;
}

const LABELS: Record<keyof Percentages, string> = {
  essenciais: "Essenciais",
  desejos: "Desejos",
  reserva_investimentos: "Reserva / Investimentos",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SettingsDialog = ({ open, onOpenChange, income, incomeSources, percentages, onSave, onReset }: SettingsDialogProps) => {
  const [pcts, setPcts] = useState(percentages);
  const [incomeInput, setIncomeInput] = useState(String(income));
  const total = pcts.essenciais + pcts.desejos + pcts.reserva_investimentos;
  const defaultIncome = getTotalMonthlyIncome(incomeSources);
  const parsedIncome = Number.parseFloat(incomeInput);
  const isIncomeValid = Number.isFinite(parsedIncome) && parsedIncome > 0;

  useEffect(() => {
    if (!open) return;
    setPcts(percentages);
    setIncomeInput(String(income));
  }, [open, percentages, income]);

  const handleSave = () => {
    if (total === 100 && isIncomeValid) {
      onSave(pcts, parsedIncome);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">
              Renda deste mês · <span className="text-foreground font-semibold">{fmt(income)}</span>
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={incomeInput}
              onChange={(e) => setIncomeInput(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Base padrão pelas fontes de renda: <span className="text-foreground font-semibold">{fmt(defaultIncome)}/mês</span>
            </p>
          </div>

          {(Object.keys(LABELS) as (keyof Percentages)[]).map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{LABELS[key]}</span>
                <span className="font-heading font-bold">{pcts[key]}%</span>
              </div>
              <Slider value={[pcts[key]]} onValueChange={([v]) => setPcts((p) => ({ ...p, [key]: v }))} max={100} min={0} step={1} />
            </div>
          ))}

          <p className={`text-center text-sm font-medium ${total === 100 ? "text-primary" : "text-destructive"}`}>
            Total: {total}%
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onReset}>Resetar Mês</Button>
            <Button className="flex-1 font-semibold" disabled={total !== 100 || !isIncomeValid} onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
