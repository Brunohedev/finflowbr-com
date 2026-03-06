import { useState } from "react";
import { Investment } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, TrendingUp } from "lucide-react";

interface InvestimentosViewProps {
  budget: number;
  spent: number;
  investments: Investment[];
  currentMonth: string;
  onBack: () => void;
  onAddInvestment: (name: string, amount: number, note?: string) => void;
  onDeleteInvestment: (id: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const InvestimentosView = ({
  budget, spent, investments, currentMonth, onBack,
  onAddInvestment, onDeleteInvestment,
}: InvestimentosViewProps) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

  const monthInvestments = investments.filter((i) => i.date.startsWith(currentMonth));
  const totalAll = investments.reduce((s, i) => s + i.amount, 0);

  const handleAdd = () => {
    const val = parseNum(amount);
    if (!name.trim() || val <= 0) return;
    onAddInvestment(name.trim(), val, note.trim() || undefined);
    setName(""); setAmount(""); setNote(""); setShowForm(false);
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-lg">Investimentos</h2>
          <p className="text-xs text-muted-foreground">
            Orçamento mensal: {fmt(budget)} · Investido este mês: {fmt(spent)}
          </p>
        </div>
      </div>

      {/* Budget progress */}
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            spent / budget >= 1 ? "bg-destructive" : spent / budget >= 0.8 ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${Math.min((spent / budget) * 100, 100)}%` }}
        />
      </div>

      {/* Total invested */}
      <div className="finance-card text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Investido (todos os meses)</p>
        <p className="text-2xl font-bold font-heading mt-1">{fmt(totalAll)}</p>
      </div>

      {/* Add investment */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-semibold text-sm">Meus Investimentos</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Novo</>}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
            <Input placeholder="Nome (ex: Ações, ETFs)" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
              <Input placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-sm pl-9" inputMode="decimal" />
            </div>
            <Textarea placeholder="Notas (opcional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-sm" />
            <Button size="sm" className="w-full h-9" disabled={!name.trim() || parseNum(amount) <= 0} onClick={handleAdd}>
              Registrar Investimento
            </Button>
          </div>
        )}

        {/* Monthly investments */}
        {monthInvestments.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhum investimento este mês</p>
        )}

        {monthInvestments.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 group">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{inv.name}</p>
              <p className="text-xs text-muted-foreground">{inv.date}{inv.note && ` · ${inv.note}`}</p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <span className="text-sm font-semibold font-heading">{fmt(inv.amount)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDeleteInvestment(inv.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InvestimentosView;
