import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldRequestBankRefresh } from '../_shared/bankRefreshRequest.ts';

const now = Date.parse('2026-10-17T01:00:00Z');

Deno.test('asks the bank when never asked before', () => {
  assertEquals(shouldRequestBankRefresh(null, now), true);
});
Deno.test('does not ask again within 5 minutes', () => {
  assertEquals(shouldRequestBankRefresh('2026-10-17T00:56:00Z', now), false);
});
Deno.test('asks again after 5 minutes', () => {
  assertEquals(shouldRequestBankRefresh('2026-10-17T00:55:00Z', now), true);
});
