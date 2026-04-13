import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, UserPlus, ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const LoginScreen = ({ onLogin, onRegister }: LoginScreenProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) { setError("Preencha todos os campos"); setLoading(false); return; }
        const result = await onLogin(email.trim(), password);
        if (!result.success) setError(result.error || "Erro ao entrar");
      } else {
        if (!name.trim() || !email.trim() || !password) { setError("Preencha todos os campos"); setLoading(false); return; }
        if (password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres"); setLoading(false); return; }
        const result = await onRegister(name.trim(), email.trim(), password);
        if (!result.success) {
          setError(result.error || "Erro ao criar conta");
        } else {
          navigate("/app", { replace: true });
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
            <div className="h-[250px] flex items-center justify-center overflow-hidden">
              <img
                src="/finflow-logo.gif"
                alt="FinFlow"
                className="w-[250px] h-[250px] object-contain"
              />
            </div>
            <p className="text-xs tracking-wide font-bold -mt-24">
              <span className="text-foreground">Feito para </span>
              <span style={{ color: '#FFDF00' }}>Bra</span>
              <span style={{ color: '#1B3A8A' }}>sil</span>
              <span style={{ color: '#009739' }}>eiros</span>
            </p>
            <p className="text-muted-foreground text-sm mt-10">
              {mode === "login" ? "Entrar na minha conta" : "Crie sua conta"}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {mode === "register" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha</label>
            <Input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              disabled={loading}
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <Button className="w-full h-11 font-semibold" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>
            ) : mode === "login" ? (
              <><LogIn className="w-4 h-4 mr-2" /> Entrar</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-2" /> Criar Conta</>
            )}
          </Button>
        </div>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          {mode === "login" ? "Não tem conta? Criar conta" : (
            <span className="flex items-center justify-center gap-1"><ArrowLeft className="w-3 h-3" /> Já tenho uma conta</span>
          )}
        </button>

        {mode === "register" && (
          <button
            onClick={() => navigate("/planos")}
            className="w-full text-center text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
