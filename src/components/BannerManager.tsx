import { useState, useRef, useMemo } from "react";
import { Plus, Pencil, Trash2, Image as ImageIcon, GripVertical, Eye, EyeOff, Upload, X, Link as LinkIcon } from "lucide-react";
import { useBanners, useBannerMutations, type Banner } from "@/hooks/use-banners";
import { useInventory } from "@/hooks/use-inventory";
import { uploadProductImage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const DISPLAY_PAGES = [
  { value: "all", label: "Login + Catálogo" },
  { value: "login", label: "Apenas Login" },
  { value: "catalogo", label: "Apenas Catálogo" },
];

const BannerManager = () => {
  const { data: banners = [], isLoading } = useBanners();
  const { data: inventory = [] } = useInventory();
  const { addBanner, updateBanner, deleteBanner } = useBannerMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inventoryOptions = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name)),
    [inventory]
  );

  const [form, setForm] = useState({ alt: "", label: "", title: "", subtitle: "", sort_order: "0", display_page: "all" as "all" | "login" | "catalogo", inventory_item_id: "none" });

  const openNew = () => {
    setEditingBanner(null);
    setForm({ alt: "", label: "🔥 Lançamento", title: "", subtitle: "", sort_order: String(banners.length), display_page: "all", inventory_item_id: "none" });
    setImagePreview(null);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditingBanner(b);
    setForm({ alt: b.alt, label: b.label, title: b.title, subtitle: b.subtitle, sort_order: String(b.sort_order), display_page: b.display_page ?? "all", inventory_item_id: b.inventory_item_id ?? "none" });
    setImagePreview(b.image_url);
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório."); return; }
    if (!imagePreview && !editingBanner?.image_url) { toast.error("Imagem é obrigatória."); return; }

    setUploading(true);
    try {
      let image_url = editingBanner?.image_url ?? "";
      if (imageFile) {
        image_url = await uploadProductImage(imageFile);
      }

      const payload = {
        image_url,
        alt: form.alt || form.title,
        label: form.label,
        title: form.title,
        subtitle: form.subtitle,
        sort_order: parseInt(form.sort_order) || 0,
        is_active: true,
        display_page: form.display_page,
        inventory_item_id: form.inventory_item_id === "none" ? null : form.inventory_item_id,
      };

      if (editingBanner) {
        await updateBanner.mutateAsync({ id: editingBanner.id, ...payload });
        toast.success("Banner atualizado!");
      } else {
        await addBanner.mutateAsync(payload as any);
        toast.success("Banner adicionado!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar banner.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBanner.mutateAsync(deleteId);
      toast.success("Banner removido!");
    } catch {
      toast.error("Erro ao remover banner.");
    }
    setDeleteId(null);
  };

  const toggleActive = async (b: Banner) => {
    await updateBanner.mutateAsync({ id: b.id, is_active: !b.is_active });
    toast.success(b.is_active ? "Banner desativado." : "Banner ativado.");
  };

  const pageLabel = (dp: string) => DISPLAY_PAGES.find((p) => p.value === dp)?.label ?? dp;

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" /> Gerenciar Banners
        </h3>
        <Button size="sm" className="gap-1 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Novo Banner
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : banners.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum banner cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              {b.image_url ? (
                <img src={b.image_url} alt={b.alt} className="h-12 w-20 rounded object-cover border border-border/40 shrink-0" />
              ) : (
                <div className="h-12 w-20 rounded bg-muted/30 border border-border/40 shrink-0 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{b.subtitle}</p>
              </div>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {pageLabel(b.display_page)}
              </Badge>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${b.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                {b.is_active ? "Ativo" : "Inativo"}
              </Badge>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(b)} title={b.is_active ? "Desativar" : "Ativar"}>
                  {b.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(b.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Imagem *</Label>
              {imagePreview ? (
                <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border bg-muted/20">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive/80 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Clique para selecionar (max 5MB)</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Secret Lair x Dandân" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input value={form.subtitle} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Descrição curta" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Exibir em</Label>
              <Select value={form.display_page} onValueChange={(v) => setForm((p) => ({ ...p, display_page: v as "all" | "login" | "catalogo" }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPLAY_PAGES.map((dp) => (
                    <SelectItem key={dp.value} value={dp.value}>{dp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /> Vincular a um produto (clicável)</Label>
              <Select value={form.inventory_item_id} onValueChange={(v) => setForm((p) => ({ ...p, inventory_item_id: v }))}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Nenhum (banner estático)" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="none">Nenhum (banner estático)</SelectItem>
                  {inventoryOptions.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      [{(it.product_type ?? "drop") === "single" ? "Single" : "Drop"}] {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Se vinculado, ao clicar no banner o usuário vai direto para a página do produto.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="🔥 Lançamento" className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} className="bg-muted border-border" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={uploading}>{uploading ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Remover banner?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BannerManager;
