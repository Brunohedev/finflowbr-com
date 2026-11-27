import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Crown, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DEFAULT_BILLING_CAPABILITIES,
  fetchBillingCapabilities,
  type ClientBillingCapabilities,
} from "@/lib/billingCapabilities";

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  checkoutUrl: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: "$29.90",
    period: "/mês",
    description: "Ideal para começar",
    checkoutUrl: "https://buy.stripe.com/fZueVd6KcfL0aW5alC4Ja03",
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
    price: "$187.86",
    period: "/6 meses",
    description: "Economia de ~5%",
    popular: true,
    checkoutUrl: "https://buy.stripe.com/00waEXfgIcyOc09dxO4Ja04",
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
    price: "$299.04",
    period: "/ano",
    description: "Melhor custo-benefício",
    checkoutUrl: "https://buy.stripe.com/aFaeVd4C46aqc09gK04Ja05",
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
  const { isAuthenticated, isLoading, subscription, checkSubscription, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ClientBillingCapabilities>(DEFAULT_BILLING_CAPABILITIES);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    fetchBillingCapabilities()
      .then((result) => {
        if (active) setCapabilities(result);
      })
      .finally(() => {
        if (active) setCapabilitiesLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleSubscribe = async (planId: string, skipTrial = false) => {
    if (capabilitiesLoading) return;
    if (capabilities.checkoutV2 && !isAuthenticated) {
      navigate("/login?mode=register&next=/planos");
      return;
    }

    const loadingKey = `${planId}:${skipTrial ? "direct" : "trial"}`;
    setLoading(loadingKey);
    try {
      const { data, error } = capabilities.checkoutV2
        ? await supabase.functions.invoke("create-checkout-v2", {
            body: {
              plan: planId,
              request_id: crypto.randomUUID(),
              ...(skipTrial ? { skip_trial: true } : {}),
            },
          })
        : await supabase.functions.invoke("create-checkout", {
            body: { plan: planId },
          });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.code === "already_subscribed" || data?.code === "checkout_already_completed") {
        await checkSubscription();
        toast.success(t("Sua assinatura já está ativa."));
        navigate("/app", { replace: true });
        return;
      }
      if (data?.code === "checkout_in_progress") {
        toast.info(t("Já existe um checkout em andamento. Aguarde alguns instantes e tente novamente."));
        return;
      } else {
        toast.error(t("Não foi possível iniciar o checkout. Tente novamente."));
      }
    } catch (err: any) {
      console.error("[Pricing] Checkout error:", err);
      toast.error(t("Não foi possível iniciar o checkout. Tente novamente."));
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
    <div className="ios-safe-page min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            {capabilities.checkoutV2
              ? t("Comece com 3 dias grátis no plano escolhido!")
              : "Tenha controle total das suas finanças pessoais"}
          </p>
        </div>

        {subscription?.subscribed && (
          <div className="mb-8 p-4 rounded-xl border border-primary/30 bg-primary/5 text-center">
            <p className="text-sm text-foreground">
              {subscription.status === "trialing" ? "Você está no teste grátis do plano " : "Você tem o plano "}
              <strong className="capitalize">{subscription.plan}</strong>
              {subscription.status === "trialing" ? "" : " ativo"}
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
                  {capabilities.checkoutV2 && !subscription?.subscribed && (
                    <p className="text-xs font-medium text-primary mt-1">
                      {t("3 dias grátis (72h) • $0 hoje para novos assinantes")}
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled
                  >
                    Plano atual
                  </Button>
                ) : capabilities.checkoutV2 && !capabilitiesLoading ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.id, false)}
                      disabled={loading !== null}
                    >
                      {loading === `${plan.id}:trial` ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                      {loading === `${plan.id}:trial`
                        ? "Redirecionando..."
                        : isAuthenticated
                        ? t("Começar 3 dias grátis")
                        : t("Criar conta e testar grátis")}
                    </Button>
                    <Button
                      className="w-full"
                      variant={plan.popular ? "outline" : "secondary"}
                      onClick={() => handleSubscribe(plan.id, true)}
                      disabled={loading !== null}
                    >
                      {loading === `${plan.id}:direct` ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                      {loading === `${plan.id}:direct` ? "Redirecionando..." : t("Assinar agora")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id, false)}
                    disabled={capabilitiesLoading || loading !== null}
                  >
                    {capabilitiesLoading || loading === `${plan.id}:trial` ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                    {loading === `${plan.id}:trial`
                      ? "Redirecionando..."
                      : capabilitiesLoading
                      ? t("Carregando...")
                      : "Assinar"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {capabilities.checkoutV2 && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t("")}
          </p>
        )}

        <div className="text-center mt-8">
          {isAuthenticated && <Button variant="ghost" onClick={() => navigate("/excluir-conta")}><Trash2 className="mr-2 h-4 w-4" />{t("Excluir conta")}</Button>}
          <Button variant="ghost" onClick={async () => { if (isAuthenticated) await logout(); navigate("/", { replace: true }); }}>
            Voltar à tela de cadastro
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
