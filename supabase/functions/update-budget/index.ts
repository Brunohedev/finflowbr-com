import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transaction_id, category } = await req.json();
    if (!transaction_id || !category) {
      return new Response(JSON.stringify({ error: "transaction_id and category required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify user from JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch transaction
    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select("id, amount, date, user_id")
      .eq("id", transaction_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Math.abs(Number(tx.amount ?? 0));
    const dateStr = tx.date ?? new Date().toISOString().slice(0, 10);
    const month = String(dateStr).slice(0, 7); // YYYY-MM

    // Find existing budget for user/month/category
    const { data: budget } = await admin
      .from("budgets")
      .select("id, spent, total")
      .eq("user_id", user_id)
      .eq("month", month)
      .eq("category", category)
      .maybeSingle();

    if (budget) {
      const newSpent = Number(budget.spent ?? 0) + amount;
      const { error: upErr } = await admin
        .from("budgets")
        .update({ spent: newSpent })
        .eq("id", budget.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await admin.from("budgets").insert({
        user_id,
        month,
        category,
        spent: amount,
        total: 0,
      });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ success: true, amount, month, category }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
