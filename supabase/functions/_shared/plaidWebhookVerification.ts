import { decodeProtectedHeader, importJWK, jwtVerify } from 'npm:jose@5';

export async function verifyPlaidWebhook(signature: string | null, body: string): Promise<boolean> {
  if (!signature) return false;
  try {
    const header = decodeProtectedHeader(signature);
    if (header.alg !== 'ES256' || !header.kid) return false;
    const response = await fetch('https://production.plaid.com/webhook_verification_key/get', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: Deno.env.get('PLAID_CLIENT_ID')!,
        secret: Deno.env.get('PLAID_SECRET')!, key_id: header.kid }),
    });
    if (!response.ok) return false;
    const { key } = await response.json();
    if (!key || key.expired_at != null) return false;
    const publicKey = await importJWK(key, 'ES256');
    const { payload } = await jwtVerify(signature, publicKey, { algorithms: ['ES256'], maxTokenAge: '5 minutes' });
    if (typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 30) return false;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hash === payload.request_body_sha256;
  } catch {
    return false;
  }
}