import { describe, expect, it } from 'vitest';
import { expenseRows, fetchTransactionPages } from '../../supabase/functions/_shared/plaidTransactions';

describe('Plaid ingestion', () => {
  it('imports every available purchase beyond the first 500', async () => {
    const transactions = Array.from({ length: 501 }, (_, i) => ({
      transaction_id: `purchase-${i}`, name: 'Purchase', amount: 10, date: '2026-10-17',
    }));
    const offsets: number[] = [];
    const result = await fetchTransactionPages(async offset => {
      offsets.push(offset);
      return { transactions: transactions.slice(offset, offset + 500), total_transactions: 501 };
    });
    expect(offsets).toEqual([0, 500]);
    expect(expenseRows(result, 'owner')).toHaveLength(501);
    expect(result[500].transaction_id).toBe('purchase-500');
  });

  it('keeps the actual purchase date, user ownership and uncategorized state', () => {
    expect(expenseRows([{ transaction_id: 'p1', name: 'Market', amount: 12.5,
      authorized_date: '2026-10-16', date: '2026-10-17' }], 'owner')).toEqual([
      { plaid_id: 'p1', name: 'Market', amount: 12.5, date: '2026-10-16', category: null, user_id: 'owner' },
    ]);
  });

  it('fails instead of silently discarding missing pages', async () => {
    await expect(fetchTransactionPages(async () => ({ transactions: [], total_transactions: 501 }))).rejects.toThrow('Incomplete');
  });
});