import { useState, useMemo } from "react";
import { EmergencyReserve, FinancialGoal, Investment } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Plus, Trash2, Target, Shield, CalendarDays, Pin, PinOff,
  TrendingUp, Trophy, ArrowUpCircle, PiggyBank, History
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

type ModalType = "reserve" | "investment" | null;

const ReservaInvestimentosView = ({
  budget, spent, emergencyReserves, financialGoals, investments, currentMonth, onBack,
  onAddReserve, onDeleteReserve, onUpdateReserve, onAddReserveContribution, onToggleReservePin,
  onAddGoal, onDeleteGoal, onAddGoalContribution, onUpdateGoal, onToggleGoalPin,
  onAddInvestment, onDeleteInvestment,
}: Props) => {
  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalReserveId, setModalReserveId] = useState<string | null>(null);
  const [modalAmount, setModalAmount] = useState("");
  const [modalDate, setModalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [modalNote, setModalNote] = useState("");

  // Reserve form
  const [showNewReserve, setShowNewReserve] = useState(false);
  const [newReserveName, setNewReserveName] = useState("");
  const [newReserveTarget, setNewReserveTarget] = useState("");

  // Goal form
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [goalContribId, setGoalContribId] = useState<string | null>(null);
  const [goalContribAmount, setGoalContribAmount] = useState("");

  // Investment form (inline)
  const [showNewInvestment, setShowNewInvestment] = useState(false);
  const [invName, setInvName] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invNote, setInvNote] = useState("");

  const monthInvestments = investments.filter((i) => i.date.startsWith(currentMonth));

  // Totals
  const reserveTotal = emergencyReserves.reduce((s, r) => s + r.currentAmount, 0);
  const reserveTarget = emergencyReserves.reduce((s, r) => s + r.targetAmount, 0);
  const investmentTotal = investments.reduce((s, i) => s + i.amount, 0);

  // Combined transaction history
  const history = useMemo(() => {
    const items: { id: string; type: "reserve" | "investment"; name: string; amount: number; date: string; note?: string }[] = [];

    emergencyReserves.forEach((r) => {
      r.contributions.forEach((c) => {
        items.push({ id: c.id, type: "reserve", name: r.name, amount: c.amount, date: c.date, note: c.note });
      });
    });

    investments.forEach((inv) => {
      items.push({ id: inv.id, type: "investment", name: inv.name, amount: inv.amount, date: inv.date, note: inv.note });
    });

    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  }, [emergencyReserves, investments]);

  const openReserveModal = (reserveId?: string) => {
    setModalType("reserve");
    setModalReserveId(reserveId || (emergencyReserves[0]?.id ?? null));
    setModalAmount("");
    setModalDate(format(new Date(), "yyyy-MM-dd"));
    setModalNote("");
  };

  const openInvestmentModal = () => {
    setModalType("investment");
    setModalAmount("");
    setModalDate(format(new Date(), "yyyy-MM-dd"));
    setModalNote("");
    setInvName("");
  };

  const handleModalConfirm = () => {
    const val = parseNum(modalAmount);
    if (val <= 0) return;

    if (modalType === "reserve" && modalReserveId) {
      onAddReserveContribution(modalReserveId, val, modalNote.trim() || undefined);
    } else if (modalType === "investment") {
      onAddInvestment(invName.trim() || "Investimento", val, modalNote.trim() || undefined);
    }
    setModalType(null);
  };

  const reservePct = reserveTarget > 0 ? Math.min((reserveTotal / reserveTarget) * 100, 100) : 0;

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-lg">Reserva / Investimentos</h2>
          <p className="text-xs text-muted-foreground">Usado este mês: {fmt(spent)}</p>
        </div>
      </div>

      {/* ─── QUICK ACTION BUTTONS ─── */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-14 flex flex-col items-center gap-1 rounded-xl"
          variant="outline"
          onClick={() => openReserveModal()}
        >
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-xs font-semibold">Adicionar à Reserva</span>
        </Button>
        <Button
          className="h-14 flex flex-col items-center gap-1 rounded-xl"
          variant="outline"
          onClick={openInvestmentModal}
        >
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="text-xs font-semibold">Adicionar aos Investimentos</span>
        </Button>
      </div>

      {/* ─── RESERVA SUMMARY CARD ─── */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-semibold text-sm">Reserva de Emergência</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewReserve(!showNewReserve)}>
            {showNewReserve ? "Cancelar" : <><Plus className="w-3.5 h-3.5" /> Nova reserva</>}
          </Button>
        </div>

        {/* Reserve overview */}
        <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Valor Atual</span>
            <span className="text-lg font-bold font-heading">{fmt(reserveTotal)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${reserveTarget > 0 ? reservePct : (reserveTotal > 0 ? 100 : 0)}%`,
                backgroundColor: "hsl(217, 91%, 60%)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{reservePct.toFixed(0)}%</span>
            <span>Meta: {reserveTarget > 0 ? fmt(reserveTarget) : "Não definida"}</span>
          </div>
          <Button size="sm" className="w-full h-9 gap-1" onClick={() => openReserveModal()}>
            <PiggyBank className="w-4 h-4" /> Adicionar à Reserva
          </Button>
        </div>

        {showNewReserve && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
            <Input placeholder="Nome da reserva" value={newReserveName} onChange={(e) => setNewReserveName(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Valor alvo" value={newReserveTarget} onChange={(e) => setNewReserveTarget(e.target.value)} className="h-9 text-sm" inputMode="decimal" />
            <Button
              size="sm" className="w-full h-9"
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

        {/* Individual reserves */}
        {emergencyReserves.map((reserve) => {
          const pct = reserve.targetAmount > 0 ? Math.min((reserve.currentAmount / reserve.targetAmount) * 100, 100) : 0;
          const goalReached = reserve.targetAmount > 0 && reserve.currentAmount >= reserve.targetAmount;
          const suggestedNewTarget = reserve.targetAmount > 0 ? reserve.targetAmount * 2 : reserve.currentAmount * 2;
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
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => onToggleReservePin(reserve.id)}
                    title={reserve.pinnedToDashboard ? "Remover do dashboard" : "Fixar no dashboard"}>
                    {reserve.pinnedToDashboard ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteReserve(reserve.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${reserve.targetAmount > 0 ? pct : (reserve.currentAmount > 0 ? 100 : 0)}%`,
                    backgroundColor: "hsl(217, 91%, 60%)",
                  }}
                />
              </div>
              {reserve.targetAmount > 0 && (
                <p className="text-xs text-right font-medium" style={{ color: "hsl(217, 91%, 60%)" }}>
                  {pct.toFixed(0)}% completo
                </p>
              )}

              {goalReached && (
                <div className="p-2.5 rounded-lg border space-y-2" style={{ backgroundColor: "hsla(217, 91%, 60%, 0.1)", borderColor: "hsla(217, 91%, 60%, 0.2)" }}>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" style={{ color: "hsl(217, 91%, 60%)" }} />
                    <p className="text-xs font-semibold" style={{ color: "hsl(217, 91%, 60%)" }}>
                      🎉 Meta atingida! Continue guardando!
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Que tal uma nova meta de <strong>{fmt(suggestedNewTarget)}</strong>?
                  </p>
                  <Button size="sm" className="h-7 text-xs w-full gap-1 text-primary-foreground"
                    style={{ backgroundColor: "hsl(217, 91%, 60%)" }}
                    onClick={() => onUpdateReserve(reserve.id, { targetAmount: suggestedNewTarget })}>
                    <ArrowUpCircle className="w-3 h-3" /> Aceitar nova meta
                  </Button>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => openReserveModal(reserve.id)}>
                <Plus className="w-3 h-3 mr-1" /> Contribuir
              </Button>
            </div>
          );
        })}
      </div>

      {/* ─── INVESTIMENTOS SUMMARY CARD ─── */}
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

        {/* Investment overview */}
        <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Total Investido</span>
            <span className="text-lg font-bold font-heading">{fmt(investmentTotal)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Este Mês</span>
            <span className="text-sm font-semibold">{fmt(monthInvestments.reduce((s, i) => s + i.amount, 0))}</span>
          </div>
          <Button size="sm" className="w-full h-9 gap-1" onClick={openInvestmentModal}>
            <TrendingUp className="w-4 h-4" /> Adicionar aos Investimentos
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
            <Button size="sm" className="w-full h-9"
              disabled={!invName.trim() || parseNum(invAmount) <= 0}
              onClick={() => {
                onAddInvestment(invName.trim(), parseNum(invAmount), invNote.trim() || undefined);
                setInvName(""); setInvAmount(""); setInvNote(""); setShowNewInvestment(false);
              }}>
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
              <Button variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDeleteInvestment(inv.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── METAS ─── */}
      <div className="finance-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent-foreground" />
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
            <Button size="sm" className="w-full h-9"
              disabled={!newGoalName.trim() || parseNum(newGoalTarget) <= 0}
              onClick={() => {
                onAddGoal(newGoalName.trim(), parseNum(newGoalTarget), newGoalDeadline || undefined);
                setNewGoalName(""); setNewGoalTarget(""); setNewGoalDeadline(""); setShowNewGoal(false);
              }}>
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
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => onToggleGoalPin(goal.id)}
                    title={goal.pinnedToDashboard ? "Remover do dashboard" : "Fixar no dashboard"}>
                    {goal.pinnedToDashboard ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteGoal(goal.id)}>
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
                  <Button size="sm" className="h-8 px-3 text-xs"
                    onClick={() => {
                      const val = parseNum(goalContribAmount);
                      if (val > 0) { onAddGoalContribution(goal.id, val); setGoalContribAmount(""); setGoalContribId(null); }
                    }}>
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

      {/* ─── TRANSACTION HISTORY ─── */}
      {history.length > 0 && (
        <div className="finance-card space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Histórico de Transações</h3>
          </div>
          <div className="space-y-1">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.type === "reserve" ? (
                      <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground ml-5.5">
                    {item.date}
                    {item.note && ` · ${item.note}`}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <span className="text-sm font-semibold font-heading">{fmt(item.amount)}</span>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {item.type === "reserve" ? "Reserva" : "Investimento"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ADD TO RESERVE MODAL ─── */}
      <Dialog open={modalType === "reserve"} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Adicionar à Reserva
            </DialogTitle>
            <DialogDescription>Informe o valor a ser adicionado à sua reserva de emergência</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {emergencyReserves.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reserva</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={modalReserveId || ""}
                  onChange={(e) => setModalReserveId(e.target.value)}
                >
                  {emergencyReserves.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} — {fmt(r.currentAmount)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  placeholder="0,00"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  className="pl-9"
                  inputMode="decimal"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nota (opcional)</Label>
              <Textarea placeholder="Descrição da contribuição..." value={modalNote} onChange={(e) => setModalNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalType(null)}>Cancelar</Button>
            <Button onClick={handleModalConfirm} disabled={parseNum(modalAmount) <= 0}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADD TO INVESTMENT MODAL ─── */}
      <Dialog open={modalType === "investment"} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Adicionar aos Investimentos
            </DialogTitle>
            <DialogDescription>Registre um novo aporte nos seus investimentos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do investimento</Label>
              <Input placeholder="Ex: Ações, ETFs, Renda Fixa" value={invName} onChange={(e) => setInvName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input placeholder="0,00" value={modalAmount} onChange={(e) => setModalAmount(e.target.value)} className="pl-9" inputMode="decimal" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nota (opcional)</Label>
              <Textarea placeholder="Descrição do aporte..." value={modalNote} onChange={(e) => setModalNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalType(null)}>Cancelar</Button>
            <Button onClick={handleModalConfirm} disabled={parseNum(modalAmount) <= 0 || !invName.trim()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReservaInvestimentosView;