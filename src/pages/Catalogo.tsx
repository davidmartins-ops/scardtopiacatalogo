import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Circle, Rainbow, Filter, Package, MessageCircle, Instagram, ShoppingCart as CartIconLucide, Plus } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";
import { useInventory } from "@/hooks/use-inventory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ImageZoom from "@/components/ImageZoom";
import ShoppingCart, { type CartItem } from "@/components/ShoppingCart";
import { type InventoryItem } from "@/data/inventory";
import { toast } from "sonner";

const descriptionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
};

const conditionLabels: Record<string, string> = { NM: "Near Mint", SP: "Slightly Played", HP: "Heavily Played", D: "Damaged" };

const ItemGrid = ({ items, isSingles, onAddToCart }: { items: InventoryItem[] | undefined; isSingles?: boolean; onAddToCart: (item: InventoryItem) => void }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set((items ?? []).map((i) => i.category))].sort(), [items]);

  const filteredItems = useMemo(() => {
    return (items ?? []).filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, activeCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, categoria ou tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-colors" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Badge variant={activeCategory === null ? "default" : "outline"} className="cursor-pointer transition-all duration-200 hover:scale-105 shrink-0" onClick={() => setActiveCategory(null)}>Todos</Badge>
          {categories.map((cat) => (
            <Badge key={cat} variant={activeCategory === cat ? "default" : "outline"} className="cursor-pointer transition-all duration-200 hover:scale-105 shrink-0 whitespace-nowrap" onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}>{cat}</Badge>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{filteredItems.length} {filteredItems.length === 1 ? "item" : "itens"} encontrados</p>

      {groupedItems.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum item encontrado.</p>
        </div>
      ) : (
        groupedItems.map(([category, catItems], groupIdx) => (
          <div key={category} className="space-y-3 animate-fade-in-up" style={{ animationDelay: `${0.3 + groupIdx * 0.1}s`, opacity: 0 }}>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-semibold text-foreground">{category}</h2>
              <div className="flex-1 premium-divider" />
              <span className="text-xs text-muted-foreground font-body">{catItems.length} itens</span>
            </div>

            <div className={`grid gap-4 ${isSingles ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {catItems.map((item, i) => {
                const config = descriptionConfig[item.description];
                const Icon = config?.icon ?? Circle;
                const discount = item.discount ?? 0;
                const finalPrice = item.price * (1 - discount / 100);
                const isOutOfStock = item.quantity <= 0;

                return (
                  <div key={item.id} className={`group glass-card glow-hover overflow-hidden animate-scale-in relative ${isOutOfStock ? "opacity-60" : ""}`} style={{ animationDelay: `${0.4 + i * 0.05}s`, opacity: 0 }}>
                    <div className="absolute inset-0 foil-shimmer rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <div className="relative z-10 px-3 pt-3">
                      <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/20 relative">
                        {item.image_url ? (
                          <ImageZoom
                            src={item.image_url}
                            alt={item.name}
                            className={`w-full ${isSingles ? "h-auto aspect-[2.5/3.5]" : "h-44 sm:h-48"} object-cover transition-transform duration-500 ${isOutOfStock ? "grayscale" : ""}`}
                            containerClassName="w-full"
                          />
                        ) : (
                          <div className={`w-full ${isSingles ? "aspect-[2.5/3.5]" : "h-44 sm:h-48"} flex items-center justify-center text-sm text-muted-foreground bg-muted/10`}>
                            Imagem não disponível
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] z-20">
                            <Badge className="bg-destructive/90 text-destructive-foreground text-sm font-bold px-4 py-1.5 shadow-lg">ESGOTADO</Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative z-10 p-3 pt-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-body font-medium text-foreground leading-snug text-sm group-hover:text-primary transition-colors duration-300">{item.name}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate max-w-[120px]" title={item.id}>{item.id}</p>
                          {isSingles && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.language && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.language}</Badge>}
                              {item.condition && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.condition}</Badge>}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${config?.className ?? ""}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {config?.label ?? item.description}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />Esgotado
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hover:border-primary/40" onClick={() => onAddToCart(item)}>
                            <Plus className="h-3 w-3" /> Adicionar
                          </Button>
                        )}

                        <div className="text-right">
                          {discount > 0 ? (
                            <>
                              <span className="block text-[10px] text-muted-foreground line-through">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <span className="text-sm font-bold text-gradient font-display">R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <Badge variant="outline" className="ml-1 text-[9px] bg-accent/15 text-accent border-accent/30">-{discount}%</Badge>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-gradient font-display">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const Catalogo = () => {
  const { data: inventoryData = [], isLoading, error } = useInventory();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const drops = useMemo(() => inventoryData.filter((i) => (i.product_type ?? "drop") === "drop"), [inventoryData]);
  const singles = useMemo(() => inventoryData.filter((i) => i.product_type === "single"), [inventoryData]);

  const addToCart = useCallback((item: InventoryItem) => {
    if (item.quantity <= 0) { toast.error("Item esgotado."); return; }
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.quantity) { toast.error("Quantidade máxima atingida."); return prev; }
        toast.success(`${item.name} — quantidade atualizada!`);
        return prev.map((ci) => ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci);
      }
      toast.success(`${item.name} adicionado ao carrinho!`);
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const updateCartQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCartItems((prev) => prev.map((ci) => ci.item.id === itemId ? { ...ci, qty } : ci));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCartItems([]), []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive font-body">Erro ao carregar catálogo.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="relative h-64 sm:h-72 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8">
          <Link to="/login">
            <img src={logo} alt="Spencer's Cardtopia" className="h-28 sm:h-36 drop-shadow-2xl animate-fade-in cursor-pointer hover:scale-105 transition-transform duration-300" />
          </Link>
          <div className="premium-divider max-w-[120px] mt-3 mb-2" />
          <p className="text-sm text-muted-foreground tracking-[0.25em] uppercase font-medium animate-fade-in" style={{ animationDelay: "0.15s" }}>Catálogo</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 pb-12">
        <Tabs defaultValue="drops" className="w-full">
          <TabsList className="w-full max-w-md mx-auto mb-6 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="drops" className="flex-1 font-display">Drops ({drops.length})</TabsTrigger>
            <TabsTrigger value="singles" className="flex-1 font-display">Singles ({singles.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="drops">
            <ItemGrid items={drops} onAddToCart={addToCart} />
          </TabsContent>

          <TabsContent value="singles">
            <ItemGrid items={singles} isSingles onAddToCart={addToCart} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Social FABs */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-3">
        <a href="https://www.instagram.com/scardtopia/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-accent/50 hover:shadow-accent/10 hover:shadow-xl transition-all duration-300">
          <Instagram className="h-5 w-5 text-accent" />Instagram
        </a>
        <a href="https://wa.me/5511947154555?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20drops%20dispon%C3%ADveis." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-medium text-background shadow-lg shadow-success/20 hover:shadow-success/40 hover:shadow-xl hover:brightness-110 transition-all duration-300">
          <MessageCircle className="h-5 w-5" />Pedir via WhatsApp
        </a>
      </div>

      {/* Shopping Cart */}
      <ShoppingCart items={cartItems} onAdd={addToCart} onRemove={removeFromCart} onClear={clearCart} onUpdateQty={updateCartQty} />
    </div>
  );
};

export default Catalogo;
