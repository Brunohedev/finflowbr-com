export interface PlaidTransaction {
  transaction_id: string;
  name: string;
  amount: number;
  authorized_date?: string | null;
  date: string;
}

export async function fetchTransactionPages(
  getPage: (offset: number) => Promise<{ transactions: PlaidTransaction[]; total_transactions: number }>,
): Promise<PlaidTransaction[]> {
  const transactions = new Map<string, PlaidTransaction>();
  let offset = 0;
  while (true) {
    const page = await getPage(offset);
    if (!Array.isArray(page.transactions) || !Number.isInteger(page.total_transactions) || page.total_transactions < 0) {
      throw new Error("Invalid Plaid transactions response");
    }
    for (const transaction of page.transactions) transactions.set(transaction.transaction_id, transaction);
    offset += page.transactions.length;
    if (offset >= page.total_transactions) break;
    if (page.transactions.length === 0) throw new Error("Incomplete Plaid transactions response");
  }
  return [...transactions.values()];
}

export function expenseRows(transactions: PlaidTransaction[], userId: string) {
  return transactions
    .filter(t => t.transaction_id && Number.isFinite(t.amount) && t.amount > 0)
    .map(t => ({ plaid_id: t.transaction_id, name: t.name, amount: t.amount,
      date: t.authorized_date || t.date, category: null, user_id: userId }));
}