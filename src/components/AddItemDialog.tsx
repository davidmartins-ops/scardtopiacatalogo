import { useState, useRef } from "react";
import { Plus, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadProductImage } from "@/lib/storage";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const DESCRIPTIONS = ["Foil", "Non-Foil", "Surge Foil", "Rainbow Foil", "Holo Foil", "Galaxy Foil", "Confetti Foil", "Etched Foil"] as const;
const LANGUAGES = [
  { value: "PT", label: "Português" },
  { value: "EN", label: "English" },
  { value: "JP", label: "日本語" },
];
const CONDITIONS = [
  { value: "NM", label: "NM - Near Mint" },
  { value: "SP", label: "SP - Slightly Played" },
  { value: "MP", label: "MP - Moderately Played" },
  { value: "HP", label: "HP - Heavily Played" },
  { value: "D", label: "D - Damaged" },
];

const AddItemDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: "", name: "", description: "Foil" as string, price: "", price_pix: "", quantity: "1", category: "",
    language: "PT", condition: "NM", status: "none" as string, drop_description: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB."); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const resetForm = () => {
    setForm({ id: "", name: "", description: "Foil", price: "", price_pix: "", quantity: "1", category: "", language: "PT", condition: "NM", status: "none", drop_description: "" });
    clearImage();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.price.trim() || !form.category.trim()) {
      toast.error("Preencha os campos obrigatórios (ID, Nome, Preço e Categoria).");
      return;
    }
    const price = parseFloat(form.price);
    const quantity = parseInt(form.quantity, 10);
    if (isNaN(price) || price < 0) { toast.error("Preço inválido."); return; }
    if (isNaN(quantity) || quantity < 0) { toast.error("Quantidade inválida."); return; }

    setLoading(true);

    let image_url: string | null = null;
    if (imageFile) {
      try {
        image_url = await uploadProductImage(imageFile);
      } catch {
        toast.error("Erro ao enviar imagem.");
        setLoading(false);
        return;
      }
    }

    const pricePix = parseFloat(form.price_pix || "0");

    const { error } = await supabase.from("inventory").insert({
      id: form.id.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description,
      price, price_pix: pricePix, quantity,
      category: form.category,
      image_url,
      language: form.language,
      condition: form.condition,
      status: form.status,
      drop_description: form.drop_description,
    } as any);

    setLoading(false);

    if (error) {
      if (error.code === "23505") toast.error("Já existe um item com este ID.");
      else toast.error("Erro ao adicionar item.");
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
          <span className="hidden sm:inline">Novo Item</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">Adicionar Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 font-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">ID *</Label>
              <Input id="id" placeholder="SLDXX01" value={form.id} onChange={(e) => handleChange("id", e.target.value)} maxLength={20} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" placeholder="Ex: D&D, Fallout..." value={form.category} onChange={(e) => handleChange("category", e.target.value)} maxLength={50} className="bg-muted border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Secret Lair x ..." value={form.name} onChange={(e) => handleChange("name", e.target.value)} maxLength={200} className="bg-muted border-border" />
          </div>

          {/* Drop Description */}
          <div className="space-y-2">
            <Label htmlFor="drop_description">Descrição do Drop</Label>
            <Textarea
              id="drop_description"
              placeholder="Descrição detalhada do produto (exibida na página do drop)..."
              value={form.drop_description}
              onChange={(e) => handleChange("drop_description", e.target.value)}
              className="bg-muted border-border min-h-[80px] resize-y"
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.description} onValueChange={(v) => handleChange("description", v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESCRIPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={form.language} onValueChange={(v) => handleChange("language", v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qualidade</Label>
              <Select value={form.condition} onValueChange={(v) => handleChange("condition", v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status do Produto</Label>
            <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="pre_sale">Pré Venda</SelectItem>
                <SelectItem value="launch">Lançamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>Imagem do Produto</Label>
            {imagePreview ? (
              <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border bg-muted/20">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={clearImage} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive/80 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">Clique para selecionar (max 5MB)</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price">Cartão (R$) *</Label>
              <Input id="price" type="number" min="0" step="0.01" placeholder="0,00" value={form.price} onChange={(e) => handleChange("price", e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_pix">PIX (R$)</Label>
              <Input id="price_pix" type="number" min="0" step="0.01" placeholder="0,00" value={form.price_pix} onChange={(e) => handleChange("price_pix", e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input id="quantity" type="number" min="0" step="1" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)} className="bg-muted border-border" />
            </div>
          </div>

          {/* Installment info */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
            <p className="text-xs font-semibold text-primary">💳 Parcelamos em até 3x sem juros no cartão!</p>
            <p className="text-[10px] text-muted-foreground italic">* Parcelamento sem juros apenas para valores não promocionais.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Adicionar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
