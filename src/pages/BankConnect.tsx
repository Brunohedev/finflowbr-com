import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { PluggyConnect } from "pluggy-connect-sdk";

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
  plaid_id: string | null;
};

type CategorizedTx = PendingTx & { category: string };

const CATS = [
  { id: "essenciais", label: "Essenciais" },
  { id: "desejos", label: "Desejos" },
];

const catLabel = (id: string) => CATS.find((c) => c.id === id)?.label || id;

const formatCurrency = (v: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v ?? 0);

const maskPlaidToken = (token: string | null | undefined) => {
  if (!token) return null;
  return `${token.slice(0, 18)}…${token.slice(-6)}`;
};

const PLAID_ERROR_CODES_TO_WATCH = [
  "PRODUCTS_NOT_READY",
  "INVALID_PRODUCTS",
  "OAUTH",
  "ITEM_LOGIN_REQUIRED",
  "INVALID_CREDENTIALS",
  "INVALID_REDIRECT_URI",
  "INVALID_ENVIRONMENT",
];

const sanitizePlaidPayload = (value: any): any => {
  if (Array.isArray(value)) return value.map(sanitizePlaidPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("secret")) return [key, "[redacted]"];
      if (lowerKey.includes("token")) return [key, maskPlaidToken(String(entry))];
      return [key, sanitizePlaidPayload(entry)];
    })
  );
};

const plaidDiagnostics = (err: any, metadata?: any) => {
  const errorCode = err?.error_code ?? err?.errorCode ?? null;
  const errorMessage = err?.error_message ?? err?.errorMessage ?? err?.display_message ?? null;
  return {
    institutionName: metadata?.institution?.name ?? metadata?.institution_name ?? null,
    institutionId: metadata?.institution?.institution_id ?? metadata?.institution_id ?? null,
    status: metadata?.status ?? metadata?.exit_status ?? null,
    requestId: metadata?.request_id ?? err?.request_id ?? null,
    linkSessionId: metadata?.link_session_id ?? null,
    errorType: err?.error_type ?? err?.errorType ?? null,
    errorCode,
    errorMessage,
    displayMessage: err?.display_message ?? null,
    matchedWatchedError: PLAID_ERROR_CODES_TO_WATCH.find((code) =>
      String(errorCode ?? "").includes(code) || String(errorMessage ?? "").includes(code)
    ) ?? null,
    manuallyCancelled: !err,
    automaticallyExitedByPlaid: Boolean(err),
  };
};

type StoredPlaidLinkToken = {
  linkToken: string;
  expiration?: string | null;
  createdAt: number;
};

const encodeStoredPlaidLinkToken = (linkToken: string, expiration?: string | null) =>
  JSON.stringify({ linkToken, expiration: expiration ?? null, createdAt: Date.now() } satisfies StoredPlaidLinkToken);

const readStoredPlaidLinkToken = (key: string) => {
  const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPlaidLinkToken;
    const expiresAt = parsed.expiration ? new Date(parsed.expiration).getTime() : null;
    const isExpired = expiresAt ? expiresAt <= Date.now() + 30_000 : true;
    if (!parsed.linkToken || isExpired) {
      console.warn("[Plaid] Stored link_token expired or invalid", {
        hasLinkToken: Boolean(parsed.linkToken),
        expiration: parsed.expiration ?? null,
        now: new Date().toISOString(),
      });
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      return null;
    }
    return parsed.linkToken;
  } catch {
    console.warn("[Plaid] Ignoring legacy/unknown stored link_token format to avoid expired token reuse");
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return null;
  }
};

type Subcat = { id: string; name: string };

