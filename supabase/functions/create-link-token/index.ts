import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_EFFECTIVE_ENV = 'production';
const PLAID_BASE_URL = 'https://production.plaid.com';
const PLAID_REDIRECT_URI = 'https://finflowbr.com/banco';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const clientId = Deno.env.get('PLAID_CLIENT_ID')!;
    const secret = Deno.env.get('PLAID_SECRET')!;
    const rawPlaidEnv = Deno.env.get('PLAID_ENV') || null;
    const webhookUrl = Deno.env.get('PLAID_WEBHOOK_URL') || 'https://symkogknbjhdesgmvtvc.supabase.co/functions/v1/plaid-webhook';

    const body: any = {
      client_id: clientId,
      secret,
      client_name: 'FinFlow',
      language: 'en',
      country_codes: ['US'],
      user: { client_user_id: userId },
      products: ['transactions'],
      redirect_uri: PLAID_REDIRECT_URI,
    };
    if (webhookUrl) body.webhook = webhookUrl;

    console.log('[Plaid:create_link_token] starting', {
      userId,
      rawPlaidEnv,
      effectivePlaidEnv: PLAID_EFFECTIVE_ENV,
      baseUrl: PLAID_BASE_URL,
      usingProduction: PLAID_BASE_URL === 'https://production.plaid.com',
      hasClientId: Boolean(clientId),
      hasSecret: Boolean(secret),
      redirectUri: PLAID_REDIRECT_URI,
      hasWebhookUrl: Boolean(webhookUrl),
      requestBody: sanitizePlaidPayload(body),
    });

    const res = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[Plaid:create_link_token] response', {
      ok: res.ok,
      status: res.status,
      ...plaidDiagnostics(data),
      linkToken: maskToken(data?.link_token),
      expiration: data?.expiration ?? null,
      fullBody: sanitizePlaidPayload(data),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      link_token: data.link_token,
      plaid_env: PLAID_EFFECTIVE_ENV,
      plaid_base_url: PLAID_BASE_URL,
      redirect_uri: PLAID_REDIRECT_URI,
      country_codes: body.country_codes,
      language: body.language,
      expiration: data.expiration ?? null,
      webhook_configured: Boolean(webhookUrl),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
