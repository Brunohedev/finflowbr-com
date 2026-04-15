import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Category } from "@/types/finance";
import { format } from "date-fns";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  defaultCategoryId?: string;
  activeMonth?: string;
  onAdd: (expense: {
    name: string;
    amount: number;
    categoryId: string;
    subcategoryId: string;
    date: string;
    note?: string;
    status: "paid" | "pending";
    installments?: number;
    isRecurring?: boolean;
  }) => void;
}

const ExpenseDialog = ({ open, onOpenChange, categories, defaultCategoryId, activeMonth, onAdd }: ExpenseDialogProps) => {
  const expenseCategories = categories.filter((c) => c.id !== "reserva_investimentos");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const [subcategoryId, setSubcategoryId] = useState("");
  const getDefaultDate = () => {
    const currentMonth = format(new Date(), "yyyy-MM");
    if (activeMonth && activeMonth !== currentMonth) {
      return `${activeMonth}-01`;
    }
    return format(new Date(), "yyyy-MM-dd");
  };
  const [date, setDate] = useState(getDefaultDate);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"paid" | "pending">("pending");
  const [hasInstallments, setHasInstallments] = useState(false);
  const [installments, setInstallments] = useState("2");

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);

  const handleSubmit = () => {
    const amountValue = parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!name.trim() || !amountValue || !categoryId || !subcategoryId) return;

    onAdd({
      name: name.trim(),
      amount: amountValue,
      categoryId,
      subcategoryId,
      date,
      note: note.trim() || undefined,
      status,
      installments: hasInstallments ? parseInt(installments) || 1 : undefined,
    });

    setName(""); setAmount(""); setCategoryId(defaultCategoryId || ""); setSubcategoryId("");
    setNote(""); setStatus("pending"); setHasInstallments(false); setInstallments("2");
    onOpenChange(false);
  };

  const totalAmount = parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const installmentCount = parseInt(installments) || 1;
  const installmentValue = hasInstallments && installmentCount > 1 ? totalAmount / installmentCount : totalAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Nova Despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
            <Input placeholder="Ex: Supermercado" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Total</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subcategoria</label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!selectedCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {selectedCategory?.subcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installments toggle */}
          <div className="space-y-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Parcelado?</Label>
              <Switch checked={hasInstallments} onCheckedChange={setHasInstallments} />
            </div>
            {hasInstallments && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Número de parcelas</label>
                  <Input
                    type="number" min="2" max="48" value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {totalAmount > 0 && installmentCount > 1 && (
                  <p className="text-xs text-primary font-medium">
                    {installmentCount}x de {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(installmentValue)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <Label className="text-xs font-medium">Status</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("pending")}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  status === "pending"
                    ? "bg-warning/15 text-warning border-warning/30 font-medium"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                Pendente
              </button>
              <button
                onClick={() => setStatus("paid")}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  status === "paid"
                    ? "bg-primary/15 text-primary border-primary/30 font-medium"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                Pago
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nota (opcional)</label>
            <Textarea placeholder="Observação..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <Button className="w-full font-semibold" onClick={handleSubmit}>
            Adicionar Despesa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseDialog;
