import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const CONFIRM_WORD = "DELETE";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error || data?.error) throw new Error(data?.error || error?.message);
      localStorage.clear();
      await logout().catch(() => {});
      toast.success(t("Sua conta foi excluída."));
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error(t("Não foi possível excluir a conta. Tente novamente."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => navigate("/app")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("Voltar")}
        </Button>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold">{t("Excluir conta")}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
          <p className="font-semibold text-destructive">{t("Esta ação é permanente.")}</p>
          <p className="text-muted-foreground">
            {t("Todos os seus dados serão apagados: renda, despesas, metas, reservas, investimentos e conexões bancárias. Assinaturas ativas devem ser canceladas separadamente.")}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium block">
            {t("Digite")} <span className="font-bold">{CONFIRM_WORD}</span> {t("para confirmar")}
          </label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={CONFIRM_WORD} />
        </div>
        <Button
          variant="destructive"
          className="w-full font-semibold"
          disabled={loading || confirm.trim().toUpperCase() !== CONFIRM_WORD}
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {loading ? t("Excluindo...") : t("Excluir minha conta")}
        </Button>
      </main>
    </div>
  );
};

export default DeleteAccount;
