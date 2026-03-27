import { useState, useMemo, useRef } from "react";
import { Search, ArrowUpDown, Filter, Pencil, Trash2, Check, X, Percent, ImagePlus, Image as ImageIcon, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadProductImage, deleteProductImage } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type InventoryItem } from "@/data/inventory";

const descriptionStyles: Record<string, string> = {
  "Foil": "bg-foil/15 text-foil border-foil/30",
  "Non-Foil": "bg-non-foil/15 text-non-foil border-non-foil/30",
  "Rainbow Foil": "bg-rainbow/15 text-rainbow border-rainbow/30",
};

interface Props { data: InventoryItem[]; }
type SortKey = "id" | "name" | "price" | "quantity";

const InventoryTable = ({ data }: Props) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", quantity: "", category: "", discount: "" });
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [discountEditId, setDiscountEditId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");

  const [imageDialogItem, setImageDialogItem] = useState<InventoryItem | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const categories = useMemo(() => [...new Set(data.map((i) => i.category))].sort(), [data]);

  const filtered = useMemo(() => {
    let items = data.filter(
      (item) =>
        (filterType === "all" || item.description === filterType) &&
        (filterCategory === "all" || item.category === filterCategory) &&
        (item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.id.toLowerCase().includes(search.toLowerCase()))
    );
    items.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return items;
  }, [data, search, sortKey, sortAsc, filterType, filterCategory]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name, price: String(item.price), quantity: String(item.quantity),
      category: item.category, discount: String(item.discount ?? 0),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const price = parseFloat(editForm.price);
    const quantity = parseInt(editForm.quantity, 10);
    const discount = parseFloat(editForm.discount || "0");
    if (!editForm.name.trim() || isNaN(price) || price < 0 || isNaN(quantity) || quantity < 0 || isNaN(discount) || discount < 0 || discount > 100) {
      toast.error("Valores inválidos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("inventory")
      .update({ name: editForm.name.trim(), price, quantity, category: editForm.category.trim(), discount })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Item atualizado!");
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setEditingId(null);
  };

  const saveDiscount = async (id: string) => {
    const discount = parseFloat(discountValue || "0");
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error("Desconto deve ser entre 0% e 100%.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("inventory").update({ discount }).eq("id", id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar desconto."); return; }
    toast.success(`Desconto de ${discount}% aplicado!`);
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setDiscountEditId(null);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    if (deleteItem.image_url) await deleteProductImage(deleteItem.image_url);
    const { error } = await supabase.from("inventory").delete().eq("id", deleteItem.id);
    setSaving(false);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Item excluído!");
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setDeleteItem(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageDialogItem) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }

    setUploadingImage(true);
    try {
      if (imageDialogItem.image_url) await deleteProductImage(imageDialogItem.image_url);
      const url = await uploadProductImage(file);
      const { error } = await supabase.from("inventory").update({ image_url: url }).eq("id", imageDialogItem.id);
      if (error) throw error;
      toast.success("Imagem atualizada!");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setImageDialogItem({ ...imageDialogItem, image_url: url });
    } catch {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleImageRemove = async () => {
    if (!imageDialogItem?.image_url) return;
    setUploadingImage(true);
    try {
      await deleteProductImage(imageDialogItem.image_url);
      const { error } = await supabase.from("inventory").update({ image_url: null }).eq("id", imageDialogItem.id);
      if (error) throw error;
      toast.success("Imagem removida!");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setImageDialogItem({ ...imageDialogItem, image_url: null });
    } catch {
      toast.error("Erro ao remover imagem.");
    } finally {
      setUploadingImage(false);
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-3 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => handleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-primary" : ""}`} /></span>
    </th>
  );

  const typeFilters = ["all", "Foil", "Non-Foil", "Rainbow Foil"];

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-border font-body" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {typeFilters.map((f) => (
                <button key={f} onClick={() => setFilterType(f)} className={`px-3 py-1 rounded-full text-xs font-body font-medium transition-all ${filterType === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? "Todos" : f}
                </button>
              ))}
            </div>
          </div>
          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <button onClick={() => setFilterCategory("all")} className={`px-3 py-1 rounded-full text-xs font-body font-medium transition-all ${filterCategory === "all" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              Todas Categorias
            </button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)} className={`px-3 py-1 rounded-full text-xs font-body font-medium transition-all ${filterCategory === cat ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead className="bg-muted/50">
              <tr>
                <SortHeader label="ID" k="id" />
                <th className="px-3 py-3 text-center text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Img</th>
                <SortHeader label="Nome" k="name" />
                <th className="px-3 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="px-3 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Categoria</th>
                <SortHeader label="Preço" k="price" />
                <th className="px-3 py-3 text-center text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Desc.</th>
                <SortHeader label="Qtd" k="quantity" />
                <th className="px-3 py-3 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Valor Final</th>
                <th className="px-3 py-3 text-center text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => {
                const discount = item.discount ?? 0;
                const finalPrice = item.price * (1 - discount / 100);
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-primary text-xs">{item.id}</td>
                    <td className="px-3 py-2.5 text-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-8 w-8 rounded object-cover mx-auto border border-border/40" />
                      ) : (
                        <span className="text-muted-foreground/40"><ImageIcon className="h-4 w-4 mx-auto" /></span>
                      )}
                    </td>

                    {editingId === item.id ? (
                      <>
                        <td className="px-3 py-2">
                          <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="h-8 text-sm bg-muted border-border" />
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-xs ${descriptionStyles[item.description]}`}>{item.description}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Input value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} className="h-8 text-sm bg-muted border-border w-28" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))} className="h-8 text-sm bg-muted border-border w-24" />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-center">
                            <Input type="number" min="0" max="100" step="1" value={editForm.discount} onChange={(e) => setEditForm((p) => ({ ...p, discount: e.target.value }))} className="h-8 text-sm bg-muted border-border w-14 text-center" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="1" value={editForm.quantity} onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))} className="h-8 text-sm bg-muted border-border w-16" />
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-primary">
                          R$ {(parseFloat(editForm.price || "0") * (1 - parseFloat(editForm.discount || "0") / 100) * parseInt(editForm.quantity || "0", 10)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-success hover:text-success hover:bg-success/10" onClick={() => saveEdit(item.id)} disabled={saving}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 max-w-xs">{item.name}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-xs ${descriptionStyles[item.description]}`}>{item.description}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.category}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {discountEditId === item.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Input type="number" min="0" max="100" step="1" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-7 text-xs bg-muted border-border w-14 text-center" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveDiscount(item.id); if (e.key === "Escape") setDiscountEditId(null); }} />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-success" onClick={() => saveDiscount(item.id)} disabled={saving}><Check className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => setDiscountEditId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <button onClick={() => { setDiscountEditId(item.id); setDiscountValue(String(discount)); }} className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-primary" title="Editar desconto">
                              {discount > 0 ? (
                                <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-xs gap-1"><Percent className="h-3 w-3" />{discount}%</Badge>
                              ) : (
                                <span className="text-muted-foreground hover:text-primary cursor-pointer"><Percent className="h-3.5 w-3.5" /></span>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-primary">
                          {discount > 0 && <span className="text-xs text-muted-foreground line-through mr-1">R$ {(item.price * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                          R$ {(finalPrice * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10" onClick={() => setImageDialogItem(item)} title="Gerenciar imagem">
                              <ImagePlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => startEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground font-body text-right">
          {filtered.length} de {data.length} itens
        </div>
      </div>

      {/* Image management dialog */}
      <Dialog open={!!imageDialogItem} onOpenChange={(open) => !open && setImageDialogItem(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground text-base">Imagem — {imageDialogItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imageDialogItem?.image_url ? (
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
                <img src={imageDialogItem.image_url} alt={imageDialogItem.name} className="w-full h-48 object-cover" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 h-48 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem imagem</p>
              </div>
            )}

            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2 font-body" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                <ImagePlus className="h-4 w-4" />
                {imageDialogItem?.image_url ? "Trocar" : "Adicionar"}
              </Button>
              {imageDialogItem?.image_url && (
                <Button variant="outline" className="gap-2 font-body text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleImageRemove} disabled={uploadingImage}>
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">Excluir item?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              <strong>{deleteItem?.name}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InventoryTable;
