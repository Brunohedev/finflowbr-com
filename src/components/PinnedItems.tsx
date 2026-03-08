import { EmergencyReserve, FinancialGoal } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { PinOff, Shield, Target } from "lucide-react";

interface PinnedItemsProps {
  reserves: EmergencyReserve[];
  goals: FinancialGoal[];
  onUnpinReserve: (id: string) => void;
  onUnpinGoal: (id: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const PinnedItems = ({ reserves, goals, onUnpinReserve, onUnpinGoal }: PinnedItemsProps) => {
  const pinnedReserves = reserves.filter((r) => r.pinnedToDashboard);
  const pinnedGoals = goals.filter((g) => g.pinnedToDashboard);

  if (pinnedReserves.length === 0 && pinnedGoals.length === 0) return null;

  return (
    <div className="space-y-2">
      {pinnedReserves.map((reserve) => {
        const pct = reserve.targetAmount > 0 ? Math.min((reserve.currentAmount / reserve.targetAmount) * 100, 100) : 0;
        return (
          <div key={reserve.id} className="finance-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">{reserve.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => onUnpinReserve(reserve.id)}
              >
                <PinOff className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(reserve.currentAmount)}</span>
              <span>{reserve.targetAmount > 0 ? fmt(reserve.targetAmount) : ""}</span>
            </div>
            {reserve.targetAmount > 0 && (
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}

      {pinnedGoals.map((goal) => {
        const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
        return (
          <div key={goal.id} className="finance-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-accent" />
                <p className="text-xs font-semibold">{goal.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => onUnpinGoal(goal.id)}
              >
                <PinOff className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(goal.currentAmount)}</span>
              <span>{goal.targetAmount > 0 ? fmt(goal.targetAmount) : ""}</span>
            </div>
            {goal.targetAmount > 0 && (
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PinnedItems;
