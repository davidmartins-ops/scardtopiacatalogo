import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MultiImageUpload, { type UploadedImage } from "@/components/MultiImageUpload";
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

const DESCRIPTIONS = ["Foil", "Non-Foil", "Surge Foil", "Rainbow Foil", "Holo Foil", "Galaxy Foil", "Confetti Foil", "Etched Foil", "Silver Scroll"] as const;
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
  // CORREÇÃO 30: multi-upload — primeira imagem vira image_url principal, restante vai para drop_singles_images.
  const [images, setImages] = useState<UploadedImage[]>([]);

  const [form, setForm] = useState({
    id: "", name: "", description: "Foil" as string, price: "", price_pix: "", quantity: "1", category: "",
    language: "PT", condition: "NM", status: "none" as string, availability: "pronta_entrega" as string, drop_description: "",
  });
  // CORREÇÃO 28.1: build SET-NUM-LANG-F/NF-COND automatically until the admin overrides it manually.
  // Auto-generate SET (from name) and NUM (timestamp-based) so admin doesn't need to fill them.
  const [idParts, setIdParts] = useState({ set: "", num: "" });
  const [idAutoTouched, setIdAutoTouched] = useState(false);

  const deriveSetFromName = (name: string) => {
    const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length >= 3) return clean.slice(0, 3);
    if (clean.length > 0) return (clean + "XXX").slice(0, 3);
    return "DRP";
  };

  const generateNum = () => {
    // 5-char base36 from timestamp — compact, unique per second.
    return Math.floor(Date.now() / 1000).toString(36).toUpperCase().slice(-5);
  };

  const buildAutoId = (parts: { set: string; num: string }, language: string, description: string, condition: string) => {
    const set = parts.set.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const num = parts.num.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!set || !num) return "";
    const foilTag = description === "Non-Foil" ? "NF" : "F";
    return `${set}${num}${language}${foilTag}${condition}`;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-derive set from name and generate num on first name entry
      if (field === "name" && !idAutoTouched) {
        const autoSet = deriveSetFromName(value);
        const autoNum = idParts.num || generateNum();
        const nextParts = { set: autoSet, num: autoNum };
        setIdParts(nextParts);
        const auto = buildAutoId(nextParts, next.language, next.description, next.condition);
        if (auto) next.id = auto;
      } else if (!idAutoTouched && (field === "language" || field === "description" || field === "condition")) {
        const auto = buildAutoId(idParts, next.language, next.description, next.condition);
        if (auto) next.id = auto;
      }
      return next;
    });
  };

  const handleIdManualChange = (value: string) => {
    setIdAutoTouched(true);
    setForm((prev) => ({ ...prev, id: value }));
  };


  const resetForm = () => {
    setForm({ id: "", name: "", description: "Foil", price: "", price_pix: "", quantity: "1", category: "", language: "PT", condition: "NM", status: "none", availability: "pronta_entrega", drop_description: "" });
    setIdParts({ set: "", num: "" });
    setIdAutoTouched(false);
    setImages([]);
  };

  // Preview do ID compacto que o trigger irá gravar no banco (remove qualquer não alfanumérico e uppercase).
  const compactId = form.id.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
  const isCompactValid = /^[A-Z0-9]{3,}$/.test(compactId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.price.trim() || !form.category.trim()) {
      toast.error("Preencha os campos obrigatórios (ID, Nome, Preço e Categoria).");
      return;
    }
    if (!isCompactValid) {
      toast.error("ID compacto inválido. Use apenas letras e números (mín. 3 caracteres); hífens e espaços serão removidos.");
      return;
    }
    const price = parseFloat(form.price);
    const quantity = parseInt(form.quantity, 10);
    if (isNaN(price) || price < 0) { toast.error("Preço inválido."); return; }
    if (isNaN(quantity) || quantity < 0) { toast.error("Quantidade inválida."); return; }

    setLoading(true);

    // First image (if any) becomes the main inventory.image_url; the rest go to drop_singles_images.
    const primary = images[0]?.url ?? null;
    const gallery = images.slice(1);

    const pricePix = parseFloat(form.price_pix || "0");
    const itemId = compactId;

    const { error } = await supabase.from("inventory").insert({
      id: itemId,
      name: form.name.trim(),
      description: form.description,
      price, price_pix: pricePix, quantity,
      category: form.category,
      image_url: primary,
      language: form.language,
      condition: form.condition,
      status: form.status,
      availability: form.availability,
      drop_description: form.drop_description,
    } as any);

    if (error) {
      setLoading(false);
      if (error.code === "23505") toast.error(`Já existe um item com o ID compacto "${itemId}".`);
      else if (error.code === "23514") toast.error("ID compacto fora do padrão (apenas letras maiúsculas e números).");
      else toast.error("Erro ao adicionar item.");
      return;
    }


    if (gallery.length > 0) {
      const rows = gallery.map((img, idx) => ({
        inventory_item_id: itemId,
        image_url: img.url,
        sort_order: idx,
      }));
      const { error: galleryError } = await supabase.from("drop_singles_images").insert(rows as any);
      if (galleryError) toast.warning("Item criado, mas algumas imagens da galeria falharam.");
    }

    setLoading(false);
    toast.success(`Item adicionado${images.length > 1 ? ` com ${images.length} imagens` : ""}!`);
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
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" placeholder="Ex: D&D, Fallout..." value={form.category} onChange={(e) => handleChange("category", e.target.value)} maxLength={50} className="bg-muted border-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Secret Lair x ..." value={form.name} onChange={(e) => handleChange("name", e.target.value)} maxLength={200} className="bg-muted border-border" />
          </div>

          {/* CORREÇÃO 28.1: ID is auto-built from SET + collector number + language + foil + condition.
              Set e Nº Coletor são gerados automaticamente a partir do nome e do timestamp. */}

          <div className="space-y-2">
            <Label htmlFor="id" className="flex items-center justify-between">
              <span>ID digitado *</span>
              <span className="text-[10px] text-muted-foreground">{idAutoTouched ? "Editado manualmente" : "Auto: SET+NUM+LANG+F/NF+COND"}</span>
            </Label>
            <Input id="id" placeholder="SLD-01-PT-F-NM" value={form.id} onChange={(e) => handleIdManualChange(e.target.value)} maxLength={40} className="bg-muted border-border font-mono text-xs" />
            <div className={`text-[11px] font-mono rounded-md border px-2 py-1.5 ${form.id.trim() === "" ? "text-muted-foreground border-border/60 bg-muted/40" : isCompactValid ? "text-primary border-primary/30 bg-primary/5" : "text-destructive border-destructive/40 bg-destructive/5"}`}>
              <span className="text-muted-foreground mr-2">ID compacto (será salvo):</span>
              {compactId || <span className="italic">—</span>}
              {form.id.trim() !== "" && !isCompactValid && (
                <div className="mt-1 text-[10px] not-italic">Precisa ter no mínimo 3 caracteres alfanuméricos. Hífens e espaços são removidos automaticamente.</div>
              )}
            </div>
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

          {/* Multi image upload — primeira imagem vira principal, demais formam a galeria */}
          <MultiImageUpload
            label="Imagens do Produto (1ª = principal, demais = galeria)"
            maxImages={10}
            value={images}
            onUploaded={(image) => setImages((prev) => [...prev, image])}
            onRemove={(image) => setImages((prev) => prev.filter((i) => i.id !== image.id))}
            onReorder={(reordered) => setImages(reordered)}
          />

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
