import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    // Verify the webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const plan = session.metadata?.plan || null;

      logStep("Checkout completed", { customerEmail, customerId, subscriptionId, plan });

      if (!customerEmail) {
        logStep("No customer email found, skipping user creation");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Use service role to create/manage users
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);

      if (existingUser) {
        logStep("User already exists", { userId: existingUser.id });
      } else {
        // Create new user with a random password (user can reset later)
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: customerEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { plan, stripe_customer_id: customerId },
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
