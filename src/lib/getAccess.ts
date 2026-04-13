import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AccessLevel = "unlimited" | "pro" | "none";

/**
 * Read-only helper that checks a user's access level.
 * Priority: admin_access (email) → user_entitlements (user_id) → none
 */
export async function getAccess(user: User): Promise<AccessLevel> {
  const email = user.email;

  // 1. Check admin_access table by email
  if (email) {
    const { data: admin } = await supabase
      .from("admin_access")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (admin) {
      return "unlimited";
    }
  }

  // 2. Check user_entitlements (Stripe / admin_invite)
  const { data: ent } = await supabase
    .from("user_entitlements")
    .select("access_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ent?.access_type === "unlimited") {
    return "unlimited";
  }

  if (ent?.access_type === "pro") {
    return "pro";
  }

  return "none";
}
