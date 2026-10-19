import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Plaid only pulls new purchases from the bank a few times a day unless asked.
// /transactions/refresh asks Plaid to fetch from the bank now; Plaid then sends
// a webhook when the new purchases are ready. Throttled per item to limit cost.
export const BANK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function shouldRequestBankRefresh(lastRefreshAt: string | null, now = Date.now()): boolean {
  if (!lastRefreshAt) return true;
  const last = Date.parse(lastRefreshAt);
  return !Number.isFinite(last) || now - last >= BANK_REFRESH_INTERVAL_MS;
}

async function plaidPost(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://production.plaid.com${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: Deno.env.get('PLAID_CLIENT_ID')!, secret: Deno.env.get('PLAID_SECRET')!, ...body }),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export async function requestBankRefresh(admin: SupabaseClient, userId: string) {
  const { data: connections, error } = await admin.from('plaid_connections')
    .select('item_id, access_token, last_bank_refresh_at').eq('user_id', userId);
  if (error) throw error;
  console.log('[Plaid:refresh] connections', { count: connections?.length ?? 0 });
  const webhookUrl = Deno.env.get('PLAID_WEBHOOK_URL') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid-webhook`;

  return Promise.all((connections ?? []).map(async (c) => {
    if (!c.item_id || !shouldRequestBankRefresh(c.last_bank_refresh_at)) {
      return { item_id: c.item_id, requested: false };
    }
    // Claim the slot first so parallel requests don't double-bill.
    const cutoff = new Date(Date.now() - BANK_REFRESH_INTERVAL_MS).toISOString();
    const claimQuery = admin.from('plaid_connections').update({ last_bank_refresh_at: new Date().toISOString() })
      .eq('item_id', c.item_id);
    const { data: claimed, error: claimError } = await (c.last_bank_refresh_at
      ? claimQuery.lt('last_bank_refresh_at', cutoff)
      : claimQuery.is('last_bank_refresh_at', null)).select('item_id');
    if (claimError) console.error('[Plaid:refresh] claim failed', { item_id: c.item_id, error: claimError.message });
    if (!claimed?.length) return { item_id: c.item_id, requested: false };

    // First time: make sure older items also send their updates to us.
    if (!c.last_bank_refresh_at) {
      const hook = await plaidPost('/item/webhook/update', { access_token: c.access_token, webhook: webhookUrl });
      console.log('[Plaid:refresh] webhook update', { item_id: c.item_id, ok: hook.ok, error: hook.payload?.error_code ?? null });
    }
    const result = await plaidPost('/transactions/refresh', { access_token: c.access_token });
    console.log('[Plaid:refresh] bank refresh requested', {
      item_id: c.item_id, ok: result.ok, error: result.payload?.error_code ?? null,
      message: result.ok ? null : result.payload?.error_message ?? null,
    });
    return { item_id: c.item_id, requested: result.ok, error: result.ok ? null : result.payload?.error_code ?? 'REFRESH_FAILED' };
  }));
}