const BankConnect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [connectingPluggy, setConnectingPluggy] = useState(false);
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
        .select("id, name, amount, date, plaid_id")
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

  const PLAID_TOKEN_STORAGE_KEY = "plaid_link_token";
  const PLAID_REDIRECT_URI = "https://finflowbr.com/banco";

  const openPlaidHandler = useCallback(
    (linkToken: string, receivedRedirectUri?: string) => {
      if (!user || !window.Plaid) return;
      console.log("[Plaid] Opening Link", {
        linkToken: maskPlaidToken(linkToken),
        linkTokenPrefix: linkToken.split("-").slice(0, 2).join("-"),
        receivedRedirectUri: receivedRedirectUri ?? null,
        frontendUrl: window.location.href,
        usingStoredOAuthToken: Boolean(receivedRedirectUri),
      });
      const handler = window.Plaid.create({
        token: linkToken,
        ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
        onEvent: (eventName: string, metadata: any) => {
          console.log("[Plaid] Link onEvent", {
            eventName,
            institutionName: metadata?.institution_name ?? metadata?.institution?.name ?? null,
            status: metadata?.status ?? null,
            requestId: metadata?.request_id ?? null,
            errorCode: metadata?.error_code ?? null,
            errorMessage: metadata?.error_message ?? null,
            metadata: sanitizePlaidPayload(metadata),
          });
        },
        onSuccess: async (public_token: string, metadata: any) => {
          console.log("[Plaid] Link onSuccess", {
            ...plaidDiagnostics(null, metadata),
            hasPublicToken: Boolean(public_token),
            publicToken: maskPlaidToken(public_token),
            publicTokenPrefix: public_token?.split("-").slice(0, 2).join("-") ?? null,
            publicTokenLength: public_token?.length ?? 0,
            metadata: sanitizePlaidPayload(metadata),
          });
          try {
            const { data: exchangeData, error: exErr } = await supabase.functions.invoke("exchange-public-token", {
              body: { public_token, user_id: user.id },
            });
            console.log("[Plaid] exchange-public-token result", {
              exchangeData: sanitizePlaidPayload(exchangeData),
              error: exErr,
              hasAccessToken: Boolean(exchangeData?.has_access_token),
              itemId: exchangeData?.item_id ?? null,
              transactionsOk: exchangeData?.transactions_ok ?? null,
              transactionsErrorCode: exchangeData?.transactions_error_code ?? null,
              transactionsErrorMessage: exchangeData?.transactions_error_message ?? null,
            });
            if (exErr) {
              console.error("[Plaid] exchange-public-token error", exErr);
              throw exErr;
            }
            toast.success("Banco conectado com sucesso!");
            sessionStorage.removeItem(PLAID_TOKEN_STORAGE_KEY);
            localStorage.removeItem(PLAID_TOKEN_STORAGE_KEY);
            await loadPending();
          } catch (e: any) {
            console.error("[Plaid] onSuccess exchange failed", e);
            toast.error(e?.message || "Erro ao trocar token");
          }
        },
        onExit: (err: any, metadata: any) => {
          const diagnostics = plaidDiagnostics(err, metadata);
          console.log("[Plaid] Link onExit", {
            ...diagnostics,
            err: sanitizePlaidPayload(err),
            metadata: sanitizePlaidPayload(metadata),
          });
          console.table({
            institution_name: diagnostics.institutionName,
            status: diagnostics.status,
            request_id: diagnostics.requestId,
            error_code: diagnostics.errorCode,
            error_message: diagnostics.errorMessage,
          });
          if (err) toast.error(err.display_message || "Conexão cancelada");
          sessionStorage.removeItem(PLAID_TOKEN_STORAGE_KEY);
          localStorage.removeItem(PLAID_TOKEN_STORAGE_KEY);
        },
      });
      handler.open();
    },
    [user, loadPending]
  );

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
      console.log("[Plaid] create-link-token result", {
        hasLinkToken: Boolean(data.link_token),
        linkToken: maskPlaidToken(data.link_token),
        linkTokenPrefix: data.link_token.split("-").slice(0, 2).join("-"),
        plaidEnv: data.plaid_env ?? null,
        countryCodes: data.country_codes ?? null,
        language: data.language ?? null,
        expiration: data.expiration ?? null,
        rawData: sanitizePlaidPayload(data),
      });
      const storedToken = encodeStoredPlaidLinkToken(data.link_token, data.expiration);
      sessionStorage.setItem(PLAID_TOKEN_STORAGE_KEY, storedToken);
      localStorage.setItem(PLAID_TOKEN_STORAGE_KEY, storedToken);
      const params = new URLSearchParams(window.location.search);
      const hasOAuth = params.get("oauth_state_id");
      openPlaidHandler(data.link_token, hasOAuth ? window.location.href : undefined);
    } catch (e: any) {
      console.error("[Plaid] create-link-token failed", e);
      toast.error(e?.message || "Erro ao iniciar Plaid");
    } finally {
      setConnecting(false);
    }
  };

  // OAuth redirect handling: re-initialize Plaid Link when returning from bank auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get("oauth_state_id");
    if (!oauthStateId) return;
    const storedToken = readStoredPlaidLinkToken(PLAID_TOKEN_STORAGE_KEY);
    if (!storedToken) return;

    const tryOpen = () => {
      if (window.Plaid) {
        openPlaidHandler(storedToken, window.location.href);
        return true;
      }
      return false;
    };
    if (tryOpen()) return;
    const interval = setInterval(() => {
      if (tryOpen()) clearInterval(interval);
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 8000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [openPlaidHandler]);


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
            note: tx?.plaid_id?.startsWith("pluggy_") ? "Importada via Pluggy" : "Importada via Plaid",
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

  const startPluggy = async () => {
    if (!user) return;
    setConnectingPluggy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-create-token");
      if (error || !data?.accessToken) throw new Error(error?.message || "Falha ao gerar token Pluggy");

      const pluggy = new PluggyConnect({
        connectToken: data.accessToken,
        includeSandbox: true,
        onSuccess: async (itemData: any) => {
          try {
            const itemId = itemData?.item?.id || itemData?.itemId;
            if (!itemId) throw new Error("itemId não retornado pelo Pluggy");
            const { error: insErr } = await supabase
              .from("pluggy_connections")
              .upsert([{ user_id: user.id, item_id: itemId }], { onConflict: "user_id" });
            if (insErr) throw insErr;

            toast.success("Banco brasileiro conectado! Importando transações…");
            const { error: txErr } = await supabase.functions.invoke("pluggy-get-transactions", {
              body: { user_id: user.id, item_id: itemId },
            });
            if (txErr) throw txErr;
            toast.success("Transações importadas!");
            await loadPending();
          } catch (e: any) {
            toast.error(e?.message || "Erro ao importar transações");
          }
        },
        onError: (err: any) => {
          toast.error(err?.message || "Erro na conexão Pluggy");
        },
      });
      pluggy.init();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar Pluggy");
    } finally {
      setConnectingPluggy(false);
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
              <p className="font-semibold">🇺🇸 Conecte sua conta bancária</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">Importe transações automaticamente via Plaid{"\n"}Uso exclusivo de usuarios presentes nos Estados Unidos.</p>
            </div>
          </div>
          <Button onClick={startPlaid} disabled={connecting} className="w-full">
            {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando…</> : "Conectar banco"}
          </Button>
        </div>

        <div className="finance-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">🇧🇷 Conectar banco brasileiro</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">Importe transações dos seus bancos no Brasil via Pluggy.{"\n"}Uso exclusivo de usuarios presentes no Brasil.</p>
            </div>
          </div>
          <Button onClick={startPluggy} disabled={connectingPluggy} className="w-full">
            {connectingPluggy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando…</> : "Conectar banco\n"}
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
