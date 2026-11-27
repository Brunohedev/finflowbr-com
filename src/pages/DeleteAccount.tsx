import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import {
  DEFAULT_BILLING_CAPABILITIES,
  DELETION_CONSENT_VERSION,
  fetchBillingCapabilities,
} from "@/lib/billingCapabilities";

const CONFIRM_WORD = "DELETE";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [confirm, setConfirm] = useState("");
  const [cancelConsent, setCancelConsent] = useState(false);
  const [cancelsBilling, setCancelsBilling] = useState(DEFAULT_BILLING_CAPABILITIES.accountDeletionWithCancellation);
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const deleting = useRef(false);

  useEffect(() => {
    let active = true;
    fetchBillingCapabilities().then((caps) => {
      if (!active) return;
      setCancelsBilling(caps.accountDeletionWithCancellation);
      setCapabilitiesReady(true);
    });
    return () => { active = false; };
  }, []);

  const canSubmit = capabilitiesReady &&
    !loading &&
    confirm.trim().toUpperCase() === CONFIRM_WORD &&
    (!cancelsBilling || cancelConsent);

  const handleDelete = async () => {
    if (deleting.current || !canSubmit) return;
    deleting.current = true;
    setFailureMessage(null);
    setLoading(true);
    try {
      const { data, error } = cancelsBilling
        ? await supabase.functions.invoke("delete-account-v2", {
            body: {
              confirmation: CONFIRM_WORD,
              consent_version: DELETION_CONSENT_VERSION,
              cancel_subscriptions: true,
            },
          })
        : await supabase.functions.invoke("delete-account");

      if (data?.code && String(data.code).startsWith("SUBSCRIPTION_")) {
        setFailureMessage(t("Não foi possível confirmar o cancelamento da assinatura no Stripe. A exclusão da conta não foi iniciada."));
        toast.error(t("Não foi possível cancelar a assinatura. A conta não foi excluída."));
        setLoading(false);
        return;
      }
      if (error || data?.success !== true) throw new Error("Deletion incomplete");
      localStorage.clear();
      await logout().catch(() => {});
      toast.success(t("Sua conta foi excluída."));
      navigate("/login", { replace: true });
    } catch {
      setFailureMessage(t("A exclusão não foi concluída. Algumas conexões bancárias ou dados podem já ter sido removidos. Tente novamente ou fale com o suporte."));
      toast.error(t("Não foi possível excluir a conta. Tente novamente."));
      setLoading(false);
    } finally {
      deleting.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="ios-safe-delete max-w-lg mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" disabled={loading} className="rounded-xl -ml-2" onClick={() => navigate("/app")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("Voltar")}
        </Button>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold">{t("Excluir conta")}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {cancelsBilling
            ? t("Excluir sua conta FinFlow cancelará imediatamente qualquer assinatura ou teste grátis ativo no Stripe vinculado a esta conta.")
            : t("Excluir sua conta FinFlow não cancela sua assinatura Stripe. Cancele a assinatura separadamente antes de excluir a conta.")}
        </p>
        {failureMessage && <p role="alert" className="text-sm text-destructive">{failureMessage}</p>}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
          <p className="font-semibold text-destructive">{t("Esta ação é permanente.")}</p>
          <p className="text-muted-foreground">
            {cancelsBilling
              ? t("Todos os seus dados serão apagados (renda, despesas, metas, reservas, investimentos e conexões bancárias) e sua assinatura ou teste grátis ativo no Stripe será cancelado imediatamente.")
              : t("Todos os seus dados serão apagados: renda, despesas, metas, reservas, investimentos e conexões bancárias. Assinaturas ativas devem ser canceladas separadamente.")}
          </p>
        </div>
        {cancelsBilling && (
          <label htmlFor="cancel-subscription-consent" className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm cursor-pointer">
            <Checkbox
              id="cancel-subscription-consent"
              checked={cancelConsent}
              onCheckedChange={(checked) => setCancelConsent(checked === true)}
              disabled={loading}
              className="mt-0.5"
            />
            <span>
              {t("Entendo que excluir minha conta cancelará imediatamente minha assinatura ou teste grátis no Stripe e apagará meus dados permanentemente.")}
            </span>
          </label>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium block">
            {t("Digite")} <span className="font-bold">{CONFIRM_WORD}</span> {t("para confirmar")}
          </label>
          <Input aria-label={t("Digite DELETE para confirmar")} disabled={loading} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={CONFIRM_WORD} />
        </div>
        <Button
          variant="destructive"
          className="w-full font-semibold"
          disabled={!canSubmit}
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
