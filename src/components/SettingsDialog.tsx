import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Percentages } from "@/types/finance";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: number;
  percentages: Percentages;
  onSave: (income: number, percentages: Percentages) => void;
  onReset: () => void;
}

const LABELS: Record<keyof Percentages, string> = {
  essenciais: "Essenciais",
  desejos: "Desejos",
  reserva: "Reserva",
  investimentos: "Investimentos",
};

const SettingsDialog = ({ open, onOpenChange, income, percentages, onSave, onReset }: SettingsDialogProps) => {
  const [newIncome, setNewIncome] = useState(income.toString());
  const [pcts, setPcts] = useState(percentages);
  const total = pcts.essenciais + pcts.desejos + pcts.reserva + pcts.investimentos;

  const handleSave = () => {
    const val = parseFloat(newIncome.replace(/[^\d.,]/g, "").replace(",", "."));
    if (val > 0 && total === 100) {
      onSave(val, pcts);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Renda Mensal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input value={newIncome} onChange={(e) => setNewIncome(e.target.value)} className="pl-10" />
            </div>
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
            <Button variant="outline" className="flex-1" onClick={onReset}>
              Resetar Mês
            </Button>
            <Button className="flex-1 font-semibold" disabled={total !== 100} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
