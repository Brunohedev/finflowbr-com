import { useRef, useState } from "react";
import { format } from "date-fns";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Expense } from "@/types/finance";

interface Props {
  categories: Category[];
  onAddExpense: (e: Omit<Expense, "id">) => void;
}

type Draft = { description: string; merchant: string; amount: string; date: string };

export default function VoiceExpenseBar({ categories, onAddExpense }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<{ categoryId: string; subcategoryId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);

  const spendCats = categories.filter((c) => c.id !== "reserva_investimentos" && c.subcategories.length > 0);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording isn't supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled.current) process(new Blob(chunks.current, { type: (rec.mimeType || "audio/webm").replace("video/", "audio/") }));
        else setState("idle");
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
    } catch {
      toast.error("Microphone access was denied. Allow it in your settings to record.");
    }
  };

  const stop = (cancel = false) => {
    cancelled.current = cancel;
    recRef.current?.stop();
  };

  const process = async (blob: Blob) => {
    setState("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const fd = new FormData();
      fd.append("file", new File([blob], `expense.${ext}`, { type: blob.type }));
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
    } catch (e: any) {
      toast.error(e?.message || "Could not process the audio.");
    } finally {
      setState("idle");
    }
  };

  const amountNum = Number(draft?.amount?.replace(",", "."));
  const valid = !!draft && draft.description.trim() && amountNum > 0 && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && pick;

  const confirm = () => {
    if (!valid || saving || !draft || !pick) return;
    setSaving(true);
    const name = draft.merchant.trim() ? `${draft.description.trim()} · ${draft.merchant.trim()}` : draft.description.trim();
    onAddExpense({
      name,
      amount: Math.round(amountNum * 100) / 100,
      categoryId: pick.categoryId,
      subcategoryId: pick.subcategoryId,
      date: draft.date,
      status: "paid",
      note: "Registrada por voz",
    });
    toast.success("Expense added");
    setDraft(null);
    setSaving(false);
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
          disabled={state === "processing"}
          aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        >
          {state === "processing" ? <Loader2 className="w-5 h-5 animate-spin" />
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
            <Button className="w-full" disabled={!valid || saving} onClick={confirm}>Confirm Expense</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
