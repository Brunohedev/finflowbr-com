import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const buildAppMetadata = (
  currentMetadata: Record<string, unknown> | undefined,
  {
    customerId,
    subscriptionId,
    plan,
  }: {
    customerId: string | null;
    subscriptionId: string | null;
    plan: string | null;
  },
) => ({
  ...(currentMetadata ?? {}),
  subscription_status: "active",
  is_active: true,
  stripe_customer_id: customerId,
  subscription_id: subscriptionId,
  plan,
});

const findUserByEmail = async (supabaseAdmin: ReturnType<typeof createClient>, email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
};

serve(async (req) => {
  // Webhooks are POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    // Verify the webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      const plan = session.metadata?.plan || null;

      logStep("Checkout completed", { customerEmail, customerId, subscriptionId, plan });

      if (!customerEmail) {
        logStep("No customer email found, skipping user creation");
        return jsonResponse({ received: true });
      }

      const existingUser = await findUserByEmail(supabaseAdmin, customerEmail);
      const nextAppMetadata = buildAppMetadata(existingUser?.app_metadata, {
        customerId,
        subscriptionId,
        plan,
      });

      if (existingUser) {
        logStep("User already exists", { userId: existingUser.id });
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: nextAppMetadata,
        });

        if (updateError) {
          logStep("Error activating existing user", { error: updateError.message, userId: existingUser.id });
          throw updateError;
        }

        logStep("Existing user activated", {
          userId: existingUser.id,
          subscriptionStatus: nextAppMetadata.subscription_status,
          isActive: nextAppMetadata.is_active,
        });
      } else {
        // Create new user with a random password (user can reset later)
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: customerEmail,
          password: tempPassword,
          email_confirm: true,
          app_metadata: nextAppMetadata,
          user_metadata: plan ? { plan } : undefined,
        });

        if (createError) {
          logStep("Error creating user", { error: createError.message });
          throw createError;
        }
        logStep("User created", { userId: newUser.user?.id });

        // Send password reset email so user can set their own password
        // Note: This uses the magic link / reset flow
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: customerEmail,
          options: {
            redirectTo: `${req.headers.get("origin") || Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}`,
          },
        });
        if (resetError) {
          logStep("Error sending magic link", { error: resetError.message });
        } else {
          logStep("Magic link generated for new user");
        }
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return jsonResponse({ error: message }, 400);
  }
});
