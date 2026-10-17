import { createClient } from 'npm:@supabase/supabase-js@2';
import { expenseRows, fetchTransactionPages } from './plaidTransactions.ts';

// Only called by authenticated handlers, or after verified webhook delivery.
export async function syncTransactions(input: { userId?: string; itemId?: string; days?: number }) {
  if (!input.userId && !input.itemId) throw new Error('Missing sync owner');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let query = admin.from('plaid_connections').select('user_id, access_token, item_id');
  if (input.userId) query = query.eq('user_id', input.userId);
  if (input.itemId) query = query.eq('item_id', input.itemId);
  const { data: connections, error } = await query;
  if (error) throw error;
  const days = input.days ?? 30;
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const results = await Promise.all((connections ?? []).map(async connection => {
    try {
      const transactions = await fetchTransactionPages(async offset => {
        const response = await fetch('https://production.plaid.com/transactions/get', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: Deno.env.get('PLAID_CLIENT_ID')!,
            secret: Deno.env.get('PLAID_SECRET')!, access_token: connection.access_token,
            start_date: start, end_date: end, options: { count: 500, offset } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error_code || 'PLAID_FETCH_FAILED');
        return payload;
      });
      const rows = expenseRows(transactions, connection.user_id);
      // Insert-only preserves the user's existing category and linked expense.
      for (let offset = 0; offset < rows.length; offset += 500) {
        const { error: writeError } = await admin.from('transactions')
          .upsert(rows.slice(offset, offset + 500), { onConflict: 'plaid_id', ignoreDuplicates: true });
        if (writeError) throw writeError;
      }
      return { item_id: connection.item_id, ok: true, attempted: rows.length };
    } catch (error) {
      console.error('[sync-transactions] connection failed', { item_id: connection.item_id, error: String(error) });
      return { item_id: connection.item_id, ok: false, attempted: 0, error: String(error) };
    }
  }));
  return { ok: results.every(result => result.ok),
    imported: results.reduce((total, result) => total + result.attempted, 0), results };
}