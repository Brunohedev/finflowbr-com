import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const PLAID_EFFECTIVE_ENV = 'production';
const PLAID_BASE_URL = 'https://production.plaid.com';
const PLAID_REDIRECT_URI = 'https://finflowbr.com/banco';

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
    const webhookUrl = Deno.env.get('PLAID_WEBHOOK_URL') || null;

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
    });

    const body: any = {
      client_id: clientId,
      secret,
      client_name: 'FinFlow',
      language: 'pt',
      country_codes: ['US'],
      user: { client_user_id: userId },
      products: ['transactions'],
      redirect_uri: PLAID_REDIRECT_URI,
    };
    if (webhookUrl) body.webhook = webhookUrl;

    const res = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[Plaid:create_link_token] response', {
      ok: res.ok,
      status: res.status,
      requestId: data?.request_id ?? null,
      linkToken: maskToken(data?.link_token),
      errorType: data?.error_type ?? null,
      errorCode: data?.error_code ?? null,
      errorMessage: data?.error_message ?? null,
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ link_token: data.link_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
