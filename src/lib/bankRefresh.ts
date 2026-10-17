import { supabase } from "@/integrations/supabase/client";

// Shared across page navigation; concurrent requests for the same user reuse one promise.
const pending = new Map<string, Promise<void>>();

export function refreshBankTransactions(userId: string): Promise<void> {
  const existing = pending.get(userId);
  if (existing) return existing;
  const request = (async () => {
    const { data, error } = await supabase.functions.invoke("plaid-refresh", { body: {} });
    if (error) throw error;
    if (data?.ok === false) throw new Error("Não foi possível atualizar o banco. Tente novamente.");
    window.dispatchEvent(new CustomEvent("bank-transactions-refreshed", { detail: userId }));
  })().finally(() => pending.delete(userId));
  pending.set(userId, request);
  return request;
}