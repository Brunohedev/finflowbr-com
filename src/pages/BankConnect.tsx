import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

const monthBounds = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const last = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { first, last, ym: `${y}-${pad(m + 1)}` };
};

const clampToCurrentMonth = (d: string | null | undefined) => {
  const { first, last, ym } = monthBounds();
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d.slice(0, 7) !== ym) return new Date().toISOString().slice(0, 10);
  if (d < first) return first;
  if (d > last) return last;
  return d;
};

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
  date: string | null;
};

type CategorizedTx = PendingTx & { category: string };

const CATS = [
  { id: "essenciais", label: "Essenciais" },
  { id: "desejos", label: "Desejos" },
];

const catLabel = (id: string) => CATS.find((c) => c.id === id)?.label || id;

const formatCurrency = (v: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v ?? 0);

type Subcat = { id: string; name: string };

const BankConnect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [categorized, setCategorized] = useState<CategorizedTx[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [chosenCat, setChosenCat] = useState<Record<string, string>>({});
  const [subcatsByCat, setSubcatsByCat] = useState<Record<string, Subcat[]>>({});
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isLoading, isAuthenticated, navigate]);

  const loadPending = useCallback(async () => {
    if (!user) return;
    setLoadingTx(true);
    const [{ data, error }, { data: catData }, { data: fdRow }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, name, amount, date")
        .eq("user_id", user.id)
        .is("category", null)
        .order("date", { ascending: false }),
      supabase
        .from("transactions")
        .select("id, name, amount, date, category")
        .eq("user_id", user.id)
        .not("category", "is", null)
        .order("date", { ascending: false }),
      supabase.from("finance_data").select("data").eq("user_id", user.id).maybeSingle(),
    ]);
    if (error) toast.error("Erro ao carregar transações");
    else {
      const list = (data as PendingTx[]) || [];
      setPending(list);
      const map: Record<string, string> = {};
      list.forEach((t) => { map[t.id] = clampToCurrentMonth(t.date); });
      setDates(map);
    }
    setCategorized((catData as CategorizedTx[]) || []);
    const fd: any = fdRow?.data || null;
    if (fd && Array.isArray(fd.categories)) {
      const sub: Record<string, Subcat[]> = {};
      fd.categories.forEach((c: any) => {
        sub[c.id] = (c.subcategories || []).map((s: any) => ({ id: s.id, name: s.name }));
      });
      setSubcatsByCat(sub);
    }
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

  const categorize = async (id: string, category: string, subcategoryId?: string) => {
    if (!user) return;
    const tx = pending.find((t) => t.id === id);
    const chosenDate = clampToCurrentMonth(dates[id] || tx?.date || null);
    const prev = pending;
    setPending((p) => p.filter((t) => t.id !== id));
    setChosenCat((c) => { const n = { ...c }; delete n[id]; return n; });

    const { error } = await supabase
      .from("transactions")
      .update({ category, date: chosenDate })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao categorizar");
      setPending(prev);
      return;
    }

    // Desconta no saldo da categoria adicionando como expense em finance_data
    try {
      const amount = Math.abs(Number(tx?.amount ?? 0));
      if (amount > 0) {
        const { data: row } = await supabase
          .from("finance_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        const fd: any = row?.data || null;
        if (fd && Array.isArray(fd.expenses)) {
          const newExpense = {
            id: crypto.randomUUID(),
            name: tx?.name || "Transação bancária",
            amount,
            categoryId: category,
            subcategoryId: subcategoryId || "",
            date: chosenDate,
            status: "paid" as const,
            note: "Importada via Plaid",
            transactionId: id,
          };
          const nextData = { ...fd, expenses: [...fd.expenses, newExpense] };
          await supabase
            .from("finance_data")
            .upsert([{ user_id: user.id, data: nextData }], { onConflict: "user_id" });
        }
      }
    } catch (e) {
      console.error("Falha ao descontar saldo da categoria", e);
    }

    const { error: budgetErr } = await supabase.functions.invoke("update-budget", {
      body: { transaction_id: id, category },
    });
    if (budgetErr) {
      toast.error("Categorizada, mas falha ao atualizar orçamento");
    } else {
      toast.success("Categorizada! Saldo atualizado.");
    }
    await loadPending();
  };

  const handleCategoryClick = (id: string, catId: string) => {
    const subs = subcatsByCat[catId] || [];
    if (subs.length === 0) {
      categorize(id, catId);
    } else {
      setChosenCat((c) => ({ ...c, [id]: catId }));
    }
  };

  const editCategorized = async (tx: CategorizedTx) => {
    if (!user) return;
    // Remove category from DB and matching expense from finance_data
    const { error } = await supabase
      .from("transactions")
      .update({ category: null })
      .eq("id", tx.id);
    if (error) {
      toast.error("Erro ao editar categoria");
      return;
    }

    try {
      const { data: row } = await supabase
        .from("finance_data")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      const fd: any = row?.data || null;
      if (fd && Array.isArray(fd.expenses)) {
        const amount = Math.abs(Number(tx.amount ?? 0));
        const idx = fd.expenses.findIndex(
          (e: any) =>
            e.transactionId === tx.id ||
            (e.name === (tx.name || "Transação bancária") &&
              Math.abs(Number(e.amount)) === amount &&
              e.date === tx.date &&
              e.categoryId === tx.category)
        );
        if (idx >= 0) {
          const nextExpenses = [...fd.expenses];
          nextExpenses.splice(idx, 1);
          await supabase
            .from("finance_data")
            .upsert([{ user_id: user.id, data: { ...fd, expenses: nextExpenses } }], {
              onConflict: "user_id",
            });
        }
      }
    } catch (e) {
      console.error("Falha ao remover expense", e);
    }

    toast.success("Escolha a nova categoria");
    await loadPending();
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
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A conexão com banco será liberada automaticamente no seu 7º dia de uso do FinFlow.
        </div>
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
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">Data:</label>
                    <Input
                      type="date"
                      min={monthBounds().first}
                      max={monthBounds().last}
                      value={dates[t.id] || ""}
                      onChange={(e) =>
                        setDates((d) => ({ ...d, [t.id]: clampToCurrentMonth(e.target.value) }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {CATS.map((c) => (
                      <Button
                        key={c.id}
                        size="sm"
                        variant={chosenCat[t.id] === c.id ? "default" : "secondary"}
                        className="text-xs"
                        onClick={() => handleCategoryClick(t.id, c.id)}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>
                  {chosenCat[t.id] && (subcatsByCat[chosenCat[t.id]] || []).length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <p className="text-xs text-muted-foreground">Subcategoria:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(subcatsByCat[chosenCat[t.id]] || []).map((s) => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => categorize(t.id, chosenCat[t.id], s.id)}
                          >
                            {s.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {categorized.length > 0 && (
          <div className="finance-card">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Transações Categorizadas
            </h2>
            <div className="space-y-2">
              {categorized.map((t) => (
                <div key={t.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {catLabel(t.category)} · {t.date || ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-heading shrink-0">{formatCurrency(t.amount)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => editCategorized(t)}
                    aria-label="Editar categoria"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BankConnect;
