import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, UserPlus, ArrowLeft, Loader2, CreditCard, PlayCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import DemoSimulation from "@/components/DemoSimulation";
import LoginMascotInvite from "@/components/mascot/LoginMascotInvite";

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const LoginScreen = ({ onLogin, onRegister }: LoginScreenProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) { setError(t("Preencha todos os campos")); setLoading(false); return; }
        const result = await onLogin(email.trim(), password);
        if (!result.success) setError(result.error || t("Erro ao entrar"));
      } else {
        if (!name.trim() || !email.trim() || !password) { setError(t("Preencha todos os campos")); setLoading(false); return; }
        if (password.length < 6) { setError(t("Senha deve ter pelo menos 6 caracteres")); setLoading(false); return; }
        const result = await onRegister(name.trim(), email.trim(), password);
        if (!result.success) {
          setError(result.error || t("Erro ao criar conta"));
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
    <div className="public-login-layout min-h-screen flex items-center justify-center p-4 relative">
      <button
        onClick={() => setDemoOpen(true)}
        aria-label={t("Ver demonstração")}
        title={t("Ver demonstração")}
        className="public-login-demo absolute top-[4.2rem] right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
      >
        <PlayCircle className="w-5 h-5" />
      </button>
      <div className="public-login-language absolute top-3 right-3 z-10">
        <LanguageSwitcher />
      </div>
      <DemoSimulation open={demoOpen} onOpenChange={setDemoOpen} />
      <LoginMascotInvite />
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
              <span className="text-foreground">{t("Seu dinheiro finalmente sobrando")}</span>
            </p>
            <p className="text-muted-foreground text-sm mt-10">
              {mode === "login" ? t("Entrar na minha conta") : t("Crie sua conta")}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {mode === "register" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Nome")}</label>
              <Input placeholder={t("Seu nome")} value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Email")}</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Senha")}</label>
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
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Aguarde...")}</>
            ) : mode === "login" ? (
              <><LogIn className="w-4 h-4 mr-2" /> {t("Entrar")}</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-2" /> {t("Criar Conta")}</>
            )}
          </Button>
        </div>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          {mode === "login" ? t("Não tem conta? Criar conta") : (
            <span className="flex items-center justify-center gap-1"><ArrowLeft className="w-3 h-3" /> {t("Já tenho uma conta")}</span>
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
