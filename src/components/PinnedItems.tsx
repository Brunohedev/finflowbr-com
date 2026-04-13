import { EmergencyReserve, FinancialGoal } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { PinOff, Shield, Target } from "lucide-react";

interface PinnedItemsProps {
  reserves: EmergencyReserve[];
  goals: FinancialGoal[];
  onUnpinReserve: (id: string) => void;
  onUnpinGoal: (id: string) => void;
  onNavigateToReserva: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const PinnedItems = ({ reserves, goals, onUnpinReserve, onUnpinGoal, onNavigateToReserva }: PinnedItemsProps) => {
  const pinnedReserves = reserves.filter((r) => r.pinnedToDashboard);
  const pinnedGoals = goals.filter((g) => g.pinnedToDashboard);

  if (pinnedReserves.length === 0 && pinnedGoals.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-10 flex flex-col gap-2 max-w-[200px]">
      {pinnedReserves.map((reserve) => {
        const pct = reserve.targetAmount > 0 ? Math.min((reserve.currentAmount / reserve.targetAmount) * 100, 100) : 0;
        return (
          <div
            key={reserve.id}
            className="bg-card border border-border rounded-xl p-2.5 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={onNavigateToReserva}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Shield className="w-3 h-3 text-primary shrink-0" />
                <p className="text-[10px] font-semibold truncate">{reserve.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); onUnpinReserve(reserve.id); }}
              >
                <PinOff className="w-2.5 h-2.5" />
              </Button>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
              <span>{fmt(reserve.currentAmount)}</span>
              {reserve.targetAmount > 0 && <span>{Math.round(pct)}%</span>}
            </div>
            {reserve.targetAmount > 0 && (
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}

      {pinnedGoals.map((goal) => {
        const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
        return (
          <div
            key={goal.id}
            className="bg-card border border-border rounded-xl p-2.5 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={onNavigateToReserva}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Target className="w-3 h-3 text-accent shrink-0" />
                <p className="text-[10px] font-semibold truncate">{goal.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); onUnpinGoal(goal.id); }}
              >
                <PinOff className="w-2.5 h-2.5" />
              </Button>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
              <span>{fmt(goal.currentAmount)}</span>
              {goal.targetAmount > 0 && <span>{Math.round(pct)}%</span>}
            </div>
            {goal.targetAmount > 0 && (
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
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
