import useSEO from "@/hooks/use-seo";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useSpecialOrders } from "@/hooks/use-special-orders";
import { useSpecialOrderProduct } from "@/hooks/use-special-order-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const CATEGORIES = [
  { value: "action_figure", label: "Action Figure / Boneco" },
  { value: "card", label: "Carta / Single" },
  { value: "sealed", label: "Produto Lacrado" },
  { value: "accessory", label: "Acessório" },
  { value: "other", label: "Outro" },
];

const SpecialOrderRequest = () => {
  useSEO({ title: "Solicitar encomenda", canonical: "https://www.spencerscardtopia.com.br/conta/encomendas/nova", noindex: true });
  const navigate = useNavigate();
  const { user, loading } = useCustomerAuth();
  const { createOrder } = useSpecialOrders();

  const [searchParams] = useSearchParams();
  const productParam = searchParams.get("produto") ?? undefined;
  const variantParam = searchParams.get("variacao") ?? undefined;
  const { data: productData } = useSpecialOrderProduct(productParam);

  const [items, setItems] = useState([{ name: "", description: "", category: "card", quantity: 1, referenceLink: "" }]);
  const [notes, setNotes] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !productData?.product) return;
    const variant = productData.variants.find((v) => v.id === variantParam) ?? null;
    setItems([
      {
        name: `${productData.product.name}${variant ? ` — ${variant.label}` : ""}`,
        description: variant?.sku ? `SKU: ${variant.sku}` : productData.product.description ?? "",
        category: productData.product.category?.toLowerCase().includes("carta") ? "card" : "action_figure",
        quantity: 1,
        referenceLink: "",
      },
    ]);
    setPrefilled(true);
  }, [productData, variantParam, prefilled]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    navigate("/conta/login");
    return null;
  }

  const addItem = () => setItems([...items, { name: "", description: "", category: "card", quantity: 1, referenceLink: "" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof typeof items[0], value: string | number) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.name.trim())) {
      toast.error("Preencha o nome de todos os itens.");
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        source: productData?.product ? "catalog_fixed" : "customer_request",
        items: items.map((it, idx) => ({
          item_type: idx === 0 && productData?.product ? "fixed_price" : "quotation",
          product_id: idx === 0 && productData?.product ? productData.product.id : undefined,
          variant_id: idx === 0 && productData?.product && variantParam ? variantParam : undefined,
          name: it.name.trim(),
          description: it.description.trim(),
          quantity: Number(it.quantity),
          reference_links: it.referenceLink ? [it.referenceLink] : undefined,
        })),
        notes: notes.trim(),
      });
      toast.success("Encomenda solicitada!");
      navigate(`/conta/encomendas/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar encomenda.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta" className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Minha conta
          </Link>
          <Link to="/"><img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" /></Link>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: '0.05em' }}>
          <span className="text-gradient">Solicitar Encomenda</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Descreva o produto desejado. Nossa equipe avaliará disponibilidade, preço e prazo antes de confirmar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {items.map((item, idx) => (
            <div key={idx} className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">Item {idx + 1}</h3>
                {items.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label>Nome do produto</Label>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(idx, "name", e.target.value)}
                  placeholder="Ex: Funko Pop! Chandra Nalaar"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={item.category} onValueChange={(v) => updateItem(idx, "category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div>
                <Label>Descrição / detalhes</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Edição, idioma, condição, tamanho, cor, link da loja de referência..."
                />
              </div>
              <div>
                <Label>Link de referência (opcional)</Label>
                <Input
                  type="url"
                  value={item.referenceLink}
                  onChange={(e) => updateItem(idx, "referenceLink", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" className="gap-1 w-full" onClick={addItem}>
            <Plus className="h-4 w-4" /> Adicionar outro item
          </Button>

          <div className="glass-card p-4">
            <Label>Observações gerais</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prazo desejado, preferência de envio, dúvidas..."
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/conta/encomendas")}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-1" disabled={createOrder.isPending}>
              {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Solicitar encomenda
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpecialOrderRequest;
