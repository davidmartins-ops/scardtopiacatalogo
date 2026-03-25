import { useMemo, useState } from "react";
import { Search, Sparkles, Circle, Rainbow, Filter, Package, MessageCircle, Instagram } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";
import { useInventory } from "@/hooks/use-inventory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import img from "@/assets/produto.png";

const descriptionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
};

const Catalogo = () => {
  const { data: inventoryData = [], isLoading, error } = useInventory();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const availableItems = useMemo(() => inventoryData.filter((item) => item.quantity > 0), [inventoryData]);

  const categories = useMemo(() => [...new Set(availableItems.map((i) => i.category))].sort(), [availableItems]);

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableItems, search, activeCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

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
      {/* Hero */}
      <div className="relative h-64 sm:h-72 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8">
          <img src={logo} alt="Spencer's Cardtopia" className="h-28 sm:h-36 drop-shadow-2xl animate-fade-in" />
          <div className="premium-divider max-w-[120px] mt-3 mb-2" />
          <p
            className="text-sm text-muted-foreground tracking-[0.25em] uppercase font-medium animate-fade-in"
            style={{ animationDelay: "0.15s" }}
          >
            Catálogo de Drops
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-6 pb-12">
        {/* Search & Filters */}
        <div className="glass-card p-4 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, categoria ou tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Badge
              variant={activeCategory === null ? "default" : "outline"}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
              onClick={() => setActiveCategory(null)}
            >
              Todos
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                className="cursor-pointer transition-all duration-200 hover:scale-105"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredItems.length} {filteredItems.length === 1 ? "item disponível" : "itens disponíveis"}
        </p>

        {/* Product cards grouped by category */}
        {groupedItems.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum item encontrado.</p>
          </div>
        ) : (
          groupedItems.map(([category, items], groupIdx) => (
            <div
              key={category}
              className="space-y-3 animate-fade-in-up"
              style={{ animationDelay: `${0.3 + groupIdx * 0.1}s`, opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-semibold text-foreground">{category}</h2>
                <div className="flex-1 premium-divider" />
                <span className="text-xs text-muted-foreground font-body">{items.length} itens</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, i) => {
                  const config = descriptionConfig[item.description];
                  const Icon = config?.icon ?? Circle;

                  return (
                    <div
                      key={item.id}
                      className="group glass-card glow-hover overflow-hidden animate-scale-in"
                      style={{ animationDelay: `${0.4 + i * 0.05}s`, opacity: 0 }}
                    >
                      {/* Foil shimmer overlay */}
                      <div className="absolute inset-0 foil-shimmer rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                      {/* Imagem do produto */}
                      <div className="relative z-10 px-4 pt-4">
                        <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/20">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-44 sm:h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-44 sm:h-48 flex items-center justify-center text-sm text-muted-foreground bg-muted/10">
                              Imagem não disponível
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo do card */}
                      <div className="relative z-10 p-4 pt-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-body font-medium text-foreground leading-snug group-hover:text-primary transition-colors duration-300">
                              {item.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">{item.id}</p>
                          </div>

                          <Badge variant="outline" className={`shrink-0 gap-1 text-xs ${config?.className ?? ""}`}>
                            <Icon className="h-3 w-3" />
                            {config?.label ?? item.description}
                          </Badge>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                            Disponível
                          </span>

                          <span className="text-base font-bold text-gradient font-display">
                            R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
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

      {/* Social FABs */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <a
          href="https://www.instagram.com/scardtopia/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-accent/50 hover:shadow-accent/10 hover:shadow-xl transition-all duration-300"
        >
          <Instagram className="h-5 w-5 text-accent" />
          Instagram
        </a>
        <a
          href="https://wa.me/5511947154555?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20drops%20dispon%C3%ADveis."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-medium text-background shadow-lg shadow-success/20 hover:shadow-success/40 hover:shadow-xl hover:brightness-110 transition-all duration-300"
        >
          <MessageCircle className="h-5 w-5" />
          Pedir via WhatsApp
        </a>
      </div>
    </div>
  );
};

export default Catalogo;
