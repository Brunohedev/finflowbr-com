import { useState, useMemo } from "react";

export interface SimulationDataPoint {
  month: number;
  year: number;
  balance: number;
  totalInvested: number;
  totalProfit: number;
}

export function useGrowthSimulator() {
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [annualReturn, setAnnualReturn] = useState(10);
  const [timePeriod, setTimePeriod] = useState(10);

  const simulationData = useMemo<SimulationDataPoint[]>(() => {
    const monthlyRate = annualReturn / 100 / 12;
    const totalMonths = timePeriod * 12;
    const result: SimulationDataPoint[] = [];
    let balance = currentBalance;
    for (let month = 0; month <= totalMonths; month++) {
      const totalInvested = currentBalance + monthlyContribution * month;
      result.push({ month, year: Math.floor(month / 12), balance, totalInvested, totalProfit: balance - totalInvested });
      if (month < totalMonths) balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }
    return result;
  }, [monthlyContribution, currentBalance, annualReturn, timePeriod]);

  const finalBalance = simulationData[simulationData.length - 1];
  const yearlyData = useMemo(() => simulationData.filter((_, i) => i % 12 === 0), [simulationData]);

  return {
    monthlyContribution, setMonthlyContribution,
    currentBalance, setCurrentBalance,
    annualReturn, setAnnualReturn,
    timePeriod, setTimePeriod,
    simulationData, finalBalance, yearlyData,
  };
}
