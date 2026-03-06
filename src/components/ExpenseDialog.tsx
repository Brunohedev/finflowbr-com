import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  onAdd: (expense: { name: string; amount: number; categoryId: string; subcategoryId: string; date: string; note?: string }) => void;
}

const ExpenseDialog = ({ open, onOpenChange, categories, defaultCategoryId, onAdd }: ExpenseDialogProps) => {
  // Only show expense categories (not reserva/investimentos)
  const expenseCategories = categories.filter((c) => c.id !== "reserva" && c.id !== "investimentos");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");

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
    });

    setName(""); setAmount(""); setCategoryId(defaultCategoryId || ""); setSubcategoryId(""); setNote("");
    onOpenChange(false);
  };

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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
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
