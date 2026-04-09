import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Circle, Rainbow, Filter, Package, MessageCircle, Instagram, ShoppingCart as CartIconLucide, Plus, Star, Flame, Share2, Copy, Twitter, Heart, User, Layers, BookOpen, LogOut, ChevronDown, ShoppingBag, Palette } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";
import UpcomingBanner from "@/components/UpcomingBanner";
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
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useSavedCart } from "@/hooks/use-saved-cart";
import { useOrders, type OrderItem } from "@/hooks/use-orders";
import { supabase } from "@/integrations/supabase/client";

const descriptionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30" },
  "Surge Foil": { label: "Surge Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
  "Holo Foil": { label: "Holo Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Galaxy Foil": { label: "Galaxy Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
  "Confetti Foil": { label: "Confetti Foil", icon: Sparkles, className: "bg-accent/15 text-accent border-accent/30" },
};

const conditionLabels: Record<string, string> = { NM: "Near Mint", SP: "Slightly Played", MP: "Moderately Played", HP: "Heavily Played", D: "Damaged" };

const trackEvent = async (eventType: string, item?: InventoryItem) => {
  try {
    const sessionId = sessionStorage.getItem("analytics_session") || (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem("analytics_session", id);
      return id;
    })();
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      inventory_item_id: item?.id ?? null,
      item_name: item?.name ?? null,
      category: item?.category ?? null,
      session_id: sessionId,
    });
  } catch { /* silent */ }
};

const shareItem = async (item: InventoryItem, method: "whatsapp" | "twitter" | "instagram" | "copy") => {
  const discount = item.discount ?? 0;
  const finalPrice = item.price * (1 - discount / 100);
  const priceStr = `R$ ${finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const text = `${item.name} - ${priceStr}\n${item.description}${item.language ? ` | ${item.language}` : ""}${item.condition ? ` | ${item.condition}` : ""}\n\nConfira no catalogo da Spencer's Cardtopia!`;
  const url = window.location.href;
  const imageUrl = item.image_url ?? "";

  trackEvent("share", item);

  // Try to fetch image as file for sharing
  let imageFile: File | null = null;
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      imageFile = new File([blob], `${item.name.replace(/\s+/g, "-")}.jpg`, { type: blob.type });
    } catch { /* silent */ }
  }

  if (method === "copy") {
    if (navigator.share) {
      try {
        const shareData: ShareData = { title: item.name, text, url };
        if (imageFile && navigator.canShare?.({ files: [imageFile] })) {
          shareData.files = [imageFile];
        }
        await navigator.share(shareData);
        return;
      } catch { /* fallback */ }
    }
    navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success("Link copiado!");
    return;
  }

  const shareText = `${text}\n${url}`;

  if (method === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  } else if (method === "twitter") {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  } else if (method === "instagram") {
    navigator.clipboard.writeText(shareText);
    toast.success("Texto copiado! Cole no seu Instagram Stories");
    window.open("https://www.instagram.com/", "_blank");
  } else {
    navigator.clipboard.writeText(shareText);
    toast.success("Link copiado!");
  }
};

const MTG_COLORS = [
  { value: "W", label: "Branco", className: "bg-amber-50 text-amber-800 border-amber-300" },
  { value: "U", label: "Azul", className: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "B", label: "Preto", className: "bg-neutral-800 text-neutral-100 border-neutral-600" },
  { value: "R", label: "Vermelho", className: "bg-red-100 text-red-800 border-red-300" },
  { value: "G", label: "Verde", className: "bg-green-100 text-green-800 border-green-300" },
];

const MANA_SYMBOLS = ["W", "U", "B", "R", "G"] as const;

type ManaProfile = {
  manaCost: string | null;
  colors: string[];
};

const getScryfallIdentifier = (item: InventoryItem) => {
  if ((item.product_type ?? "drop") !== "single") return null;

  const parts = item.id.split("-");
  if (parts.length < 5) return null;

  const [set, collectorNumber] = parts;
  if (!set || !collectorNumber) return null;

  return {
    key: `${set.toLowerCase()}:${collectorNumber.toLowerCase()}`,
    set: set.toLowerCase(),
    collector_number: collectorNumber.toLowerCase(),
  };
};

