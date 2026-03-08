import { useState } from "react";
import { EmergencyReserve, FinancialGoal, Investment } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Target, Shield, CalendarDays, Pin, PinOff, TrendingUp } from "lucide-react";

interface Props {
  budget: number;
  spent: number;
  emergencyReserves: EmergencyReserve[];
  financialGoals: FinancialGoal[];
  investments: Investment[];
  currentMonth: string;
  onBack: () => void;
  onAddReserve: (name: string, targetAmount: number) => void;
  onDeleteReserve: (id: string) => void;
  onUpdateReserve: (id: string, updates: { name?: string; targetAmount?: number }) => void;
  onAddReserveContribution: (reserveId: string, amount: number, note?: string) => void;
  onToggleReservePin: (id: string) => void;
  onAddGoal: (name: string, targetAmount: number, deadline?: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onAddGoalContribution: (goalId: string, amount: number, note?: string) => void;
  onUpdateGoal: (goalId: string, updates: { name?: string; targetAmount?: number; deadline?: string }) => void;
  onToggleGoalPin: (goalId: string) => void;
  onAddInvestment: (name: string, amount: number, note?: string) => void;
  onDeleteInvestment: (id: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const parseNum = (s: string) => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

const ReservaInvestimentosView = ({
  budget, spent, emergencyReserves, financialGoals, investments, currentMonth, onBack,
  onAddReserve, onDeleteReserve, onUpdateReserve, onAddReserveContribution, onToggleReservePin,
  onAddGoal, onDeleteGoal, onAddGoalContribution, onUpdateGoal, onToggleGoalPin,
  onAddInvestment, onDeleteInvestment,
}: Props) => {
  // Reserve form state
  const [showNewReserve, setShowNewReserve] = useState(false);
  const [newReserveName, setNewReserveName] = useState("");
  const [newReserveTarget, setNewReserveTarget] = useState("");
  const [reserveContribId, setReserveContribId] = useState<string | null>(null);
  const [reserveContribAmount, setReserveContribAmount] = useState("");
  const [reserveContribNote, setReserveContribNote] = useState("");

  // Goal form state
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [goalContribId, setGoalContribId] = useState<string | null>(null);
  const [goalContribAmount, setGoalContribAmount] = useState("");

  // Investment form state
  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [invName, setInvName] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invNote, setInvNote] = useState("");

  const monthInvestments = investments.filter((i) => i.date.startsWith(currentMonth));

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-lg">Reserva / Investimentos</h2>
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

      {/* ─── RESERVA DE EMERGÊNCIA ─── */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-semibold text-sm">Reserva de Emergência</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewReserve(!showNewReserve)}>
            {showNewReserve ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Adicionar reserva</>}
          </Button>
        </div>

        {showNewReserve && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
            <Input placeholder="Nome da reserva" value={newReserveName} onChange={(e) => setNewReserveName(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Valor alvo" value={newReserveTarget} onChange={(e) => setNewReserveTarget(e.target.value)} className="h-9 text-sm" inputMode="decimal" />
            <Button
              size="sm"
              className="w-full h-9"
              disabled={!newReserveName.trim() || parseNum(newReserveTarget) <= 0}
              onClick={() => {
                onAddReserve(newReserveName.trim(), parseNum(newReserveTarget));
                setNewReserveName(""); setNewReserveTarget(""); setShowNewReserve(false);
              }}
            >
              Criar Reserva
            </Button>
          </div>
        )}

        {emergencyReserves.length === 0 && !showNewReserve && (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhuma reserva criada</p>
        )}

        {emergencyReserves.map((reserve) => {
          const pct = reserve.targetAmount > 0 ? Math.min((reserve.currentAmount / reserve.targetAmount) * 100, 100) : 0;
          return (
            <div key={reserve.id} className="space-y-2 p-3 rounded-lg bg-secondary/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{reserve.name}</p>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{fmt(reserve.currentAmount)}</span>
                    <span className="ml-3">{reserve.targetAmount > 0 ? `Meta: ${fmt(reserve.targetAmount)}` : "Sem meta definida"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => onToggleReservePin(reserve.id)}
                    title={reserve.pinnedToDashboard ? "Remover do dashboard" : "Fixar no dashboard"}
                  >
                    {reserve.pinnedToDashboard ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteReserve(reserve.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {reserve.targetAmount > 0 && (
                <>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-right font-medium text-primary">{pct.toFixed(0)}% completo</p>
                </>
              )}

              {reserveContribId === reserve.id ? (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input placeholder="Valor" value={reserveContribAmount} onChange={(e) => setReserveContribAmount(e.target.value)} className="h-8 text-xs" inputMode="decimal" autoFocus />
                    <Input placeholder="Nota (opcional)" value={reserveContribNote} onChange={(e) => setReserveContribNote(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs flex-1"
                      onClick={() => {
                        const val = parseNum(reserveContribAmount);
                        if (val > 0) {
                          onAddReserveContribution(reserve.id, val, reserveContribNote || undefined);
                          setReserveContribAmount(""); setReserveContribNote(""); setReserveContribId(null);
                        }
                      }}
                    >
                      Adicionar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setReserveContribId(null)}>✕</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setReserveContribId(reserve.id)}>
                  <Plus className="w-3 h-3 mr-1" /> Contribuir
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── METAS ─── */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="font-heading font-semibold text-sm">Metas</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewGoal(!showNewGoal)}>
            {showNewGoal ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Adicionar meta</>}
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
                  {goal.deadline && <p className="text-xs text-muted-foreground">Prazo: {goal.deadline}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => onToggleGoalPin(goal.id)}
                    title={goal.pinnedToDashboard ? "Remover do dashboard" : "Fixar no dashboard"}
                  >
                    {goal.pinnedToDashboard ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteGoal(goal.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
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
                  <Input placeholder="Valor" value={goalContribAmount} onChange={(e) => setGoalContribAmount(e.target.value)} className="h-8 text-xs" inputMode="decimal" autoFocus />
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
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setGoalContribId(null)}>✕</Button>
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

      {/* ─── INVESTIMENTOS ─── */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-semibold text-sm">Investimentos</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewInvestment(!showNewInvestment)}>
            {showNewInvestment ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Novo</>}
          </Button>
        </div>

        {showNewInvestment && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
            <Input placeholder="Nome (ex: Ações, ETFs)" value={invName} onChange={(e) => setInvName(e.target.value)} className="h-9 text-sm" />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
              <Input placeholder="0,00" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="h-9 text-sm pl-9" inputMode="decimal" />
            </div>
            <Textarea placeholder="Notas (opcional)" value={invNote} onChange={(e) => setInvNote(e.target.value)} rows={2} className="text-sm" />
            <Button
              size="sm"
              className="w-full h-9"
              disabled={!invName.trim() || parseNum(invAmount) <= 0}
              onClick={() => {
                onAddInvestment(invName.trim(), parseNum(invAmount), invNote.trim() || undefined);
                setInvName(""); setInvAmount(""); setInvNote(""); setShowNewInvestment(false);
              }}
            >
              Registrar Investimento
            </Button>
          </div>
        )}

        {monthInvestments.length === 0 && !showNewInvestment && (
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

export default ReservaInvestimentosView;
