import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_BASE_URL = 'https://production.plaid.com';

const maskToken = (v: string | null | undefined) =>
  !v ? null : `${v.slice(0, 12)}…${v.slice(-6)}`;

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

  // 1) Log every incoming webhook with structured fields
  const webhook_type = body?.webhook_type ?? null;
  const webhook_code = body?.webhook_code ?? null;
  const item_id = body?.item_id ?? null;
  const environment = body?.environment ?? null;
  const error = body?.error ?? null;
  const new_transactions = body?.new_transactions ?? null;
  const removed_transactions = body?.removed_transactions ?? null;
  const historical_update_complete = body?.historical_update_complete ?? null;
  const initial_update_complete = body?.initial_update_complete ?? null;

  console.log('[Plaid:webhook] received', {
    receivedAt,
    webhook_type,
    webhook_code,
    item_id,
    environment,
    new_transactions,
    removed_transactions: Array.isArray(removed_transactions) ? removed_transactions.length : null,
    historical_update_complete,
    initial_update_complete,
    error,
    fullBody: body,
  });

  // 2) Trigger transaction sync on TRANSACTIONS update events
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

      // Look up connection by item_id (plaid_connections.item_id)
      const { data: conn, error: connErr } = await admin
        .from('plaid_connections')
        .select('user_id, access_token')
        .eq('item_id', item_id)
        .maybeSingle();

      if (connErr) throw connErr;
      if (!conn) {
        console.warn('[Plaid:webhook] no connection found for item_id', { item_id });
        return new Response(JSON.stringify({ ok: true, ignored: 'unknown_item' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
      const secret = Deno.env.get('PLAID_SECRET')!;

      // Handle removed transactions
      if (webhook_code === 'TRANSACTIONS_REMOVED' && Array.isArray(removed_transactions) && removed_transactions.length > 0) {
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
        return new Response(JSON.stringify({ ok: true, removed: removed_transactions.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch last 30 days and upsert with ON CONFLICT (plaid_id) DO NOTHING
      const end = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const txRes = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          secret,
          access_token: conn.access_token,
          start_date: startDate,
          end_date: end,
          options: { count: 250, offset: 0 },
        }),
      });
      const txData = await txRes.json();
      console.log('[Plaid:webhook] transactions/get', {
        item_id,
        ok: txRes.ok,
        status: txRes.status,
        count: Array.isArray(txData?.transactions) ? txData.transactions.length : null,
        accessToken: maskToken(conn.access_token),
        errorCode: txData?.error_code ?? null,
        errorMessage: txData?.error_message ?? null,
      });

      if (txRes.ok && Array.isArray(txData.transactions) && txData.transactions.length > 0) {
        const rows = txData.transactions.map((t: any) => ({
          plaid_id: t.transaction_id,
          name: t.name,
          amount: t.amount,
          date: t.date,
          category: null,
          user_id: conn.user_id,
        }));
        const { error: upErr } = await admin
          .from('transactions')
          .upsert(rows, { onConflict: 'plaid_id', ignoreDuplicates: true });
        console.log('[Plaid:webhook] transactions upsert', {
          item_id,
          attempted: rows.length,
          ok: !upErr,
          error: upErr?.message ?? null,
        });
      }
    } catch (e) {
      console.error('[Plaid:webhook] sync failed', { item_id, error: String(e) });
      // Return 200 anyway so Plaid does not retry storm us; the event is already logged
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
