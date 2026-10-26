// Resetting a month must only clear that month's data, never other months'.
export function resetMonthExpenses<T extends { date: string }>(expenses: T[], month: string): T[] {
  return expenses.filter((expense) => !expense.date.startsWith(month));
}
