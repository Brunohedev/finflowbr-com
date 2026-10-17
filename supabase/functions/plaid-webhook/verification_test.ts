import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { verifyPlaidWebhook } from '../_shared/plaidWebhookVerification.ts';

Deno.test('unsigned webhook cannot trigger bank updates or deletions', async () => {
  assertEquals(await verifyPlaidWebhook(null, '{"item_id":"another-user"}'), false);
});

Deno.test('malformed webhook signatures cannot trigger bank updates', async () => {
  assertEquals(await verifyPlaidWebhook('invalid-signature', '{}'), false);
});