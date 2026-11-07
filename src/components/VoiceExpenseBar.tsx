import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Expense } from "@/types/finance";
import { audioFile, recordingError, startVoiceRecording, type VoiceRecording } from "@/lib/voiceRecording";

interface Props {
  categories: Category[];
  onAddExpense: (e: Omit<Expense, "id"> & { installments?: number }) => void;
}

type Draft = { description: string; merchant: string; amount: string; date: string };

export default function VoiceExpenseBar({ categories, onAddExpense }: Props) {
  const [state, setState] = useState<"idle" | "starting" | "recording" | "processing">("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<{ categoryId: string; subcategoryId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [installments, setInstallments] = useState("2");
  const { t } = useLanguage();
  const recRef = useRef<VoiceRecording | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const rec = recRef.current;
      recRef.current = null;
      void rec?.stop().catch(() => undefined);
    };
  }, []);

  const spendCats = categories.filter((c) => c.id !== "reserva_investimentos" && c.subcategories.length > 0);

  const start = async () => {
    if (busy.current || recRef.current) return;
    busy.current = true;
    setState("starting");
    try {
      const rec = await startVoiceRecording((error) => {
        recRef.current = null;
        busy.current = false;
        if (mounted.current) { toast.error(recordingError(error)); setState("idle"); }
      });
      if (!mounted.current) { await rec.stop().catch(() => undefined); return; }
      recRef.current = rec;
      setState("recording");
    } catch (error) {
      if (mounted.current) { toast.error(recordingError(error)); setState("idle"); }
    } finally {
      busy.current = false;
    }
  };

  const stop = async (cancel = false) => {
    const rec = recRef.current;
    if (!rec || busy.current) return;
    recRef.current = null;
    busy.current = true;
    setState("processing");
    try {
      const blob = await rec.stop();
      if (!cancel && mounted.current) await process(blob);
    } catch (error) {
      if (!cancel && mounted.current) toast.error(recordingError(error));
    } finally {
      busy.current = false;
      if (mounted.current) setState("idle");
    }
  };

  const process = async (blob: Blob) => {
    setState("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const fd = new FormData();
      fd.append("file", audioFile(blob));
      fd.append("today", format(new Date(), "yyyy-MM-dd"));
      const res = await fetch("https://symkogknbjhdesgmvtvc.supabase.co/functions/v1/voice-expense", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not process the audio.");
      setDraft({
        description: body.description ?? body.merchant ?? "",
        merchant: body.merchant ?? "",
        amount: body.amount != null ? String(body.amount) : "",
        date: body.date ?? format(new Date(), "yyyy-MM-dd"),
      });
      setPick(null);
      setHasInstallments(false);
      setInstallments("2");
    } catch (e: any) {
      toast.error(e?.message || "Could not process the audio.");
    } finally {
      setState("idle");
    }
  };

  const amountNum = Number(draft?.amount?.replace(",", "."));
  const missing: string[] = [];
  if (draft) {
    if (!draft.description.trim()) missing.push("a description");
    if (!(amountNum > 0)) missing.push("a valid amount");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) missing.push("a valid date");
    if (!pick) missing.push("a category");
    if (hasInstallments && !(parseInt(installments) >= 2 && parseInt(installments) <= 48)) missing.push("2 to 48 installments");
  }
  const valid = !!draft && missing.length === 0;

  const confirm = () => {
    if (!valid || saving || !draft || !pick) return;
    setSaving(true);
    try {
      const name = draft.merchant.trim() ? `${draft.description.trim()} · ${draft.merchant.trim()}` : draft.description.trim();
      onAddExpense({
        name,
        amount: Math.round(amountNum * 100) / 100,
        categoryId: pick.categoryId,
        subcategoryId: pick.subcategoryId,
        date: draft.date,
        status: "paid",
        note: "Registrada por voz",
        installments: hasInstallments ? parseInt(installments) || 1 : undefined,
      });
      toast.success("Expense added");
      setDraft(null);
    } catch {
      toast.error("Could not save the expense. Please try again — your details are still here.");
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof Draft, label: string, type = "text") => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type={type} inputMode={k === "amount" ? "decimal" : undefined} value={draft?.[k] ?? ""}
        onChange={(e) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d))} />
    </label>
  );

  return (
    <>
      <div className="finance-card mb-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Record Your Expense by Voice</p>
          <p className="text-xs text-muted-foreground">
            {state === "recording" ? "Listening… tap stop when you're done."
              : state === "processing" ? "Understanding your expense…"
              : "Tell us what you bought and how much you paid. FinFlow will organize the rest."}
          </p>
        </div>
        {state === "recording" && (
          <Button size="icon" variant="ghost" onClick={() => stop(true)} aria-label="Cancel recording">
            <X className="w-5 h-5" />
          </Button>
        )}
        <Button
          size="icon"
          className={`h-12 w-12 rounded-full shrink-0 ${state === "recording" ? "bg-destructive hover:bg-destructive/90 animate-pulse" : ""}`}
          onClick={state === "recording" ? () => stop(false) : start}
          disabled={state === "processing" || state === "starting"}
          aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        >
          {state === "processing" || state === "starting" ? <Loader2 className="w-5 h-5 animate-spin" />
            : state === "recording" ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>We Identified Your Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {field("merchant", "Merchant")}
            {field("description", "Description")}
            <div className="grid grid-cols-2 gap-3">
              {field("amount", "Amount ($)")}
              {field("date", "Date", "date")}
            </div>
            <div className="space-y-3 p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t("Parcelado?")}</Label>
                <Switch checked={hasInstallments} onCheckedChange={setHasInstallments} aria-label="Installments" />
              </div>
              {hasInstallments && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="text-xs text-muted-foreground mb-1 block">{t("Número de parcelas")}</label>
                  <Input type="number" min="2" max="48" value={installments}
                    onChange={(e) => setInstallments(e.target.value)} className="h-8 text-sm" aria-label="Number of installments" />
                  {amountNum > 0 && parseInt(installments) > 1 && (
                    <p className="text-xs text-primary font-medium">
                      {parseInt(installments)}x {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountNum / parseInt(installments))}
                    </p>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm font-medium pt-1">Which category does this expense belong to?</p>
            {spendCats.map((cat) => (
              <div key={cat.id} className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{cat.icon} {cat.name}</p>
                <div className="flex flex-wrap gap-2">
                  {cat.subcategories.map((s) => {
                    const on = pick?.subcategoryId === s.id;
                    return (
                      <button key={s.id} type="button"
                        onClick={() => setPick({ categoryId: cat.id, subcategoryId: s.id })}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!valid && draft && (
              <p className="text-xs text-destructive">To confirm, add {missing.join(", ")}.</p>
            )}
            <Button className="w-full" disabled={!valid || saving} onClick={confirm}>
              {saving ? "Saving…" : "Confirm Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
