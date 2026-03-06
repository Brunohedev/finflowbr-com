import { useState } from "react";
import { EmergencyFund, FinancialGoal } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Target, Shield, CalendarDays } from "lucide-react";

interface ReservaViewProps {
  budget: number;
  spent: number;
  emergencyFund: EmergencyFund;
  financialGoals: FinancialGoal[];
  onBack: () => void;
  onUpdateEmergencyTarget: (target: number) => void;
  onAddEmergencyContribution: (amount: number, note?: string) => void;
  onAddGoal: (name: string, targetAmount: number, deadline?: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onAddGoalContribution: (goalId: string, amount: number, note?: string) => void;
  onUpdateGoal: (goalId: string, updates: { name?: string; targetAmount?: number; deadline?: string }) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const ReservaView = ({
  budget, spent, emergencyFund, financialGoals, onBack,
  onUpdateEmergencyTarget, onAddEmergencyContribution,
  onAddGoal, onDeleteGoal, onAddGoalContribution, onUpdateGoal,
}: ReservaViewProps) => {
  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [emergencyTarget, setEmergencyTarget] = useState(emergencyFund.targetAmount.toString());

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");

  const [goalContribId, setGoalContribId] = useState<string | null>(null);
  const [goalContribAmount, setGoalContribAmount] = useState("");

  const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

  const emergencyPct = emergencyFund.targetAmount > 0
    ? Math.min((emergencyFund.currentAmount / emergencyFund.targetAmount) * 100, 100)
    : 0;

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-lg">Reserva</h2>
          <p className="text-xs text-muted-foreground">
            Alocado: {fmt(budget)} · Usado: {fmt(spent)}
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

      {/* Emergency Fund */}
      <div className="finance-card space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm">Reserva de Emergência</h3>
        </div>

        {emergencyFund.targetAmount > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Acumulado: {fmt(emergencyFund.currentAmount)}</span>
              <span>Meta: {fmt(emergencyFund.targetAmount)}</span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${emergencyPct}%` }}
              />
            </div>
            <p className="text-xs text-right font-medium text-primary">
              {emergencyPct.toFixed(0)}% completo
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { setEmergencyTarget(emergencyFund.targetAmount.toString()); setShowEmergencyForm(true); }}
            >
              Editar meta
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowEmergencyForm(true)}
          >
            Definir meta de emergência
          </Button>
        )}

        {showEmergencyForm && (
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs text-muted-foreground">Valor da meta</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 10000"
                value={emergencyTarget}
                onChange={(e) => setEmergencyTarget(e.target.value)}
                className="h-9 text-sm"
                inputMode="decimal"
              />
              <Button
                size="sm"
                className="h-9 px-3"
                onClick={() => {
                  const val = parseNum(emergencyTarget);
                  if (val > 0) { onUpdateEmergencyTarget(val); setShowEmergencyForm(false); }
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Add contribution */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-xs text-muted-foreground">Adicionar contribuição</label>
          <div className="flex gap-2">
            <Input
              placeholder="Valor"
              value={contribAmount}
              onChange={(e) => setContribAmount(e.target.value)}
              className="h-9 text-sm"
              inputMode="decimal"
            />
            <Input
              placeholder="Nota (opcional)"
              value={contribNote}
              onChange={(e) => setContribNote(e.target.value)}
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={() => {
                const val = parseNum(contribAmount);
                if (val > 0) {
                  onAddEmergencyContribution(val, contribNote || undefined);
                  setContribAmount("");
                  setContribNote("");
                }
              }}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Recent contributions */}
        {emergencyFund.contributions.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Histórico</p>
            {emergencyFund.contributions
              .slice(-5)
              .reverse()
              .map((c) => (
                <div key={c.id} className="flex justify-between py-1 text-xs">
                  <span className="text-muted-foreground">{c.date} {c.note && `· ${c.note}`}</span>
                  <span className="font-semibold font-heading text-primary">+{fmt(c.amount)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Financial Goals */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="font-heading font-semibold text-sm">Metas</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewGoal(!showNewGoal)}>
            {showNewGoal ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Nova</>}
          </Button>
        </div>

        {showNewGoal && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
            <Input placeholder="Nome da meta" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Valor alvo" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} className="h-9 text-sm" inputMode="decimal" />
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <Input type="date" value={newGoalDeadline} onChange={(e) => setNewGoalDeadline(e.target.value)} className="h-9 text-sm" />
            </div>
            <Button
              size="sm"
              className="w-full h-9"
              disabled={!newGoalName.trim() || parseNum(newGoalTarget) <= 0}
              onClick={() => {
                onAddGoal(newGoalName.trim(), parseNum(newGoalTarget), newGoalDeadline || undefined);
                setNewGoalName(""); setNewGoalTarget(""); setNewGoalDeadline(""); setShowNewGoal(false);
              }}
            >
              Criar Meta
            </Button>
          </div>
        )}

        {financialGoals.length === 0 && !showNewGoal && (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhuma meta criada</p>
        )}

        {financialGoals.map((goal) => {
          const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
          return (
            <div key={goal.id} className="space-y-2 p-3 rounded-lg bg-secondary/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{goal.name}</p>
                  {goal.deadline && (
                    <p className="text-xs text-muted-foreground">Prazo: {goal.deadline}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteGoal(goal.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmt(goal.currentAmount)}</span>
                <span>{goal.targetAmount > 0 ? fmt(goal.targetAmount) : "Sem meta definida"}</span>
              </div>
              {goal.targetAmount > 0 && (
                <>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-right font-medium text-accent-foreground">{pct.toFixed(0)}%</p>
                </>
              )}

              {goalContribId === goal.id ? (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Valor"
                    value={goalContribAmount}
                    onChange={(e) => setGoalContribAmount(e.target.value)}
                    className="h-8 text-xs"
                    inputMode="decimal"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const val = parseNum(goalContribAmount);
                      if (val > 0) { onAddGoalContribution(goal.id, val); setGoalContribAmount(""); setGoalContribId(null); }
                    }}
                  >
                    Adicionar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setGoalContribId(null)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setGoalContribId(goal.id)}>
                  <Plus className="w-3 h-3 mr-1" /> Contribuir
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReservaView;
