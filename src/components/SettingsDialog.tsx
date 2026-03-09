import { useState } from "react";
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
  onSave: (percentages: Percentages) => void;
  onAddIncome: (name: string, amount: number, frequency: IncomeFrequency) => void;
  onDeleteIncome: (id: string) => void;
  onReset: () => void;
}

const LABELS: Record<keyof Percentages, string> = {
  essenciais: "Essenciais",
  desejos: "Desejos",
  reserva_investimentos: "Reserva / Investimentos",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SettingsDialog = ({ open, onOpenChange, incomeSources, percentages, onSave, onAddIncome, onDeleteIncome, onReset }: SettingsDialogProps) => {
  const [pcts, setPcts] = useState(percentages);
  const total = pcts.essenciais + pcts.desejos + pcts.reserva_investimentos;
  const monthlyIncome = getTotalMonthlyIncome(incomeSources);

  const handleSave = () => {
    if (total === 100) {
      onSave(pcts);
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Fontes de Renda · <span className="text-foreground font-semibold">{fmt(monthlyIncome)}/mês</span>
            </label>
            <IncomeManager sources={incomeSources} onAdd={onAddIncome} onDelete={onDeleteIncome} compact />
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
            <Button className="flex-1 font-semibold" disabled={total !== 100} onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
