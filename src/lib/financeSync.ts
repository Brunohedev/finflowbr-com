import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Safe cloud save for the finance_data document.
 * Only overwrites the row if nobody else (another device/tab, bank import)
 * saved since we last read it. Otherwise it reports a conflict so the caller
 * can reload the newer data instead of erasing it.
 */
export type SaveResult =
  | { ok: true; updatedAt: string | null }
  | { ok: false; conflict: true; remote: { data: unknown; updated_at: string } | null }
  | { ok: false; conflict: false; error: string };

export async function saveFinanceDataSafely(
  userId: string,
  data: Json,
  knownUpdatedAt: string | null,
): Promise<SaveResult> {
  if (knownUpdatedAt) {
    const { data: rows, error } = await supabase
      .from("finance_data")
      .update({ data })
      .eq("user_id", userId)
      .eq("updated_at", knownUpdatedAt)
      .select("updated_at");
    if (error) return { ok: false, conflict: false, error: error.message };
    if (rows && rows.length > 0) return { ok: true, updatedAt: rows[0].updated_at };
    const remote = await fetchRemote(userId);
    return { ok: false, conflict: true, remote };
  }

  // No known version: only create the row if it doesn't exist yet.
  const existing = await fetchRemote(userId);
  if (existing) return { ok: false, conflict: true, remote: existing };
  const { data: rows, error } = await supabase
    .from("finance_data")
    .insert([{ user_id: userId, data }])
    .select("updated_at");
  if (error) return { ok: false, conflict: false, error: error.message };
  return { ok: true, updatedAt: rows?.[0]?.updated_at ?? null };
}

export async function fetchRemote(userId: string) {
  const { data } = await supabase
    .from("finance_data")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}
