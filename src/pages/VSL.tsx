import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* HERO */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Organize sua vida financeira em poucos minutos por dia
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Um sistema simples para você finalmente controlar seu dinheiro
          </p>
        </div>

        {/* VSL VIDEO */}
        <div className="mb-10">
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-lg shadow-primary/5">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
                title="FinFlow — Apresentação"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        {/* PRIMARY CTA (above the fold after video) */}
        <div className="text-center mb-12">
          <Button
            size="lg"
            className="px-8 py-6 text-base md:text-lg font-semibold"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
            {loading ? "Redirecionando..." : "Começar agora por R$29,90"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Acesso imediato após o pagamento • Cancele quando quiser
          </p>
        </div>

        {/* BENEFITS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>

        {/* FEATURES LIST */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4">
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
              <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* FINAL CTA */}
        <div className="text-center mb-8">
          <Button
            size="lg"
            className="px-8 py-6 text-base md:text-lg font-semibold"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
            {loading ? "Redirecionando..." : "Começar agora por R$29,90"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Pagamento seguro via Stripe
          </p>
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate("/login")}>
            Já tenho conta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VSL;
