import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "mensal",
    name: "Mensal",
    price: "R$ 29,90",
    period: "/mês",
    description: "Ideal para começar",
    features: [
      "Controle completo de gastos",
      "Categorias personalizáveis",
      "Reserva de emergência",
      "Metas financeiras",
      "Relatórios mensais",
    ],
  },
  {
    id: "semestral",
    name: "Semestral",
    price: "R$ 187,86",
    period: "/6 meses",
    description: "Economia de ~5%",
    popular: true,
    features: [
      "Features do plano Mensal + Semestral integradas",
      "Economia em relação ao mensal",
      "Suporte prioritário",
      "Insights avançados",
      "Projeções financeiras",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    price: "R$ 299,04",
    period: "/ano",
    description: "Melhor custo-benefício",
    features: [
      "Todas as funcionalidades integradas",
      "Maior economia",
      "Acesso antecipado a novidades",
      "Relatórios anuais completos",
      "Simulador de crescimento",
    ],
  },
];

const Pricing = () => {
  const { isAuthenticated, isLoading, session, subscription } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleSubscribe = async (plan: string) => {
    if (!isAuthenticated || !session) {
      navigate("/");
      return;
    }

    setLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      console.error("Portal error:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            Tenha controle total das suas finanças pessoais
          </p>
        </div>

        {subscription?.subscribed && (
          <div className="mb-8 p-4 rounded-xl border border-primary/30 bg-primary/5 text-center">
            <p className="text-sm text-foreground">
              Você tem o plano <strong className="capitalize">{subscription.plan}</strong> ativo
              {subscription.subscriptionEnd && (
                <> até <strong>{new Date(subscription.subscriptionEnd).toLocaleDateString("pt-BR")}</strong></>
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleManageSubscription}
              disabled={loading === "portal"}
            >
              {loading === "portal" ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Gerenciar assinatura
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = subscription?.subscribed && subscription.plan === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl border p-6 flex flex-col transition-all",
                  plan.popular
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                    : "border-border",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Popular
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Seu plano
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  disabled={!!loading || isCurrentPlan}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loading === plan.id ? (
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  ) : null}
                  {isCurrentPlan ? "Plano atual" : "Assinar"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Voltar ao dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
