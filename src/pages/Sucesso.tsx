import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBillingCapabilities } from "@/lib/billingCapabilities";

const SESSION_ID_RE = /^cs_[A-Za-z0-9_]+$/;

type ConfirmationState = "checking" | "trial" | "paid" | "expired" | "fallback";

const Sucesso = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, checkSubscription } = useAuth();
  const [status, setStatus] = useState<ConfirmationState>("fallback");
  const rawSessionId = searchParams.get("session_id") ?? "";
  const sessionId = SESSION_ID_RE.test(rawSessionId) ? rawSessionId : null;

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    setStatus("checking");

    (async () => {
      const capabilities = await fetchBillingCapabilities();
      if (cancelled) return;

      if (sessionId && capabilities.checkoutConfirmation) {
        for (let i = 0; i < 12 && !cancelled; i++) {
          const { data, error } = await supabase.functions.invoke("checkout-confirmation", {
            body: { session_id: sessionId },
          });
          if (cancelled) return;
          if (!error && data?.subscribed) {
            await checkSubscription();
            if (!cancelled) {
              setStatus(data.trial_started ? "trial" : "paid");
              setTimeout(() => { if (!cancelled) navigate("/app", { replace: true }); }, 1200);
            }
            return;
          }
          if (data?.code === "CHECKOUT_EXPIRED") {
            setStatus("expired");
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (!cancelled) setStatus("fallback");
        return;
      }

      for (let i = 0; i < 20 && !cancelled; i++) {
        const { data } = await supabase.functions.invoke("check-subscription", { body: null });
        if (data?.subscribed) {
          await checkSubscription();
          if (!cancelled) navigate("/app", { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) setStatus("fallback");
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, navigate, sessionId, checkSubscription]);

  const checking = status === "checking";
  const title = status === "trial"
    ? "Teste grátis ativado! 🎉"
    : status === "expired"
    ? "Checkout expirado"
    : status === "paid"
    ? "Assinatura confirmada! 🎉"
    : "Pagamento recebido 🎉";
  const message = checking
    ? "Estamos confirmando sua assinatura. Isso pode levar alguns segundos..."
    : status === "trial"
    ? "Seus 3 dias grátis (72 horas) começaram. Você não foi cobrado hoje e já pode usar o FinFlow."
    : status === "expired"
    ? "Esta sessão de checkout expirou antes da conclusão. Volte para os planos para tentar novamente."
    : status === "paid"
    ? "Sua assinatura está ativa. Redirecionando para o FinFlow..."
    : "Parabéns, você acabou de dar o primeiro passo para o seu futuro financeiro. Entre com o e-mail usado na compra.";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-4xl">{status === "expired" ? "⏱️" : "🎉"}</div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        <Button
          onClick={() => navigate(status === "expired" ? "/planos" : isAuthenticated ? "/app" : "/login")}
          className="w-full"
          disabled={checking}
        >
          {checking ? "Confirmando..." : status === "expired" ? "Voltar aos planos" : "Entrar no FinFlow"}
        </Button>
      </div>
    </div>
  );
};

export default Sucesso;
