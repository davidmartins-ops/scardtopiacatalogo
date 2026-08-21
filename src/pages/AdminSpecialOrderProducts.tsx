import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Package, Pencil, Plus, Search } from "lucide-react";
import logo from "@/assets/logo.png";

type ProductRow = Database["public"]["Tables"]["special_order_products"]["Row"];

const emptyForm = {
  id: "",
  name: "",
  description: "",
  category: "Action Figure",
  price: "",
  price_pix: "",
  image_url: "",
  is_active: true,
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const AdminSpecialOrderProducts = () => {
  useSEO({ title: "Produtos de encomenda | Admin", noindex: true });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || "Outros",
        price: Number(form.price) || 0,
        price_pix: Number(form.price_pix) || 0,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
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
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar produto."),
  });

  const toggleActive = useMutation({
    mutationFn: async (product: ProductRow) => {
      const { error } = await supabase
        .from("special_order_products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-order-products"] });
      qc.invalidateQueries({ queryKey: ["special-order-products"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar status."),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.category ?? "").toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term),
    );
  }, [products, search]);

  const openEdit = (product: ProductRow) => {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      price: String(product.price ?? ""),
      price_pix: String(product.price_pix ?? ""),
      image_url: product.image_url ?? "",
      is_active: product.is_active,
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
              Action figures e colecionáveis exibidos na página de encomendas (independente do estoque).
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

        <div className="glass-card p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, categoria ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar produto de encomenda"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">Nenhum produto de encomenda cadastrado.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product) => (
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
                        product.is_active
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {product.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                  <p className="text-sm font-bold text-foreground mt-1">{formatBRL(Number(product.price))}</p>
                  {Number(product.price_pix) > 0 && (
                    <p className="text-xs text-success">{formatBRL(Number(product.price_pix))} no PIX</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(product)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(product)}
                    >
                      {product.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {form.id ? "Editar produto de encomenda" : "Novo produto de encomenda"}
            </DialogTitle>
            <DialogDescription>
              Estes produtos aparecem apenas na página de encomendas, sem afetar o estoque.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="sop-name">Nome</Label>
              <Input id="sop-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sop-category">Categoria</Label>
              <Input
                id="sop-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Action Figure, Carta, Colecionável..."
              />
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
              <Label htmlFor="sop-image">URL da imagem</Label>
              <Input
                id="sop-image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
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
            <div className="flex items-center justify-between">
              <Label htmlFor="sop-active">Visível na página de encomendas</Label>
              <Switch
                id="sop-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
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
    </div>
  );
};

export default AdminSpecialOrderProducts;
