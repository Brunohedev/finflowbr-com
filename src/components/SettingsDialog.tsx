import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Percentages, IncomeSource, IncomeFrequency, getTotalMonthlyIncome } from "@/types/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import IncomeManager from "@/components/IncomeManager";
import { RotateCcw } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: number;
  incomeSources: IncomeSource[];
  percentages: Percentages;
  activeMonth: string;
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
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const MONTH_LABELS: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_LABELS[month] || month}/${year}`;
};

const SettingsDialog = ({
  open, onOpenChange, income, incomeSources, percentages, activeMonth,
  onSave, onReset, onAddSource, onDeleteSource
}: SettingsDialogProps) => {
  const [pcts, setPcts] = useState(percentages);
  const [incomeInput, setIncomeInput] = useState(String(income));
  const total = pcts.essenciais + pcts.desejos + pcts.reserva_investimentos;
  const defaultIncome = getTotalMonthlyIncome(incomeSources);
  const parsedIncome = Number.parseFloat(incomeInput);
  const isIncomeValid = Number.isFinite(parsedIncome) && parsedIncome > 0;
  const hasOverride = isIncomeValid && Math.abs(parsedIncome - defaultIncome) >= 0.01;

  useEffect(() => {
    if (!open) return;
    setPcts(percentages);
    setIncomeInput(String(income));
  }, [open, percentages, income]);

  const handleAddIncomeSource = (name: string, amount: number, frequency: IncomeFrequency) => {
    if (frequency === "once") {
      const currentIncome = Number.parseFloat(incomeInput);
      const safeIncome = Number.isFinite(currentIncome) ? currentIncome : income;
      setIncomeInput(String(safeIncome + amount));
      return;
    }

    onAddSource(name, amount, frequency);
  };

  const handleSave = () => {
    if (total === 100 && isIncomeValid) {
      onSave(pcts, parsedIncome);
      onOpenChange(false);
    }
  };

  const restoreDefault = () => {
    setIncomeInput(String(defaultIncome));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Global income sources */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">
              Fontes de Renda <span className="text-muted-foreground/70">(base para todos os meses)</span>
            </label>
            <IncomeManager sources={incomeSources} onAdd={handleAddIncomeSource} onDelete={onDeleteSource} compact />
            <p className="text-xs text-muted-foreground">
              Total mensal base: <span className="text-foreground font-semibold">{fmt(defaultIncome)}</span>
            </p>
          </div>

          {/* Month-specific override */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/30">
            <label className="text-xs font-medium text-foreground block">
              Renda somente para {formatMonth(activeMonth)}
            </label>
            <p className="text-[11px] text-muted-foreground">
              Alterar aqui afeta <strong>apenas</strong> este mês. Os demais meses usam o valor base.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                placeholder="0,00"
                className="flex-1"
              />
              {hasOverride && (
                <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" title="Restaurar valor base" onClick={restoreDefault}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
            {hasOverride && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                ⚠ Valor diferente da base ({fmt(defaultIncome)}). Só afeta {formatMonth(activeMonth)}.
              </p>
            )}
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
