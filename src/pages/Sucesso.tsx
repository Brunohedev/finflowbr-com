import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Sucesso = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [checking, setChecking] = useState(false);

  // If signed in, poll the backend until Stripe confirms the subscription, then enter the app.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const { data } = await supabase.functions.invoke("check-subscription", { body: null });
        if (data?.subscribed) {
          if (!cancelled) navigate("/app", { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-4xl">🎉</div>
        <h1 className="text-2xl font-bold text-foreground">Pagamento recebido 🎉</h1>
        <p className="text-muted-foreground">
          {checking
            ? "Estamos confirmando sua assinatura. Isso pode levar alguns segundos..."
            : "Parabéns, você acabou de dar o primeiro passo para o seu futuro financeiro. Entre com o e-mail usado na compra."}
        </p>
        <Button onClick={() => navigate(isAuthenticated ? "/app" : "/login")} className="w-full" disabled={checking}>
          {checking ? "Confirmando..." : "Entrar no FinFlow"}
        </Button>
      </div>
    </div>
  );
};

export default Sucesso;
