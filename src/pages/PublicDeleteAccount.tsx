import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { CheckCircle2, Mail, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SUPPORT_EMAIL = "finflow.br@gmail.com";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  name: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(1000).optional(),
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-heading text-lg font-semibold">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </section>
);

const PublicDeleteAccount = () => {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: "", name: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid data");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: dbError } = await supabase.from("account_deletion_requests").insert({
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name || null,
      reason: parsed.data.reason || null,
    });
    setLoading(false);
    if (dbError) {
      setError(`We couldn't submit your request. Please try again or email ${SUPPORT_EMAIL}.`);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <span className="font-heading font-bold text-lg">Fin<span className="text-primary">Flow</span></span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Delete your FinFlow account</h1>
          <p className="text-sm text-muted-foreground">
            You can request the deletion of your FinFlow account and its associated data at any time.
          </p>
        </div>

        <Section title="Option 1 — Delete inside the app">
          <p>
            If you can sign in, open the menu on the main screen and tap <strong className="text-foreground">Excluir conta</strong> (Delete account).
            After you confirm, your account and data are removed right away.
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to={isAuthenticated ? "/excluir-conta" : "/login"}>
              <Trash2 className="w-4 h-4 mr-2" /> {isAuthenticated ? "Go to account deletion" : "Sign in to delete"}
            </Link>
          </Button>
        </Section>

        <Section title="Option 2 — Submit a request">
          <p>Can't access the app? Send a request below using the email linked to your FinFlow account. Our team reviews it and processes the deletion within 30 days. We may contact you at that email to verify you own the account.</p>
        </Section>

        <div className="rounded-2xl border border-border bg-card p-5">
          {submitted ? (
            <div className="flex flex-col items-center text-center gap-3 py-6" role="status">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <h3 className="font-heading text-lg font-semibold">Request received</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your deletion request for <strong className="text-foreground">{form.email}</strong> was submitted. We'll process it within 30 days and may contact you to confirm.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">Account email *</label>
                <Input id="email" type="email" required maxLength={255} value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">Name (optional)</label>
                <Input id="name" maxLength={100} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-medium">Reason (optional)</label>
                <Textarea id="reason" maxLength={1000} rows={3} value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="destructive" className="w-full font-semibold" disabled={loading}>
                {loading ? "Submitting..." : "Request account deletion"}
              </Button>
            </form>
          )}
        </div>

        <Section title="What gets deleted">
          <ul className="list-disc pl-5 space-y-1">
            <li>Your login (email and password)</li>
            <li>Your profile and name</li>
            <li>Income, expenses, budgets, goals, reserves and investments</li>
            <li>Imported bank transactions and saved bank connections (Plaid / Pluggy)</li>
          </ul>
          <p>Deletion is permanent and cannot be undone.</p>
        </Section>

        <Section title="What may be kept">
          <ul className="list-disc pl-5 space-y-1">
            <li>Payment and billing records kept by our payment processor (Stripe), as required by tax and accounting laws.</li>
            <li>Your deletion request record (email and date), kept as proof that we handled it.</li>
            <li>Data held by Plaid or Pluggy under their own privacy policies.</li>
          </ul>
          <p>Deleting your account does not cancel an active subscription. Please cancel it separately before deleting.</p>
        </Section>

        <Section title="Contact">
          <p className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`} className="text-primary underline">{SUPPORT_EMAIL}</a>
          </p>
          <p>See also our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</p>
        </Section>
      </main>
    </div>
  );
};

export default PublicDeleteAccount;
