import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_BASE_URL = 'https://production.plaid.com';

interface SyncInput {
  user_id: string;
  access_token?: string;
  item_id?: string;
  days?: number;
}

async function syncOne(params: {
  admin: ReturnType<typeof createClient>;
  user_id: string;
  access_token: string;
  item_id?: string | null;
  days: number;
}) {
  const { admin, user_id, access_token, item_id, days } = params;
  const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
  const secret = Deno.env.get('PLAID_SECRET')!;
  const end = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const txRes = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      access_token,
      start_date: startDate,
      end_date: end,
      options: { count: 500, offset: 0 },
    }),
  });
  const txData = await txRes.json();
  console.log('[sync-transactions] /transactions/get', {
    user_id,
    item_id,
    ok: txRes.ok,
    status: txRes.status,
    count: Array.isArray(txData?.transactions) ? txData.transactions.length : null,
    errorCode: txData?.error_code ?? null,
    errorMessage: txData?.error_message ?? null,
  });

  if (!txRes.ok || !Array.isArray(txData.transactions)) {
    return {
      item_id,
      ok: false,
      attempted: 0,
      error_code: txData?.error_code ?? null,
      error_message: txData?.error_message ?? null,
    };
  }

  const rows = txData.transactions
    .filter((t: any) => typeof t?.amount === 'number' && t.amount > 0)
    .map((t: any) => ({
      plaid_id: t.transaction_id,
      name: t.name,
      amount: t.amount,
      // Preserve the actual purchase date when available; fall back to posted date.
      date: t.authorized_date || t.date,
      category: null,
      user_id,
    }));

  if (rows.length === 0) {
    return { item_id, ok: true, attempted: 0 };
  }

  const { error: upErr } = await admin
    .from('transactions')
    .upsert(rows, { onConflict: 'plaid_id', ignoreDuplicates: true });

  console.log('[sync-transactions] upsert', {
    user_id,
    item_id,
    attempted: rows.length,
    ok: !upErr,
    error: upErr?.message ?? null,
  });

  return { item_id, ok: !upErr, attempted: rows.length, error: upErr?.message ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: SyncInput = await req.json().catch(() => ({} as SyncInput));
    const days = typeof body.days === 'number' && body.days > 0 ? body.days : 30;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve which connections to sync.
    let connections: { user_id: string; access_token: string; item_id: string | null }[] = [];

    if (body.access_token && body.user_id) {
      connections = [{
        user_id: body.user_id,
        access_token: body.access_token,
        item_id: body.item_id ?? null,
      }];
    } else if (body.item_id) {
      const { data, error } = await admin
        .from('plaid_connections')
        .select('user_id, access_token, item_id')
        .eq('item_id', body.item_id);
      if (error) throw error;
      connections = data ?? [];
    } else if (body.user_id) {
      const { data, error } = await admin
        .from('plaid_connections')
        .select('user_id, access_token, item_id')
        .eq('user_id', body.user_id);
      if (error) throw error;
      connections = data ?? [];
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide user_id, item_id, or access_token+user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (connections.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, imported: 0, results: [], message: 'no connections' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let total = 0;
    for (const c of connections) {
      const r = await syncOne({
        admin,
        user_id: c.user_id,
        access_token: c.access_token,
        item_id: c.item_id,
        days,
      });
      results.push(r);
      total += r.attempted || 0;
    }

    return new Response(
      JSON.stringify({ ok: true, imported: total, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[sync-transactions] fatal', String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
