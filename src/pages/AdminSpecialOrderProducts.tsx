import useSEO from "@/hooks/use-seo";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { uploadProductImage } from "@/lib/storage";
import {
  useAdminSpecialOrderVariants,
  SPECIAL_ORDER_PRODUCT_STATUS_LABELS,
  type SpecialOrderProductStatus,
} from "@/hooks/use-special-order-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import logo from "@/assets/logo.png";

type ProductRow = Database["public"]["Tables"]["special_order_products"]["Row"];

const emptyForm = {
  id: "",
  name: "",
  description: "",
  category: "Action Figure",
  sku: "",
  price: "",
  price_pix: "",
  status: "active" as SpecialOrderProductStatus,
  images: [] as string[],
};

const emptyVariant = {
  id: "",
  label: "",
  sku: "",
  price: "",
  price_pix: "",
  image_url: "",
  is_active: true,
  sort_order: "0",
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const AdminSpecialOrderProducts = () => {
  useSEO({ title: "Produtos de encomenda | Admin", noindex: true });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SpecialOrderProductStatus>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<ProductRow | null>(null);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [variantUploading, setVariantUploading] = useState(false);
  const variantFileRef = useRef<HTMLInputElement>(null);

  const { variants, isLoading: variantsLoading, saveVariant, deleteVariant } =
    useAdminSpecialOrderVariants(variantProduct?.id);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-special-order-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_order_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      const [cover, ...rest] = form.images;
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || "Outros",
        sku: form.sku.trim() || null,
        price: Number(form.price) || 0,
        price_pix: Number(form.price_pix) || 0,
        status: form.status,
        is_active: form.status !== "inactive",
        image_url: cover ?? null,
        image_urls: rest,
      };
      if (form.id) {
        const { error } = await supabase
          .from("special_order_products")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("special_order_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto de encomenda salvo.");
      qc.invalidateQueries({ queryKey: ["admin-special-order-products"] });
      qc.invalidateQueries({ queryKey: ["special-order-products"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("sku")
          ? "Este SKU já está em uso por outro produto."
          : e.message || "Erro ao salvar produto.",
      ),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ product, status }: { product: ProductRow; status: SpecialOrderProductStatus }) => {
      const { error } = await supabase
        .from("special_order_products")
        .update({ status, is_active: status !== "inactive" })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-order-products"] });
      qc.invalidateQueries({ queryKey: ["special-order-products"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar status."),
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadProductImage(file));
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success("Imagem(ns) enviada(s).");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleVariantUpload = async (file: File | null) => {
    if (!file) return;
    setVariantUploading(true);
    try {
      const url = await uploadProductImage(file);
      setVariantForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar imagem.");
    } finally {
      setVariantUploading(false);
      if (variantFileRef.current) variantFileRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const status = (p.status ?? (p.is_active ? "active" : "inactive")) as SpecialOrderProductStatus;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term) ||
        (p.category ?? "").toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [products, search, statusFilter]);

  const openEdit = (product: ProductRow) => {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      sku: product.sku ?? "",
      price: String(product.price ?? ""),
      price_pix: String(product.price_pix ?? ""),
      status: (product.status ?? (product.is_active ? "active" : "inactive")) as SpecialOrderProductStatus,
      images: [
        ...(product.image_url ? [product.image_url] : []),
        ...((product.image_urls ?? []) as string[]),
      ],
    });
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Gerenciamento
          </Link>
          <Link to="/admin">
            <img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
            >
              <span className="text-gradient">Produtos de Encomenda</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Action figures e colecionáveis exibidos na página de encomendas (independente do estoque de cartas).
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        </div>

        <div className="glass-card p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, SKU, categoria ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar produto de encomenda"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="featured">Em destaque</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">Nenhum produto de encomenda encontrado.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product) => {
              const status = (product.status ??
                (product.is_active ? "active" : "inactive")) as SpecialOrderProductStatus;
              return (
                <div key={product.id} className="glass-card p-4 flex gap-3">
                  <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{product.name}</p>
                      <Badge
                        className={
                          status === "featured"
                            ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30 gap-1"
                            : status === "active"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {status === "featured" && <Sparkles className="h-3 w-3" />}
                        {SPECIAL_ORDER_PRODUCT_STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.category}
                      {product.sku ? ` · SKU ${product.sku}` : ""}
                    </p>
                    <p className="text-sm font-bold text-foreground mt-1">{formatBRL(Number(product.price))}</p>
                    {Number(product.price_pix) > 0 && (
                      <p className="text-xs text-success">{formatBRL(Number(product.price_pix))} no PIX</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(product)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setVariantProduct(product);
                          setVariantForm(emptyVariant);
                          setVariantsOpen(true);
                        }}
                      >
                        <Layers className="h-3.5 w-3.5" /> Variações
                      </Button>
                      <Select
                        value={status}
                        onValueChange={(v) =>
                          updateStatus.mutate({ product, status: v as SpecialOrderProductStatus })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs" aria-label="Alterar status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="featured">Em destaque</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Product dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar produto de encomenda" : "Novo produto de encomenda"}
            </DialogTitle>
            <DialogDescription>
              Estes produtos aparecem apenas na página de encomendas, sem afetar o estoque de cartas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="sop-name">Nome</Label>
              <Input id="sop-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sop-category">Categoria</Label>
                <Input
                  id="sop-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Action Figure, Carta, Colecionável..."
                />
              </div>
              <div>
                <Label htmlFor="sop-sku">SKU</Label>
                <Input
                  id="sop-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="AF-CHANDRA-01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sop-price">Preço (cartão)</Label>
                <Input
                  id="sop-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sop-price-pix">Preço PIX</Label>
                <Input
                  id="sop-price-pix"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_pix}
                  onChange={(e) => setForm({ ...form, price_pix: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Imagens</Label>
              <p className="text-xs text-muted-foreground mb-2">
                A primeira imagem é usada como capa. Envie arquivos ou cole uma URL.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.images.map((url, idx) => (
                  <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-primary/80 text-[9px] text-primary-foreground text-center">
                        Capa
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Remover imagem"
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Enviar imagens
              </Button>
              <Input
                className="mt-2"
                placeholder="Ou cole uma URL e pressione Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      setForm((prev) => ({ ...prev, images: [...prev.images, value] }));
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="sop-desc">Descrição</Label>
              <Textarea
                id="sop-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as SpecialOrderProductStatus })}
              >
                <SelectTrigger aria-label="Status do produto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (visível)</SelectItem>
                  <SelectItem value="featured">Em destaque</SelectItem>
                  <SelectItem value="inactive">Inativo (oculto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error("Informe o nome do produto.");
                  return;
                }
                saveProduct.mutate();
              }}
              disabled={saveProduct.isPending}
            >
              {saveProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variants dialog */}
      <Dialog open={variantsOpen} onOpenChange={setVariantsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Variações — {variantProduct?.name}</DialogTitle>
            <DialogDescription>
              Versões, tamanhos ou edições com SKU e preço próprios. Não afetam o estoque de cartas.
            </DialogDescription>
          </DialogHeader>

          {variantsLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              {variants.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma variação cadastrada.</p>
              )}
              {variants.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="h-12 w-12 rounded overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                    {v.image_url ? (
                      <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{v.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.sku ? `SKU ${v.sku} · ` : ""}
                      {formatBRL(Number(v.price))}
                      {Number(v.price_pix) > 0 ? ` · PIX ${formatBRL(Number(v.price_pix))}` : ""}
                    </p>
                  </div>
                  <Badge
                    className={
                      v.is_active
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground border-border"
                    }
                  >
                    {v.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setVariantForm({
                        id: v.id,
                        label: v.label,
                        sku: v.sku ?? "",
                        price: String(v.price ?? ""),
                        price_pix: String(v.price_pix ?? ""),
                        image_url: v.image_url ?? "",
                        is_active: v.is_active,
                        sort_order: String(v.sort_order ?? 0),
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={deleteVariant.isPending}
                    onClick={() => deleteVariant.mutate(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {variantForm.id ? "Editar variação" : "Nova variação"}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="var-label">Variação (ex: versão/tamanho)</Label>
                <Input
                  id="var-label"
                  value={variantForm.label}
                  onChange={(e) => setVariantForm({ ...variantForm, label: e.target.value })}
                  placeholder="Deluxe 30cm"
                />
              </div>
              <div>
                <Label htmlFor="var-sku">SKU</Label>
                <Input
                  id="var-sku"
                  value={variantForm.sku}
                  onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="var-price">Preço (cartão)</Label>
                <Input
                  id="var-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={variantForm.price}
                  onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="var-price-pix">Preço PIX</Label>
                <Input
                  id="var-price-pix"
                  type="number"
                  step="0.01"
                  min="0"
                  value={variantForm.price_pix}
                  onChange={(e) => setVariantForm({ ...variantForm, price_pix: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="var-order">Ordem</Label>
                <Input
                  id="var-order"
                  type="number"
                  value={variantForm.sort_order}
                  onChange={(e) => setVariantForm({ ...variantForm, sort_order: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={variantForm.is_active ? "active" : "inactive"}
                  onValueChange={(v) => setVariantForm({ ...variantForm, is_active: v === "active" })}
                >
                  <SelectTrigger aria-label="Status da variação">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
                {variantForm.image_url ? (
                  <img src={variantForm.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <input
                ref={variantFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleVariantUpload(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={variantUploading}
                onClick={() => variantFileRef.current?.click()}
              >
                {variantUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Imagem da variação
              </Button>
              {variantForm.image_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVariantForm({ ...variantForm, image_url: "" })}
                >
                  Remover
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {variantForm.id && (
                <Button variant="outline" onClick={() => setVariantForm(emptyVariant)}>
                  Cancelar edição
                </Button>
              )}
              <Button
                className="gap-2"
                disabled={saveVariant.isPending}
                onClick={() => {
                  if (!variantProduct) return;
                  if (!variantForm.label.trim()) {
                    toast.error("Informe o nome da variação.");
                    return;
                  }
                  saveVariant.mutate(
                    {
                      id: variantForm.id || undefined,
                      product_id: variantProduct.id,
                      label: variantForm.label.trim(),
                      sku: variantForm.sku.trim() || null,
                      price: Number(variantForm.price) || 0,
                      price_pix: Number(variantForm.price_pix) || 0,
                      image_url: variantForm.image_url.trim() || null,
                      is_active: variantForm.is_active,
                      sort_order: Number(variantForm.sort_order) || 0,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Variação salva.");
                        setVariantForm(emptyVariant);
                      },
                      onError: (e: Error) =>
                        toast.error(
                          e.message.includes("sku")
                            ? "Este SKU já está em uso."
                            : e.message || "Erro ao salvar variação.",
                        ),
                    },
                  );
                }}
              >
                {saveVariant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {variantForm.id ? "Salvar variação" : "Adicionar variação"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSpecialOrderProducts;
