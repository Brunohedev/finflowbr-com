import { FinanceData } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MonthlyCalendarSection from "@/components/MonthlyCalendar";
import MonthlyAnalysis from "@/components/report/MonthlyAnalysis";
import GrowthSimulator from "@/components/report/GrowthSimulator";
import GrowthProjectionChart from "@/components/report/GrowthProjectionChart";
import { useGrowthSimulator } from "@/hooks/useGrowthSimulator";

interface MonthlyReportPageProps {
  data: FinanceData;
  monthlyIncome: number;
  getSpentByCategory: (id: string) => number;
  getBudget: (id: string) => number;
  onBack: () => void;
  onToggleExpenseStatus: (id: string) => void;
}

const MonthlyReportPage = ({
  data, monthlyIncome, getSpentByCategory, getBudget, onBack, onToggleExpenseStatus,
}: MonthlyReportPageProps) => {
  const simulator = useGrowthSimulator();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Calendar Section */}
      <MonthlyCalendarSection
        data={data}
        monthlyIncome={monthlyIncome}
        onBack={onBack}
        onToggleExpenseStatus={onToggleExpenseStatus}
      />

      {/* 2. Detailed Analysis */}
      <MonthlyAnalysis
        data={data}
        monthlyIncome={monthlyIncome}
        getSpentByCategory={getSpentByCategory}
        getBudget={getBudget}
      />

      {/* 3. Growth Simulator */}
      <GrowthSimulator simulator={simulator} />

      {/* 4. Growth Projection Chart */}
      <GrowthProjectionChart
        yearlyData={simulator.yearlyData}
        timePeriod={simulator.timePeriod}
      />
    </div>
  );
};

export default MonthlyReportPage;
