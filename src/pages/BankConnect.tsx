import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Plaid?: {
      create: (config: any) => { open: () => void; exit: () => void; destroy: () => void };
    };
  }
}

type PendingTx = {
  id: string;
  name: string | null;
  amount: number | null;
};

const CATS = [
  { id: "essenciais", label: "Essenciais" },
  { id: "desejos", label: "Desejos" },
  { id: "reserva_investimentos", label: "Reserva" },
];

const formatCurrency = (v: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v ?? 0);

const BankConnect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isLoading, isAuthenticated, navigate]);

  const loadPending = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("id, name, amount")
      .eq("user_id", user.id)
      .is("category", null)
      .order("date", { ascending: false });
    if (error) toast.error("Erro ao carregar transações");
    else setPending((data as PendingTx[]) || []);
    setLoadingTx(false);
  }, [user]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const startPlaid = async () => {
    if (!user) return;
    if (!window.Plaid) {
      toast.error("Plaid ainda está carregando, tente novamente em instantes.");
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-link-token", {
        body: { user_id: user.id },
      });
      if (error || !data?.link_token) throw new Error(error?.message || "Falha ao gerar link_token");

      const handler = window.Plaid.create({
        token: data.link_token,
        onSuccess: async (public_token: string) => {
          try {
            const { error: exErr } = await supabase.functions.invoke("exchange-public-token", {
              body: { public_token, user_id: user.id },
            });
            if (exErr) throw exErr;
            toast.success("Banco conectado com sucesso!");
            await loadPending();
          } catch (e: any) {
            toast.error(e?.message || "Erro ao trocar token");
          }
        },
        onExit: (err: any) => {
          if (err) toast.error(err.display_message || "Conexão cancelada");
        },
      });
      handler.open();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar Plaid");
    } finally {
      setConnecting(false);
    }
  };

  const categorize = async (id: string, category: string) => {
    const prev = pending;
    setPending((p) => p.filter((t) => t.id !== id));
    const { error } = await supabase.from("transactions").update({ category }).eq("id", id);
    if (error) {
      toast.error("Erro ao categorizar");
      setPending(prev);
      return;
    }

    const { error: budgetErr } = await supabase.functions.invoke("update-budget", {
      body: { transaction_id: id, category },
    });
    if (budgetErr) {
      toast.error("Categorizada, mas falha ao atualizar orçamento");
    } else {
      toast.success("Categorizada!");
    }
  };

  return (
    <div className="min-h-screen bg-[#ecf3f0] pb-16">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-heading font-bold text-lg">Conectar meu banco</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        <div className="finance-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Conecte sua conta bancária</p>
              <p className="text-xs text-muted-foreground">Importe transações automaticamente via Plaid</p>
            </div>
          </div>
          <Button onClick={startPlaid} disabled={connecting} className="w-full">
            {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando…</> : "Conectar banco"}
          </Button>
        </div>

        <div className="finance-card">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Transações Pendentes
          </h2>
          {loadingTx ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação pendente.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((t) => (
                <div key={t.id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium truncate">{t.name || "—"}</p>
                    <span className="text-sm font-semibold font-heading shrink-0">{formatCurrency(t.amount)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {CATS.map((c) => (
                      <Button
                        key={c.id}
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => categorize(t.id, c.id)}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BankConnect;
