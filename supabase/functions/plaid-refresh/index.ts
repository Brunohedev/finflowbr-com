import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_BASE_URL = 'https://production.plaid.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all connections for this user (a user may have linked more than one bank)
    const { data: connections, error: connErr } = await admin
      .from('plaid_connections')
      .select('access_token, item_id')
      .eq('user_id', userId);

    if (connErr) throw connErr;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, imported: 0, message: 'no connections' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
    const secret = Deno.env.get('PLAID_SECRET')!;
    const end = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let totalAttempted = 0;
    const results: any[] = [];

    for (const conn of connections) {
      try {
        const txRes = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            secret,
            access_token: conn.access_token,
            start_date: startDate,
            end_date: end,
            options: { count: 500, offset: 0 },
          }),
        });
        const txData = await txRes.json();
        console.log('[Plaid:refresh] transactions/get', {
          userId,
          item_id: conn.item_id,
          ok: txRes.ok,
          status: txRes.status,
          count: Array.isArray(txData?.transactions) ? txData.transactions.length : null,
          errorCode: txData?.error_code ?? null,
          errorMessage: txData?.error_message ?? null,
        });

        if (txRes.ok && Array.isArray(txData.transactions)) {
          // Only expenses: in Plaid, outflows are positive amounts.
          const rows = txData.transactions
            .filter((t: any) => typeof t?.amount === 'number' && t.amount > 0)
            .map((t: any) => ({
              plaid_id: t.transaction_id,
              name: t.name,
              amount: t.amount,
              // Preserve actual purchase date when available.
              date: t.authorized_date || t.date,
              category: null,
              user_id: userId,
            }));

          if (rows.length > 0) {
            const { error: upErr } = await admin
              .from('transactions')
              .upsert(rows, { onConflict: 'plaid_id', ignoreDuplicates: true });
            if (upErr) {
              console.error('[Plaid:refresh] upsert failed', { item_id: conn.item_id, error: upErr.message });
            }
            totalAttempted += rows.length;
            results.push({ item_id: conn.item_id, attempted: rows.length, ok: !upErr });
          } else {
            results.push({ item_id: conn.item_id, attempted: 0, ok: true });
          }
        } else {
          results.push({
            item_id: conn.item_id,
            ok: false,
            error_code: txData?.error_code ?? null,
            error_message: txData?.error_message ?? null,
          });
        }
      } catch (e) {
        console.error('[Plaid:refresh] connection failed', { item_id: conn.item_id, error: String(e) });
        results.push({ item_id: conn.item_id, ok: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, imported: totalAttempted, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[Plaid:refresh] fatal', String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
