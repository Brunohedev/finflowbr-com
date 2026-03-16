import { useMemo } from "react";
import { CheckCircle, TrendingUp, Target } from "lucide-react";

interface SavingsTrackerProps {
  monthlyIncome: number;
  savingsPercentage: number;
  monthlySaved: number;
  totalReserve: number;
  currentGoal: number;
  onGoalReached?: (nextGoal: number) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const GOAL_MILESTONES = [5000, 10000, 15000, 20000, 30000, 50000, 75000, 100000, 150000, 200000];

const getNextGoal = (current: number, totalReserve: number): number => {
  const next = GOAL_MILESTONES.find((m) => m > current);
  if (next) return next;
  // If beyond milestones, double the current goal
  return current * 2;
};

const SavingsTracker = ({
  monthlyIncome,
  savingsPercentage,
  monthlySaved,
  totalReserve,
  currentGoal,
  onGoalReached,
}: SavingsTrackerProps) => {
  const monthlyTarget = useMemo(
    () => monthlyIncome * (savingsPercentage / 100),
    [monthlyIncome, savingsPercentage]
  );

  const monthlyStatus = useMemo(() => {
    if (monthlySaved >= monthlyTarget && monthlyTarget > 0) return "exceeded";
    if (monthlySaved > 0) return "partial";
    return "none";
  }, [monthlySaved, monthlyTarget]);

  // Goal loop: if totalReserve >= currentGoal, compute effective goal
  const effectiveGoal = useMemo(() => {
    let goal = currentGoal;
    while (goal > 0 && totalReserve >= goal) {
      goal = getNextGoal(goal, totalReserve);
    }
    return goal;
  }, [currentGoal, totalReserve]);

  const reserveProgress = useMemo(
    () => (effectiveGoal > 0 ? Math.min((totalReserve / effectiveGoal) * 100, 100) : 0),
    [totalReserve, effectiveGoal]
  );

  return (
    <div className="space-y-2">
      {/* Top row: monthly label + monthly values */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {monthlyStatus === "exceeded" ? (
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">
            Reserva / Invest. ({savingsPercentage}%)
          </span>
        </div>
        <span
          className={`text-xs font-semibold ${
            monthlyStatus === "exceeded"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          {formatCurrency(monthlySaved)} / {formatCurrency(monthlyTarget)}{" "}
          <span className="text-[10px] font-normal">(Mensal)</span>
        </span>
      </div>

      {/* Progress bar: total reserve toward goal */}
      <div className="space-y-1">
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-[hsl(217,91%,60%)] transition-all duration-500"
            style={{ width: `${reserveProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-[hsl(217,91%,60%)]" />
            <span className="text-[11px] text-muted-foreground">
              {Math.round(reserveProgress)}% da Meta ({formatCurrency(effectiveGoal)})
            </span>
          </div>
          <span className="text-[11px] font-semibold text-foreground">
            {formatCurrency(totalReserve)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SavingsTracker;
