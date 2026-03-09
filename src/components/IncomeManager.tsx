import { useState } from "react";
import { IncomeSource, IncomeFrequency, normalizeToMonthly } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface IncomeManagerProps {
  sources: IncomeSource[];
  onAdd: (name: string, amount: number, frequency: IncomeFrequency) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const FREQ_LABELS: Record<IncomeFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  once: "Valor único",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

const IncomeManager = ({ sources, onAdd, onDelete, compact }: IncomeManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<IncomeFrequency>("monthly");

  const handleAdd = () => {
    const val = parseNum(amount);
    if (!name.trim() || val <= 0) return;
    onAdd(name.trim(), val, frequency);
    setName(""); setAmount(""); setFrequency("monthly"); setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {sources.map((s) => (
        <div key={s.id} className="flex items-center justify-between py-1.5 group">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{s.name}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(s.amount)} {s.frequency === "once" ? "(único)" : `${FREQ_LABELS[s.frequency].toLowerCase()} → ${fmt(normalizeToMonthly(s.amount, s.frequency))}/mês`}
            </p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onDelete(s.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      {showForm ? (
        <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
          <Input placeholder="Nome (ex: Salário)" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
              <Input placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-sm pl-9" inputMode="decimal" />
            </div>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as IncomeFrequency)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQ_LABELS) as IncomeFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-9" disabled={!name.trim() || parseNum(amount) <= 0} onClick={handleAdd}>
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar renda
        </Button>
      )}
    </div>
  );
};

export default IncomeManager;
