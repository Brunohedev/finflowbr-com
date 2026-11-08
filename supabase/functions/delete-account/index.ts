import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { deleteOwnedAccount, DeletionError, productionPlaid } from "./deletion.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Deletion is temporarily unavailable", code: "SERVICE_UNAVAILABLE" }, 503);
    const admin = createClient(url, key);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    await deleteOwnedAccount(user.id, {
      async connections(uid) {
        const { data, error } = await admin.from("plaid_connections").select("access_token,item_id").eq("user_id", uid);
        if (error || !data) throw new DeletionError("BANK_READ_FAILED");
        return data;
      },
      async shared(uid, token, itemId) {
        const tokenResult = await admin.from("plaid_connections").select("user_id").eq("access_token", token).neq("user_id", uid).limit(1);
        if (tokenResult.error) throw new DeletionError("BANK_READ_FAILED");
        if (tokenResult.data?.length) return true;
        if (!itemId) return false;
        const itemResult = await admin.from("plaid_connections").select("user_id").eq("item_id", itemId).neq("user_id", uid).limit(1);
        if (itemResult.error) throw new DeletionError("BANK_READ_FAILED");
        return Boolean(itemResult.data?.length);
      },
      async cleanNonCascading(uid) {
        // The remaining user_id tables have deployed ON DELETE CASCADE.
        // Email-based administrative and legal request records are not touched.
        for (const table of ["budgets", "pluggy_connections"]) {
          const { error } = await admin.from(table).delete().eq("user_id", uid);
          if (error) throw new DeletionError("DATA_CLEANUP_FAILED");
          const remaining = await admin.from(table).select("user_id").eq("user_id", uid).limit(1);
          if (remaining.error || !remaining.data || remaining.data.length) throw new DeletionError("DATA_CLEANUP_FAILED");
        }
      },
      async deleteIdentity(uid) {
        const { error } = await admin.auth.admin.deleteUser(uid);
        if (error) throw new DeletionError("AUTH_DELETE_FAILED");
      },
    }, productionPlaid(Deno.env.get("PLAID_CLIENT_ID"), Deno.env.get("PLAID_SECRET")));

    return json({ success: true });
  } catch (e) {
    const code = e instanceof DeletionError ? e.code : "SERVICE_UNAVAILABLE";
    console.warn("Account deletion incomplete", { code });
    return json({ error: "Account deletion was not completed. Some bank connections or data may already have been removed. Retry or contact support.", code }, 503);
  }
});
