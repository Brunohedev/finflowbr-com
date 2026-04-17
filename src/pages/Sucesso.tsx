import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Sucesso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-4xl">🎉</div>
        <h1 className="text-2xl font-bold text-foreground">Pagamento confirmado 🎉</h1>
        <p className="text-muted-foreground">
          Parabéns, você acabou de dar o primeiro passo para o seu futuro financeiro.
          <br /><br />
          Seu acesso já foi liberado. Basta entrar com o e-mail usado na compra.
        </p>
        <Button onClick={() => navigate("/login")} className="w-full">
          Entrar no FinFlow
        </Button>
      </div>
    </div>
  );
};

export default Sucesso;
