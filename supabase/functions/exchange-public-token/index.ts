import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_EFFECTIVE_ENV = 'production';
const PLAID_BASE_URL = 'https://production.plaid.com';

const maskToken = (value: string | null | undefined) => {
  if (!value) return null;
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
};

const PLAID_ERROR_CODES_TO_WATCH = [
  'PRODUCTS_NOT_READY',
  'INVALID_PRODUCTS',
  'OAUTH',
  'ITEM_LOGIN_REQUIRED',
  'INVALID_CREDENTIALS',
  'INVALID_REDIRECT_URI',
  'INVALID_ENVIRONMENT',
];

const sanitizePlaidPayload = (value: any): any => {
  if (Array.isArray(value)) return value.map(sanitizePlaidPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('secret')) return [key, '[redacted]'];
      if (lowerKey.includes('token')) return [key, maskToken(String(entry))];
      return [key, sanitizePlaidPayload(entry)];
    })
  );
};

const plaidDiagnostics = (body: any) => ({
  requestId: body?.request_id ?? null,
  errorType: body?.error_type ?? null,
  errorCode: body?.error_code ?? null,
  errorMessage: body?.error_message ?? null,
  displayMessage: body?.display_message ?? null,
  matchedWatchedError: PLAID_ERROR_CODES_TO_WATCH.find((code) =>
    String(body?.error_code ?? '').includes(code) || String(body?.error_message ?? '').includes(code)
  ) ?? null,
});

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
      hasPublicToken: Boolean(public_token),
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
      ...plaidDiagnostics(exchangeData),
      itemId: exchangeData?.item_id ?? null,
      hasAccessToken: Boolean(exchangeData?.access_token),
      accessToken: maskToken(exchangeData?.access_token),
      fullBody: sanitizePlaidPayload(exchangeData),
    });
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: exchangeData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const accessToken = exchangeData.access_token as string;

    const itemRes = await fetch(`${PLAID_BASE_URL}/item/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    });
    const itemData = await itemRes.json();
    console.log('[Plaid:exchange_public_token] item get response', {
      ok: itemRes.ok,
      status: itemRes.status,
      ...plaidDiagnostics(itemData),
      itemId: itemData?.item?.item_id ?? exchangeData?.item_id ?? null,
      institutionId: itemData?.item?.institution_id ?? null,
      products: itemData?.item?.products ?? null,
      availableProducts: itemData?.item?.available_products ?? null,
      billedProducts: itemData?.item?.billed_products ?? null,
      consentExpirationTime: itemData?.item?.consent_expiration_time ?? null,
      updateType: itemData?.item?.update_type ?? null,
      itemError: itemData?.item?.error ?? null,
      fullBody: sanitizePlaidPayload(itemData),
    });

    // Store the connection using service role (bypass RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: insertConnectionError } = await admin.from('plaid_connections').insert({ user_id: userId, access_token: accessToken, item_id: exchangeData?.item_id ?? null });
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
      ...plaidDiagnostics(txData),
      transactionCount: Array.isArray(txData?.transactions) ? txData.transactions.length : null,
      totalTransactions: txData?.total_transactions ?? null,
      accountsCount: Array.isArray(txData?.accounts) ? txData.accounts.length : null,
      itemStatus: txData?.item?.status ?? null,
      itemError: txData?.item?.error ?? null,
      fullBody: sanitizePlaidPayload(txData),
    });
    if (txRes.ok && Array.isArray(txData.transactions)) {
      const rows = txData.transactions.map((t: any) => ({
        plaid_id: t.transaction_id,
        name: t.name,
        amount: t.amount,
        // Use authorized_date (actual purchase date) when available; fall back to posted date.
        date: t.authorized_date || t.date,
        category: null,
        user_id: userId,
      }));
      if (rows.length > 0) {
        // ON CONFLICT (plaid_id) DO NOTHING
        const { error: insertTransactionsError } = await admin
          .from('transactions')
          .upsert(rows, { onConflict: 'plaid_id', ignoreDuplicates: true });
        console.log('[Plaid:exchange_public_token] transactions insert (ignoreDuplicates)', {
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
      has_access_token: Boolean(accessToken),
      transactions_ok: txRes.ok,
      transactions_error_code: txData?.error_code ?? null,
      transactions_error_message: txData?.error_message ?? null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
