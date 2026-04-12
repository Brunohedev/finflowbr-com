import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const Sucesso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Pagamento confirmado com sucesso</h1>
        <p className="text-muted-foreground mb-6">
          Sua assinatura foi ativada. Agora você pode acessar o sistema utilizando seu email e senha cadastrados.
        </p>
        <Button onClick={() => navigate("/", { replace: true })} className="w-full">
          Ir para login
        </Button>
      </div>
    </div>
  );
};

export default Sucesso;
