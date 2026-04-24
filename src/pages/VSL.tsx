import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

const VSL = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: "mensal" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("[VSL] Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: Wallet,
      title: "Clareza financeira",
      description: "Veja exatamente quanto sobra no seu mês, sem complicação.",
    },
    {
      icon: ShieldCheck,
      title: "Controle de gastos",
      description: "Acompanhe categorias, recorrências e parcelas em um só lugar.",
    },
    {
      icon: Sparkles,
      title: "Simplicidade no dia a dia",
      description: "Poucos minutos por dia bastam para manter tudo organizado.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* HERO with VSL background */}
      <section className="relative overflow-hidden">
        {/* Strong green gradient base (matches usfinflow hero) */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, hsl(155 70% 88%) 0%, hsl(150 60% 92%) 40%, hsl(var(--background)) 100%)",
          }}
        />
        {/* Soft green glow */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.35), transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.35) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />
        {/* Decorative blurred orbs */}
        <div
          aria-hidden
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full -z-10 blur-3xl opacity-50"
          style={{ background: "hsl(var(--primary) / 0.4)" }}
        />
        <div
          aria-hidden
          className="absolute top-10 -right-20 h-80 w-80 rounded-full -z-10 blur-3xl opacity-40"
          style={{ background: "hsl(155 80% 60% / 0.5)" }}
        />

        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-10 md:pb-16">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 backdrop-blur px-4 py-1.5 text-xs md:text-sm text-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Sistema FinFlow 2.0 — agora disponível
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-center text-4xl md:text-6xl font-extrabold text-foreground leading-[1.05] tracking-tight mb-6">
            O sistema que vai fazer{" "}
            <span className="relative inline-block text-primary">
              seu dinheiro sobrar
              <svg
                aria-hidden
                viewBox="0 0 300 12"
                className="absolute left-0 -bottom-2 w-full h-2 text-primary"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8 Q 75 2, 150 6 T 298 5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h1>

          <p className="text-center text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8">
            Um sistema simples para você finalmente controlar seu dinheiro e
            saber <strong className="text-foreground">quanto sobra</strong> — em
            segundos.
          </p>

          {/* VSL VIDEO as visual centerpiece */}
          <div className="relative mx-auto max-w-4xl mb-8">
            <div
              className="absolute -inset-4 rounded-[2rem] -z-10 blur-2xl opacity-60"
              style={{
                background:
                  "radial-gradient(ellipse at center, hsl(var(--primary) / 0.35), transparent 70%)",
              }}
            />
            <div className="relative rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-2xl shadow-primary/10">
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube-nocookie.com/embed/NjPl9G5i-qU?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&playsinline=1&controls=1&disablekb=1&fs=0&color=white"
                  title="FinFlow"
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div aria-hidden className="absolute top-0 left-0 right-0 h-14 bg-card pointer-events-none" />
                <div aria-hidden className="absolute bottom-0 right-0 w-24 h-10 bg-card pointer-events-none" />
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button
              size="lg"
              className="px-8 py-6 text-base md:text-lg font-semibold rounded-full shadow-lg shadow-primary/20"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
              ) : null}
              {loading ? "Redirecionando..." : "Começar agora por R$29,90"}
              {!loading && <ArrowRight className="ml-1 h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="rounded-full"
              onClick={() => navigate("/login")}
            >
              Já tenho conta
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> 100% seguro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Acesso imediato
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> +10.000 brasileiros
            </span>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES LIST */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pb-12 md:pb-16">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">
            O que está incluso
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Controle completo de gastos",
              "Categorias personalizáveis",
              "Reserva de emergência",
              "Metas financeiras",
              "Relatórios mensais",
              "Insights e projeções",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pb-16">
        <div
          className="rounded-3xl border border-primary/30 p-8 md:p-12 text-center"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary) / 0.18), transparent 70%), hsl(var(--card))",
          }}
        >
          <h2 className="font-heading text-2xl md:text-4xl font-bold text-foreground mb-3">
            Pronto para ver seu dinheiro sobrar?
          </h2>
          <p className="text-muted-foreground mb-6">
            Comece agora e tenha clareza total das suas finanças hoje mesmo.
          </p>
          <Button
            size="lg"
            className="px-8 py-6 text-base md:text-lg font-semibold rounded-full shadow-lg shadow-primary/20"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
            ) : null}
            {loading ? "Redirecionando..." : "Começar agora por R$29,90"}
            {!loading && <ArrowRight className="ml-1 h-5 w-5" />}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Pagamento seguro via Stripe • Cancele quando quiser
          </p>
        </div>
      </section>
    </div>
  );
};

export default VSL;
