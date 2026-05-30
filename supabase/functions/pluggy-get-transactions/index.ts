import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user_id, item_id } = await req.json();
    if (!user_id || !item_id) throw new Error('user_id and item_id are required');

    const clientId = Deno.env.get('PLUGGY_CLIENT_ID');
    const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Pluggy credentials missing');

    // Authenticate
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData?.message || 'Auth failed');
    const apiKey = authData.apiKey;

    // List accounts for item
    const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${item_id}`, {
      headers: { 'X-API-KEY': apiKey },
    });
    const accountsData = await accountsRes.json();
    if (!accountsRes.ok) throw new Error(accountsData?.message || 'Accounts failed');
    const accounts: any[] = accountsData.results || [];

    // Collect transactions for all accounts (last 30 days)
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - 30);
    const from = fromDate.toISOString().slice(0, 10);

    const allTx: any[] = [];
    for (const acc of accounts) {
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${acc.id}&from=${from}&to=${to}&pageSize=200`,
        { headers: { 'X-API-KEY': apiKey } }
      );
      const txData = await txRes.json();
      if (txRes.ok && Array.isArray(txData.results)) allTx.push(...txData.results);
    }

    // Insert into transactions table (skip existing plaid_id)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const rows = allTx
      .filter((t) => t.type === 'DEBIT' || (t.amount && Number(t.amount) > 0))
      .map((t) => ({
        user_id,
        name: t.description || t.descriptionRaw || 'Transação',
        amount: Math.abs(Number(t.amount || 0)),
        date: (t.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        plaid_id: `pluggy_${t.id}`,
        category: null,
      }));

    let inserted = 0;
    if (rows.length > 0) {
      // ON CONFLICT (plaid_id) DO NOTHING
      const { data: insertedRows, error } = await supabase
        .from('transactions')
        .upsert(rows, { onConflict: 'plaid_id', ignoreDuplicates: true })
        .select('plaid_id');
      if (error) throw error;
      inserted = insertedRows?.length ?? 0;
    }

    return new Response(JSON.stringify({ ok: true, inserted, total: allTx.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
