import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_EFFECTIVE_ENV = 'production';
const PLAID_BASE_URL = 'https://production.plaid.com';

const maskToken = (value: string | null | undefined) => {
  if (!value) return null;
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const { public_token } = await req.json();
    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
    const secret = Deno.env.get('PLAID_SECRET')!;
    const rawPlaidEnv = Deno.env.get('PLAID_ENV') || null;

    console.log('[Plaid:exchange_public_token] starting', {
      userId,
      rawPlaidEnv,
      effectivePlaidEnv: PLAID_EFFECTIVE_ENV,
      baseUrl: PLAID_BASE_URL,
      usingProduction: PLAID_BASE_URL === 'https://production.plaid.com',
      hasClientId: Boolean(clientId),
      hasSecret: Boolean(secret),
      publicToken: maskToken(public_token),
    });

    const exchangeRes = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, public_token }),
    });
    const exchangeData = await exchangeRes.json();
    console.log('[Plaid:exchange_public_token] exchange response', {
      ok: exchangeRes.ok,
      status: exchangeRes.status,
      requestId: exchangeData?.request_id ?? null,
      itemId: exchangeData?.item_id ?? null,
      accessToken: maskToken(exchangeData?.access_token),
      errorType: exchangeData?.error_type ?? null,
      errorCode: exchangeData?.error_code ?? null,
      errorMessage: exchangeData?.error_message ?? null,
    });
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: exchangeData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const accessToken = exchangeData.access_token as string;

    // Store the connection using service role (bypass RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: insertConnectionError } = await admin.from('plaid_connections').insert({ user_id: userId, access_token: accessToken });
    console.log('[Plaid:exchange_public_token] connection insert', {
      ok: !insertConnectionError,
      itemId: exchangeData?.item_id ?? null,
      error: insertConnectionError?.message ?? null,
    });
    if (insertConnectionError) throw insertConnectionError;

    // Fetch recent transactions (last 30 days) and upsert
    const end = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const txRes = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        secret,
        access_token: accessToken,
        start_date: startDate,
        end_date: end,
        options: { count: 100, offset: 0 },
      }),
    });
    const txData = await txRes.json();
    console.log('[Plaid:exchange_public_token] transactions response', {
      ok: txRes.ok,
      status: txRes.status,
      requestId: txData?.request_id ?? null,
      transactionCount: Array.isArray(txData?.transactions) ? txData.transactions.length : null,
      errorType: txData?.error_type ?? null,
      errorCode: txData?.error_code ?? null,
      errorMessage: txData?.error_message ?? null,
    });
    if (txRes.ok && Array.isArray(txData.transactions)) {
      const rows = txData.transactions.map((t: any) => ({
        plaid_id: t.transaction_id,
        name: t.name,
        amount: t.amount,
        date: t.date,
        category: null,
        user_id: userId,
      }));
      if (rows.length > 0) {
        const { error: insertTransactionsError } = await admin.from('transactions').insert(rows);
        console.log('[Plaid:exchange_public_token] transactions insert', {
          attempted: rows.length,
          ok: !insertTransactionsError,
          error: insertTransactionsError?.message ?? null,
        });
        if (insertTransactionsError) throw insertTransactionsError;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      imported: txData?.transactions?.length || 0,
      plaid_env: PLAID_EFFECTIVE_ENV,
      item_id: exchangeData?.item_id ?? null,
      transactions_ok: txRes.ok,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