const getManaColors = (manaCost?: string | null) => {
  if (!manaCost) return [];

  return MANA_SYMBOLS.filter((symbol) => new RegExp(symbol, "i").test(manaCost));
};

const ItemGrid = ({ items, isSingles, onAddToCart, isFavorite, onToggleFavorite, isLoggedIn }: { items: InventoryItem[] | undefined; isSingles?: boolean; onAddToCart: (item: InventoryItem) => void; isFavorite: (id: string) => boolean; onToggleFavorite: (id: string) => void; isLoggedIn: boolean }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [manaProfiles, setManaProfiles] = useState<Record<string, ManaProfile>>({});
  const categories = useMemo(() => [...new Set((items ?? []).map((i) => i.category))].sort(), [items]);

  useEffect(() => {
    if (!isSingles || !items?.length) {
      setManaProfiles({});
      return;
    }

    const identifiers = items
      .map((item) => ({ itemId: item.id, identifier: getScryfallIdentifier(item) }))
      .filter((entry): entry is { itemId: string; identifier: NonNullable<ReturnType<typeof getScryfallIdentifier>> } => Boolean(entry.identifier));

    if (!identifiers.length) {
      setManaProfiles({});
      return;
    }

    let cancelled = false;

    const CACHE_KEY = "mana_profiles_cache";
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

    const loadManaProfiles = async () => {
      try {
        // Try loading from localStorage cache first
        const cached = localStorage.getItem(CACHE_KEY);
        let cachedProfiles: Record<string, ManaProfile & { ts: number }> = {};
        if (cached) {
          try { cachedProfiles = JSON.parse(cached); } catch { /* ignore */ }
        }

        const now = Date.now();
        const nextProfiles: Record<string, ManaProfile> = {};
        const needsFetch: typeof identifiers = [];

        identifiers.forEach((entry) => {
          const cachedEntry = cachedProfiles[entry.identifier.key];
          if (cachedEntry && (now - cachedEntry.ts) < CACHE_TTL) {
            nextProfiles[entry.itemId] = { manaCost: cachedEntry.manaCost, colors: cachedEntry.colors };
          } else {
            needsFetch.push(entry);
          }
        });

        if (needsFetch.length > 0) {
          const batches: typeof needsFetch[] = [];
          for (let i = 0; i < needsFetch.length; i += 75) {
            batches.push(needsFetch.slice(i, i + 75));
          }

          for (const batch of batches) {
            const response = await fetch("https://api.scryfall.com/cards/collection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identifiers: batch.map(({ identifier }) => ({
                  set: identifier.set,
                  collector_number: identifier.collector_number,
                })),
              }),
            });

            if (!response.ok) continue;

            const payload = await response.json();
            const cards = Array.isArray(payload.data) ? payload.data : [];
            const byKey = new Map<string, { mana_cost?: string | null }>();

            cards.forEach((card: { set?: string; collector_number?: string; mana_cost?: string | null }) => {
              if (!card.set || !card.collector_number) return;
              byKey.set(`${card.set.toLowerCase()}:${card.collector_number.toLowerCase()}`, card);
            });

            batch.forEach(({ itemId, identifier }) => {
              const card = byKey.get(identifier.key);
              const manaCost = card?.mana_cost ?? null;
              const colors = getManaColors(manaCost);
              nextProfiles[itemId] = { manaCost, colors };
              cachedProfiles[identifier.key] = { manaCost, colors, ts: now };
            });
          }

          // Persist updated cache
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(cachedProfiles)); } catch { /* quota */ }
        }

        if (!cancelled) {
          setManaProfiles(nextProfiles);
        }
      } catch {
        if (!cancelled) {
          setManaProfiles({});
        }
      }
    };

    loadManaProfiles();

    return () => {
      cancelled = true;
    };
  }, [items, isSingles]);

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const filteredItems = useMemo(() => {
    const minP = priceMin ? parseFloat(priceMin) : null;
    const maxP = priceMax ? parseFloat(priceMax) : null;
    return (items ?? []).filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || item.category === activeCategory;
      const finalPrice = item.price * (1 - (item.discount ?? 0) / 100);
      const matchesPrice = (minP === null || finalPrice >= minP) && (maxP === null || finalPrice <= maxP);
      const matchesColor = selectedColors.length === 0 || !isSingles || (() => {
        const profile = manaProfiles[item.id];
        if (!profile) return false;

        const itemColors = [...profile.colors].sort();
        const activeColors = [...selectedColors].sort();

        if (itemColors.length !== activeColors.length) return false;
        return activeColors.every((color, index) => itemColors[index] === color);
      })();
      return matchesSearch && matchesCategory && matchesPrice && matchesColor;
    });
  }, [items, search, activeCategory, priceMin, priceMax, selectedColors, isSingles, manaProfiles]);

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
          <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-colors" />
        </div>

        {/* Alphabetical sort */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Ordem:</span>
          <Select value={activeCategory ?? "default"} onValueChange={(v) => setActiveCategory(v === "default" ? null : v)}>
            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 max-w-[250px]">
              <SelectValue placeholder="Padrão" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="default">Padrão (por coleção)</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSingles && (
          <div className="flex items-center gap-2 flex-wrap">
            <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium shrink-0">Cores no custo:</span>
            {MTG_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => toggleColor(color.value)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                  selectedColors.includes(color.value) ? color.className + " ring-1 ring-primary scale-105" : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"
                }`}
                title={`Filtrar por ${color.value} no custo de mana`}
              >
                {color.label} ({color.value})
              </button>
            ))}
            {selectedColors.length > 1 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Cores combinadas</Badge>
            )}
            {selectedColors.length > 0 && (
              <button className="text-[11px] text-primary hover:text-primary/80 transition-colors font-medium" onClick={() => setSelectedColors([])}>Limpar</button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Preço:</span>
          <Input type="number" placeholder="Mín" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="w-24 h-8 text-xs bg-muted/30 border-border/50" min="0" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="number" placeholder="Máx" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-24 h-8 text-xs bg-muted/30 border-border/50" min="0" />
          {(priceMin || priceMax) && (
            <button className="text-[11px] text-primary hover:text-primary/80 transition-colors font-medium" onClick={() => { setPriceMin(""); setPriceMax(""); }}>Limpar</button>
          )}
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

                    {/* Favorite button */}
                    <button
                      className={`absolute top-2 right-2 z-30 h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-200 ${isFavorite(item.id) ? "bg-destructive/90 text-destructive-foreground" : "bg-background/60 text-muted-foreground hover:text-destructive"}`}
                      onClick={() => { if (!isLoggedIn) { toast.error("Faça login para favoritar."); return; } onToggleFavorite(item.id); }}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isFavorite(item.id) ? "fill-current" : ""}`} />
                    </button>

                    {/* Status Badge */}
                    {item.status === "pre_sale" && (
                      <div className="absolute top-2 left-2 z-30">
                        <Badge className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 shadow-lg gap-1 animate-badge-glow">
                          <Star className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />PRÉ VENDA
                        </Badge>
                      </div>
                    )}
                    {item.status === "launch" && (
                      <div className="absolute top-2 left-2 z-30">
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-lg gap-1 animate-badge-glow-primary">
                          <Flame className="h-3 w-3 animate-pulse" />LANÇAMENTO
                        </Badge>
                      </div>
                    )}

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
                      <div className="flex flex-col gap-1 mb-1">
                        <h3 className="font-body font-medium text-foreground leading-snug text-sm group-hover:text-primary transition-colors duration-300 line-clamp-2">{item.name}</h3>
                        <Badge variant="outline" className={`self-start gap-1 text-[10px] ${config?.className ?? ""}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {config?.label ?? item.description}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate" title={item.id}>{item.id}</p>
                      {isSingles && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.language && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.language}</Badge>}
                          {item.condition && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.condition}</Badge>}
                        </div>
                      )}

                      <div className="mt-2">
                        <div className="mb-2">
                          {discount > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground line-through">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <span className="text-sm font-bold text-gradient font-display">R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <Badge variant="outline" className="text-[9px] bg-accent/15 text-accent border-accent/30">-{discount}%</Badge>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-gradient font-display">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                        {!isOutOfStock && (
                          <p className="text-[10px] text-muted-foreground mb-1">
                            {item.quantity === 1 ? "Última unidade!" : `${item.quantity} em estoque`}
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />Esgotado
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hover:border-primary/40" onClick={() => onAddToCart(item)}>
                              <Plus className="h-3 w-3" /> Adicionar
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary">
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[160px]">
                              <DropdownMenuItem onClick={() => shareItem(item, "whatsapp")} className="gap-2 cursor-pointer">
                                <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => shareItem(item, "twitter")} className="gap-2 cursor-pointer">
                                <Twitter className="h-4 w-4 text-sky-500" /> Twitter / X
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => shareItem(item, "instagram")} className="gap-2 cursor-pointer">
                                <Instagram className="h-4 w-4 text-pink-500" /> Instagram Stories
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => shareItem(item, "copy")} className="gap-2 cursor-pointer">
                                <Copy className="h-4 w-4 text-muted-foreground" /> Copiar link
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
  const { user, profile, signOut } = useCustomerAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { savedItems, isLoading: savedCartLoading, syncCart } = useSavedCart();
  const { createOrder } = useOrders();
  const cartLoadedFromDb = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FABs visibility: hide when near bottom
  const [fabsVisible, setFabsVisible] = useState(true);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setFabsVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Load cart from DB when user logs in and inventory is ready
  useEffect(() => {
    if (!user || savedCartLoading || cartLoadedFromDb.current || inventoryData.length === 0) return;
    if (savedItems.length > 0) {
      const restored: CartItem[] = [];
      savedItems.forEach((si) => {
        const item = inventoryData.find((inv) => inv.id === si.inventory_item_id);
        if (item) restored.push({ item, qty: Math.min(si.quantity, item.quantity) });
      });
      if (restored.length > 0) {
        setCartItems((prev) => {
          const merged = [...prev];
          restored.forEach((r) => {
            if (!merged.find((m) => m.item.id === r.item.id)) merged.push(r);
          });
          return merged;
        });
      }
    }
    cartLoadedFromDb.current = true;
  }, [user, savedItems, savedCartLoading, inventoryData]);

  // Auto-sync cart to DB with debounce
  const syncCartToDb = useCallback((items: CartItem[]) => {
    if (!user) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncCart.mutate(items.map((ci) => ({ inventory_item_id: ci.item.id, quantity: ci.qty })));
    }, 1500);
  }, [user, syncCart]);

  const addToCart = useCallback((item: InventoryItem) => {
    if (item.quantity <= 0) { toast.error("Item esgotado."); return; }
    trackEvent("add_to_cart", item);
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      let next: CartItem[];
      if (existing) {
        if (existing.qty >= item.quantity) { toast.error("Quantidade máxima atingida."); return prev; }
        toast.success(`${item.name} — quantidade atualizada!`);
        next = prev.map((ci) => ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci);
      } else {
        toast.success(`${item.name} adicionado ao carrinho!`);
        next = [...prev, { item, qty: 1 }];
      }
      syncCartToDb(next);
      return next;
    });
  }, [syncCartToDb]);

  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => {
      const next = prev.filter((ci) => ci.item.id !== itemId);
      syncCartToDb(next);
      return next;
    });
  }, [syncCartToDb]);

  const updateCartQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCartItems((prev) => {
      const next = prev.map((ci) => ci.item.id === itemId ? { ...ci, qty } : ci);
      syncCartToDb(next);
      return next;
    });
  }, [removeFromCart, syncCartToDb]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    syncCartToDb([]);
  }, [syncCartToDb]);

  const handleOrderPlaced = useCallback(async (items: CartItem[], total: number) => {
    if (!user) return;
    const orderItems: OrderItem[] = items.map((ci) => {
      const discount = ci.item.discount ?? 0;
      const unitPrice = ci.item.price * (1 - discount / 100);
      return {
        id: ci.item.id,
        name: ci.item.name,
        description: ci.item.description,
        language: ci.item.language,
        condition: ci.item.condition,
        quantity: ci.qty,
        unit_price: unitPrice,
        total_price: unitPrice * ci.qty,
      };
    });
    createOrder.mutate({ items: orderItems, total });

    // Deduct stock for each item
    for (const ci of items) {
      const newQty = Math.max(0, ci.item.quantity - ci.qty);
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", ci.item.id);
    }

    toast.success("Pedido registrado e estoque atualizado!");
  }, [user, createOrder]);

  const drops = useMemo(() => inventoryData.filter((i) => (i.product_type ?? "drop") === "drop"), [inventoryData]);
  const singles = useMemo(() => inventoryData.filter((i) => i.product_type === "single"), [inventoryData]);

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
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/login">
            <img src={logo} alt="Spencer's Cardtopia" className="h-9 hover:scale-105 transition-transform" />
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/tendencias">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">Tendências</span>
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/conta">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <Heart className="h-4 w-4" />
                    <span className="hidden sm:inline">Favoritos</span>
                  </Button>
                </Link>
                <Link to="/conta">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <Layers className="h-4 w-4" />
                    <span className="hidden sm:inline">Decks</span>
                  </Button>
                </Link>
                <Link to="/conta">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Coleções</span>
                  </Button>
                </Link>

                <div className="h-5 w-px bg-border mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-muted/50 transition-colors">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                          {(profile?.display_name ?? user.email ?? "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground hidden sm:inline max-w-[120px] truncate">
                        {profile?.display_name ?? user.email?.split("@")[0]}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/conta"><User className="h-4 w-4" /> Minha Conta</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/conta"><Heart className="h-4 w-4" /> Favoritos</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/conta"><Layers className="h-4 w-4" /> Meus Decks</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/conta"><BookOpen className="h-4 w-4" /> Minhas Coleções</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2">
                      <Link to="/conta?tab=orders"><ShoppingBag className="h-4 w-4" /> Meus Pedidos</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer gap-2 text-destructive focus:text-destructive" onClick={() => signOut()}>
                      <LogOut className="h-4 w-4" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/conta/login">
                <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 hover:border-primary/60">
                  <User className="h-4 w-4 text-primary" /> Entrar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative h-32 sm:h-40 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground drop-shadow-lg animate-fade-in" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: '0.05em' }}>
            <span className="text-gradient">Catálogo</span>
          </h1>
          <div className="premium-divider max-w-[80px] mt-2" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 pb-12 space-y-6">
        {/* Upcoming Releases Banner */}
        <UpcomingBanner />

        <Tabs defaultValue="drops" className="w-full">
          <TabsList className="w-full max-w-md mx-auto mb-6 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="drops" className="flex-1 font-display">Drops ({drops.length})</TabsTrigger>
            <TabsTrigger value="singles" className="flex-1 font-display">Singles ({singles.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="drops">
            <ItemGrid items={drops} onAddToCart={addToCart} isFavorite={isFavorite} onToggleFavorite={(id) => toggleFavorite.mutate(id)} isLoggedIn={!!user} />
          </TabsContent>

          <TabsContent value="singles">
            <ItemGrid items={singles} isSingles onAddToCart={addToCart} isFavorite={isFavorite} onToggleFavorite={(id) => toggleFavorite.mutate(id)} isLoggedIn={!!user} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom sentinel for hiding FABs */}
      <div ref={bottomSentinelRef} className="h-1 w-full" />

      {/* Social FABs - hide near bottom */}
      <div className={`fixed bottom-6 left-6 z-40 flex flex-col gap-3 transition-all duration-500 ${fabsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <a href="https://www.instagram.com/scardtopia/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-accent/50 hover:shadow-accent/10 hover:shadow-xl transition-all duration-300">
          <Instagram className="h-5 w-5 text-accent" />Instagram
        </a>
        <a href="https://wa.me/5511947154555?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20drops%20dispon%C3%ADveis." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-medium text-background shadow-lg shadow-success/20 hover:shadow-success/40 hover:shadow-xl hover:brightness-110 transition-all duration-300">
          <MessageCircle className="h-5 w-5" />Pedir via WhatsApp
        </a>
      </div>

      {/* Shopping Cart - also hide near bottom */}
      <ShoppingCart items={cartItems} onAdd={addToCart} onRemove={removeFromCart} onClear={clearCart} onUpdateQty={updateCartQty} onOrderPlaced={user ? handleOrderPlaced : undefined} fabsVisible={fabsVisible} />
    </div>
  );
};

export default Catalogo;
