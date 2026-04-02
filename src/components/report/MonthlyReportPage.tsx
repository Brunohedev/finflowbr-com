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
  getSpentByCategory: (id: string) => number;
  getBudget: (id: string) => number;
  onBack: () => void;
  onToggleExpenseStatus: (id: string) => void;
  savingsBudget?: number;
}

const MonthlyReportPage = ({
  data, getSpentByCategory, getBudget, onBack, onToggleExpenseStatus, savingsBudget = 0,
}: MonthlyReportPageProps) => {
  const simulator = useGrowthSimulator();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Calendar Section */}
      <MonthlyCalendarSection
        data={data}
        onBack={onBack}
        onToggleExpenseStatus={onToggleExpenseStatus}
      />

      {/* 2. Detailed Analysis */}
      <MonthlyAnalysis
        data={data}
        getSpentByCategory={getSpentByCategory}
        getBudget={getBudget}
        savingsBudget={savingsBudget}
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
