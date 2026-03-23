import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const DESCRIPTIONS = ["Foil", "Non-Foil", "Rainbow Foil"] as const;
const CATEGORIES = ["D&D", "Fallout", "Avatar", "The Last of Us"] as const;

const AddItemDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "Foil" as string,
    price: "",
    quantity: "1",
    category: "D&D" as string,
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ id: "", name: "", description: "Foil", price: "", quantity: "1", category: "D&D" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.id.trim() || !form.name.trim() || !form.price.trim()) {
      toast.error("Preencha os campos obrigatórios (ID, Nome e Preço).");
      return;
    }

    const price = parseFloat(form.price);
    const quantity = parseInt(form.quantity, 10);

    if (isNaN(price) || price < 0) {
      toast.error("Preço inválido.");
      return;
    }
    if (isNaN(quantity) || quantity < 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("inventory").insert({
      id: form.id.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description,
      price,
      quantity,
      category: form.category,
    });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um item com este ID.");
      } else {
        toast.error("Erro ao adicionar item.");
      }
      return;
    }

    toast.success("Item adicionado com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-body">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">Adicionar Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 font-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">ID *</Label>
              <Input
                id="id"
                placeholder="SLDXX01"
                value={form.id}
                onChange={(e) => handleChange("id", e.target.value)}
                maxLength={20}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => handleChange("category", v)}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Secret Lair x ..."
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              maxLength={200}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Tipo</Label>
            <Select value={form.description} onValueChange={(v) => handleChange("description", v)}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESCRIPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                className="bg-muted border-border"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
