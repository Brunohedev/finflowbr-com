import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { syncTransactions } from '../_shared/transactionSync.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await client.auth.getClaims(authHeader.slice(7));
    if (error || !data?.claims?.sub) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    const body = await req.json().catch(() => ({}));
    const days = body.days ?? 30;
    if (!Number.isInteger(days) || days < 1 || days > 90 ||
      (body.item_id !== undefined && (typeof body.item_id !== 'string' || body.item_id.length > 255))) {
      return new Response(JSON.stringify({ error: 'Invalid sync input' }), { status: 400, headers });
    }
    // Never trust a caller-supplied user_id or bank access token.
    const result = await syncTransactions({ userId: data.claims.sub, itemId: body.item_id, days });
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    console.error('[sync-transactions] fatal', String(error));
    return new Response(JSON.stringify({ ok: false, error: 'Bank sync failed' }), { status: 500, headers });
  }
});
