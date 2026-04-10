import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const Sucesso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Assinatura confirmada!</h1>
        <p className="text-muted-foreground mb-6">
          Seu pagamento foi processado com sucesso. Agora você tem acesso completo ao FinFlow.
        </p>
        <Button onClick={() => navigate("/")} className="w-full">
          Ir para o dashboard
        </Button>
      </div>
    </div>
  );
};

export default Sucesso;
