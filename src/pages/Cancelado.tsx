import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

const Cancelado = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Pagamento cancelado</h1>
        <p className="text-muted-foreground mb-6">
          O processo de pagamento foi cancelado. Você pode tentar novamente quando quiser.
        </p>
        <div className="space-y-2">
          <Button onClick={() => navigate("/planos")} className="w-full">
            Ver planos
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
            Voltar ao dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Cancelado;
