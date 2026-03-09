import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, LogIn, UserPlus, ArrowLeft } from "lucide-react";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => { success: boolean; error?: string };
  onRegister: (name: string, email: string, password: string) => { success: boolean; error?: string };
}

const LoginScreen = ({ onLogin, onRegister }: LoginScreenProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    if (mode === "login") {
      if (!email.trim() || !password) { setError("Preencha todos os campos"); return; }
      const result = onLogin(email.trim(), password);
      if (!result.success) setError(result.error || "Erro ao entrar");
    } else {
      if (!name.trim() || !email.trim() || !password) { setError("Preencha todos os campos"); return; }
      if (password.length < 4) { setError("Senha deve ter pelo menos 4 caracteres"); return; }
      const result = onRegister(name.trim(), email.trim(), password);
      if (!result.success) setError(result.error || "Erro ao criar conta");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-heading">FinFlow</h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <div className="finance-card space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha</label>
            <Input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <Button className="w-full h-11 font-semibold" onClick={handleSubmit}>
            {mode === "login" ? <><LogIn className="w-4 h-4 mr-2" /> Entrar</> : <><UserPlus className="w-4 h-4 mr-2" /> Criar Conta</>}
          </Button>
        </div>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "login" ? "Não tem conta? Criar conta" : (
            <span className="flex items-center justify-center gap-1"><ArrowLeft className="w-3 h-3" /> Já tenho uma conta</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
