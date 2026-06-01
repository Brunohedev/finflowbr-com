import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const receivedAt = new Date().toISOString();
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    console.warn('[Plaid:webhook] invalid JSON body', { receivedAt });
    return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const webhook_type = body?.webhook_type ?? null;
  const webhook_code = body?.webhook_code ?? null;
  const item_id = body?.item_id ?? null;
  const removed_transactions = body?.removed_transactions ?? null;

  console.log('[Plaid:webhook] received', {
    receivedAt,
    webhook_type,
    webhook_code,
    item_id,
    environment: body?.environment ?? null,
    new_transactions: body?.new_transactions ?? null,
    removed_count: Array.isArray(removed_transactions) ? removed_transactions.length : null,
    error: body?.error ?? null,
  });

  const TRIGGER_CODES = new Set([
    'SYNC_UPDATES_AVAILABLE',
    'INITIAL_UPDATE',
    'HISTORICAL_UPDATE',
    'DEFAULT_UPDATE',
    'TRANSACTIONS_REMOVED',
  ]);

  if (webhook_type === 'TRANSACTIONS' && webhook_code && TRIGGER_CODES.has(webhook_code) && item_id) {
    try {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Removals are the only delete-path; sync-transactions handles inserts/upserts.
      if (webhook_code === 'TRANSACTIONS_REMOVED' && Array.isArray(removed_transactions) && removed_transactions.length > 0) {
        const { data: conn } = await admin
          .from('plaid_connections')
          .select('user_id')
          .eq('item_id', item_id)
          .maybeSingle();
        if (conn?.user_id) {
          const { error: delErr } = await admin
            .from('transactions')
            .delete()
            .in('plaid_id', removed_transactions)
            .eq('user_id', conn.user_id);
          console.log('[Plaid:webhook] removed transactions', {
            item_id,
            count: removed_transactions.length,
            ok: !delErr,
            error: delErr?.message ?? null,
          });
        }
        return new Response(JSON.stringify({ ok: true, removed: removed_transactions.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delegate to centralized sync.
      const { data, error } = await admin.functions.invoke('sync-transactions', {
        body: { item_id, days: 30 },
      });
      console.log('[Plaid:webhook] sync-transactions result', {
        item_id,
        ok: !error,
        data,
        error: error ? String(error) : null,
      });
    } catch (e) {
      console.error('[Plaid:webhook] sync failed', { item_id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
