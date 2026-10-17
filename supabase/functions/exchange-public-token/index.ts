import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { syncTransactions } from '../_shared/transactionSync.ts';

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
    if (typeof public_token !== 'string' || !public_token || public_token.length > 2048) {
      return new Response(JSON.stringify({ error: 'public_token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
    const secret = Deno.env.get('PLAID_SECRET')!;

    console.log('[Plaid:exchange_public_token] starting', {
      userId,
      effectivePlaidEnv: PLAID_EFFECTIVE_ENV,
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
      itemId: exchangeData?.item_id ?? null,
      accessToken: maskToken(exchangeData?.access_token),
      errorCode: exchangeData?.error_code ?? null,
      errorMessage: exchangeData?.error_message ?? null,
    });
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: exchangeData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const accessToken = exchangeData.access_token as string;
    const itemId = exchangeData?.item_id ?? null;

    // Store the connection using service role (bypass RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: insertConnectionError } = await admin
      .from('plaid_connections')
      .insert({ user_id: userId, access_token: accessToken, item_id: itemId });
    console.log('[Plaid:exchange_public_token] connection insert', {
      ok: !insertConnectionError,
      itemId,
      error: insertConnectionError?.message ?? null,
    });
    if (insertConnectionError) throw insertConnectionError;

    // Delegate transaction ingestion to the centralized sync function.
    let imported = 0;
    let syncOk = false;
    let syncError: string | null = null;
    try {
      const data = await syncTransactions({ userId, itemId, days: 30 });
      syncOk = Boolean(data?.ok);
      imported = Number(data?.imported ?? 0);
      console.log('[Plaid:exchange_public_token] sync-transactions result', { syncOk, imported, data });
    } catch (e) {
      syncError = String(e);
      console.error('[Plaid:exchange_public_token] sync-transactions failed', syncError);
    }

    return new Response(JSON.stringify({
      success: true,
      imported,
      plaid_env: PLAID_EFFECTIVE_ENV,
      item_id: itemId,
      has_access_token: Boolean(accessToken),
      sync_ok: syncOk,
      sync_error: syncError,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
