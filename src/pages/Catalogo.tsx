import { useMemo, useState } from "react";
import { Search, Sparkles, Circle, Rainbow, Filter, Package } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";
import { useInventory } from "@/hooks/use-inventory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const descriptionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
};

const Catalogo = () => {
  const { data: inventoryData = [], isLoading, error } = useInventory();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const availableItems = useMemo(
    () => inventoryData.filter((item) => item.quantity > 0),
    [inventoryData]
  );

  const categories = useMemo(
    () => [...new Set(availableItems.map((i) => i.category))].sort(),
    [availableItems]
  );

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
      <div className="relative h-56 sm:h-64 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-6">
          <img src={logo} alt="Spencer's Cardtopia" className="h-28 sm:h-36" />
          <p className="mt-2 text-sm text-muted-foreground tracking-widest uppercase">
            Catálogo de Drops Disponíveis
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-6 pb-12">
        {/* Search & Filters */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, categoria ou tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Badge
              variant={activeCategory === null ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => setActiveCategory(null)}
            >
              Todos
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                className="cursor-pointer transition-colors"
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
          groupedItems.map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="font-display text-xl font-semibold text-foreground border-b border-border pb-2">
                {category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const config = descriptionConfig[item.description];
                  const Icon = config?.icon ?? Circle;
                  return (
                    <div
                      key={item.id}
                      className="group rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-body font-medium text-foreground leading-snug">
                            {item.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">{item.id}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 gap-1 text-xs ${config?.className ?? ""}`}
                        >
                          <Icon className="h-3 w-3" />
                          {config?.label ?? item.description}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                          Disponível
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Catalogo;
