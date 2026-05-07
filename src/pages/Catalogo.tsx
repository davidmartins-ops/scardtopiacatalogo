import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { DollarSign, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Search,
  Sparkles,
  Circle,
  Rainbow,
  Filter,
  Package,
  MessageCircle,
  Instagram,
  ShoppingCart as CartIconLucide,
  Plus,
  Star,
  Flame,
  Share2,
  Copy,
  Twitter,
  Heart,
  User,
  Layers,
  BookOpen,
  LogOut,
  ChevronDown,
  ShoppingBag,
  Palette,
  ChevronLeft,
  ChevronRight,
  SearchIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";
import { useActiveBanners } from "@/hooks/use-banners";
import { useInventory } from "@/hooks/use-inventory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import ShoppingCart, { type CartItem } from "@/components/ShoppingCart";
import { type InventoryItem } from "@/data/inventory";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useSavedCart } from "@/hooks/use-saved-cart";
import { type OrderItem } from "@/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMtgSets, extractSetCode } from "@/hooks/use-mtg-sets";
import SetCombobox from "@/components/SetCombobox";

const MTG_COLORS = [
  { value: "W", label: "Branco", className: "bg-amber-50 text-amber-800 border-amber-300" },
  { value: "U", label: "Azul", className: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "B", label: "Preto", className: "bg-neutral-700 text-neutral-100 border-neutral-500" },
  { value: "R", label: "Vermelho", className: "bg-red-100 text-red-800 border-red-300" },
  { value: "G", label: "Verde", className: "bg-green-100 text-green-800 border-green-300" },
  { value: "C", label: "Incolor", className: "bg-gray-200 text-gray-700 border-gray-400" },
];

type ManaProfile = { manaCost: string | null; colors: string[] };

const getScryfallIdentifier = (item: InventoryItem) => {
  if ((item.product_type ?? "drop") !== "single") return null;
  const parts = item.id.split("-");
  if (parts.length < 5) return null;
  const [set, collectorNumber] = parts;
  if (!set || !collectorNumber) return null;
  return { key: `${set.toLowerCase()}:${collectorNumber.toLowerCase()}`, set: set.toLowerCase(), collector_number: collectorNumber.toLowerCase() };
};

const getManaColors = (manaCost?: string | null, colorIdentity?: string[] | null) => {
  if (!manaCost && (!colorIdentity || colorIdentity.length === 0)) return ["C"];
  if (!manaCost) return colorIdentity && colorIdentity.length === 0 ? ["C"] : (colorIdentity ?? []);
  const colors = (["W", "U", "B", "R", "G"] as const).filter((symbol) => new RegExp(`\\{[^}]*${symbol}[^}]*\\}`, "i").test(manaCost));
  if (colors.length === 0 && manaCost.length > 0) return ["C"];
  return colors;
};

const trackEvent = async (eventType: string, item?: InventoryItem) => {
  // LGPD: only record analytics when user has given consent
  const { hasAnalyticsConsent } = await import("@/lib/consent");
  if (!hasAnalyticsConsent()) return;
  try {
    const sessionId = sessionStorage.getItem("analytics_session") || (() => { const id = crypto.randomUUID(); sessionStorage.setItem("analytics_session", id); return id; })();
    await supabase.from("analytics_events").insert({ event_type: eventType, inventory_item_id: item?.id ?? null, item_name: item?.name ?? null, category: item?.category ?? null, session_id: sessionId });
  } catch {}
};

const ItemGrid = ({
  items, isSingles, onAddToCart, isFavorite, onToggleFavorite, isLoggedIn, userId,
}: {
  items: InventoryItem[] | undefined;
  isSingles?: boolean;
  onAddToCart: (item: InventoryItem) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  isLoggedIn: boolean;
  userId?: string;
}) => {
  const [search, setSearch] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [manaProfiles, setManaProfiles] = useState<Record<string, ManaProfile>>({});
  const [sortOrder, setSortOrder] = useState<string>("default");
  const [foilFilter, setFoilFilter] = useState<string>("all");
  const [setFilter, setSetFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "launch" | "pre_sale" | "none">("all");
  const { sets: allSets } = useMtgSets();

  useEffect(() => {
    if (!isSingles || !items?.length) { setManaProfiles({}); return; }
    const identifiers = items
      .map((item) => ({ itemId: item.id, identifier: getScryfallIdentifier(item) }))
      .filter((e): e is { itemId: string; identifier: NonNullable<ReturnType<typeof getScryfallIdentifier>> } => Boolean(e.identifier));
    if (!identifiers.length) { setManaProfiles({}); return; }
    let cancelled = false;
    const CACHE_KEY = "mana_profiles_cache";
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    const loadManaProfiles = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        let cachedProfiles: Record<string, ManaProfile & { ts: number; colorIdentity?: string[] }> = {};
        if (cached) { try { cachedProfiles = JSON.parse(cached); } catch {} }

        const now = Date.now();
        const nextProfiles: Record<string, ManaProfile> = {};
        const needsFetch: typeof identifiers = [];

        identifiers.forEach((entry) => {
          const cachedEntry = cachedProfiles[entry.identifier.key];
          if (cachedEntry && now - cachedEntry.ts < CACHE_TTL) {
            nextProfiles[entry.itemId] = { manaCost: cachedEntry.manaCost, colors: cachedEntry.colors };
          } else {
            needsFetch.push(entry);
          }
        });

        if (needsFetch.length > 0) {
          const batches: (typeof needsFetch)[] = [];
          for (let i = 0; i < needsFetch.length; i += 75) batches.push(needsFetch.slice(i, i + 75));

          for (const batch of batches) {
            const response = await fetch("https://api.scryfall.com/cards/collection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifiers: batch.map(({ identifier }) => ({ set: identifier.set, collector_number: identifier.collector_number })) }),
            });
            if (!response.ok) continue;
            const payload = await response.json();
            const cards = Array.isArray(payload.data) ? payload.data : [];
            const byKey = new Map<string, { mana_cost?: string | null; color_identity?: string[] }>();
            cards.forEach((card: any) => { if (!card.set || !card.collector_number) return; byKey.set(`${card.set.toLowerCase()}:${card.collector_number.toLowerCase()}`, card); });
            batch.forEach(({ itemId, identifier }) => {
              const card = byKey.get(identifier.key);
              const manaCost = card?.mana_cost ?? null;
              const colorIdentity = card?.color_identity ?? [];
              const colors = getManaColors(manaCost, colorIdentity);
              nextProfiles[itemId] = { manaCost, colors };
              cachedProfiles[identifier.key] = { manaCost, colors, ts: now, colorIdentity };
            });
          }
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(cachedProfiles)); } catch {}
        }

        if (!cancelled) setManaProfiles(nextProfiles);
      } catch { if (!cancelled) setManaProfiles({}); }
    };

    loadManaProfiles();
    return () => { cancelled = true; };
  }, [items, isSingles]);

  const toggleColor = (color: string) => {
    setSelectedColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]));
  };

  const filteredItems = useMemo(() => {
    const minP = priceMin ? parseFloat(priceMin) : null;
    const maxP = priceMax ? parseFloat(priceMax) : null;
    return (items ?? []).filter((item) => {
      if (isSingles && item.quantity <= 0) return false;
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase());
      const finalPrice = item.price * (1 - (item.discount ?? 0) / 100);
      const matchesPrice = (minP === null || finalPrice >= minP) && (maxP === null || finalPrice <= maxP);
      const matchesFoil = foilFilter === "all" || item.description === foilFilter;
      const matchesSet = setFilter === "all" || (isSingles && extractSetCode(item.id) === setFilter);
      const matchesStatus = statusFilter === "all" || (item.status ?? "none") === statusFilter;
      const matchesColor = selectedColors.length === 0 || !isSingles || (() => {
        const profile = manaProfiles[item.id];
        if (!profile) return false;
        const itemColors = [...profile.colors].sort();
        const activeColors = [...selectedColors].sort();
        if (itemColors.length !== activeColors.length) return false;
        return activeColors.every((color, index) => itemColors[index] === color);
      })();
      return matchesSearch && matchesPrice && matchesColor && matchesFoil && matchesSet && matchesStatus;
    });
  }, [items, search, priceMin, priceMax, selectedColors, isSingles, manaProfiles, foilFilter, setFilter, statusFilter]);

  // Sets present in current items (only for singles)
  const availableSets = useMemo(() => {
    if (!isSingles) return [] as { code: string; name: string }[];
    const codes = new Set<string>();
    (items ?? []).forEach((item) => {
      const code = extractSetCode(item.id);
      if (code) codes.add(code);
    });
    const nameByCode = new Map(allSets.map((s) => [s.code, s.name]));
    return Array.from(codes)
      .map((code) => ({ code, name: nameByCode.get(code) ?? code.toUpperCase() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, isSingles, allSets]);

  const groupedItems = useMemo(() => {
    if (sortOrder === "az" || sortOrder === "za") {
      const sorted = [...filteredItems].sort((a, b) => sortOrder === "az" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
      return [["Todas as cartas", sorted]] as [string, typeof filteredItems][];
    }
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => { if (!groups[item.category]) groups[item.category] = []; groups[item.category].push(item); });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems, sortOrder]);

  return (
    <div className="space-y-6 overflow-visible">
      <div className="glass-card p-4 space-y-4 animate-fade-in-up overflow-visible" style={{ animationDelay: "0.2s", opacity: 0 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-colors" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Ordem:</span>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 max-w-[250px]"><SelectValue placeholder="Padrão" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="default">Padrão (por coleção)</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Foil:</span>
          <Select value={foilFilter} onValueChange={setFoilFilter}>
            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 max-w-[200px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent className="max-h-60 z-50 bg-popover">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Non-Foil">Non-Foil</SelectItem>
              <SelectItem value="Foil">Foil</SelectItem>
              <SelectItem value="Surge Foil">Surge Foil</SelectItem>
              <SelectItem value="Rainbow Foil">Rainbow Foil</SelectItem>
              <SelectItem value="Holo Foil">Holo Foil</SelectItem>
              <SelectItem value="Galaxy Foil">Galaxy Foil</SelectItem>
              <SelectItem value="Confetti Foil">Confetti Foil</SelectItem>
              <SelectItem value="Etched Foil">Etched Foil</SelectItem>
              <SelectItem value="Silver Scroll">Silver Scroll</SelectItem>
            </SelectContent>
          </Select>
          {isSingles && availableSets.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground font-medium shrink-0 ml-2">Coleção:</span>
              <SetCombobox sets={availableSets} value={setFilter} onChange={setSetFilter} />
            </>
          )}
          {(foilFilter !== "all" || setFilter !== "all") && (
            <button className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold" onClick={() => { setFoilFilter("all"); setSetFilter("all"); }}>Limpar</button>
          )}
        </div>
        {isSingles && (
          <div className="flex items-center gap-2 flex-wrap">
            <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium shrink-0">Cores no custo:</span>
            {MTG_COLORS.map((color) => (
              <button key={color.value} onClick={() => toggleColor(color.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${selectedColors.includes(color.value) ? color.className + " ring-1 ring-primary scale-105" : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"}`}
                title={`Filtrar por ${color.value} no custo de mana`}>{color.label} ({color.value})</button>
            ))}
            {selectedColors.length > 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Cores combinadas</Badge>}
            {selectedColors.length > 0 && <button className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold" onClick={() => setSelectedColors([])}>Limpar</button>}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Flame className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Classificação:</span>
          {([
            { v: "all", label: "Todos" },
            { v: "launch", label: "Lançamento" },
            { v: "pre_sale", label: "Pré-venda" },
            { v: "none", label: "Sem informação" },
          ] as const).map((opt) => {
            const count = opt.v === "all"
              ? (items ?? []).length
              : (items ?? []).filter((i) => (i.status ?? "none") === opt.v).length;
            const active = statusFilter === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setStatusFilter(opt.v)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"}`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
          {statusFilter !== "all" && (
            <button className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold" onClick={() => setStatusFilter("all")}>Limpar</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">Preço:</span>
          <Input type="number" placeholder="Mín" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="w-24 h-8 text-xs bg-muted/30 border-border/50" min="0" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="number" placeholder="Máx" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-24 h-8 text-xs bg-muted/30 border-border/50" min="0" />
          {(priceMin || priceMax) && <button className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold" onClick={() => { setPriceMin(""); setPriceMax(""); }}>Limpar</button>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">Mostrando {filteredItems.length} de {(items ?? []).length} {(items ?? []).length === 1 ? "item" : "itens"}</p>

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
              {catItems.map((item, i) => (
                <div key={item.id} className="animate-scale-in max-w-[280px] sm:max-w-[320px] md:max-w-[360px] mx-auto w-full" style={{ animationDelay: `${0.4 + i * 0.05}s`, opacity: 0 }}>
                  <ProductCard
                    item={item}
                    isSingle={isSingles}
                    onAddToCart={onAddToCart}
                    isFavorite={isFavorite(item.id)}
                    onToggleFavorite={() => onToggleFavorite(item.id)}
                    isLoggedIn={isLoggedIn}
                    userId={userId}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/* Catalog Banner Carousel */
const CatalogBanner = () => {
  const { data: banners = [] } = useActiveBanners("catalogo");
  const { data: inventory = [] } = useInventory();
  const [currentBanner, setCurrentBanner] = useState(0);
  useEffect(() => { if (banners.length <= 1) return; const timer = setInterval(() => { setCurrentBanner((prev) => (prev + 1) % banners.length); }, 7000); return () => clearInterval(timer); }, [banners.length]);

  const linkedHrefFor = (invId?: string | null) => {
    if (!invId) return null;
    const item = inventory.find((i) => i.id === invId);
    if (!item) return null;
    return (item.product_type ?? "drop") === "single"
      ? `/catalogo/single/${encodeURIComponent(item.id)}`
      : `/catalogo/drop/${encodeURIComponent(item.id)}`;
  };

  // Banner sized for 1920x720 source assets. aspect-[16/6] keeps proportions consistent across breakpoints.
  if (banners.length === 0) {
    return (
      <div className="relative w-full aspect-[16/6] sm:aspect-[16/5] max-h-[420px] overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground drop-shadow-lg animate-fade-in" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}>
            <span className="text-gradient">Catálogo</span>
          </h1>
          <div className="premium-divider max-w-[80px] mt-2" />
        </div>
      </div>
    );
  }

  const activeBanner = banners[currentBanner];
  const activeHref = linkedHrefFor(activeBanner?.inventory_item_id);

  return (
    <div className="relative w-full aspect-[16/6] sm:aspect-[16/5] max-h-[420px] overflow-hidden group">
      <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentBanner * 100}%)` }}>
        {banners.map((b, idx) => {
          const href = linkedHrefFor(b.inventory_item_id);
          const Img = (
            <img src={b.image_url} alt={b.alt} className="absolute inset-0 w-full h-full object-cover" />
          );
          return (
            <div key={idx} className="relative w-full h-full flex-shrink-0" style={{ minWidth: "100%" }}>
              {href ? (
                <Link to={href} className="absolute inset-0 block" onClick={() => trackEvent("banner_click", inventory.find((i) => i.id === b.inventory_item_id))}>
                  {Img}
                </Link>
              ) : Img}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-10 pointer-events-none">
        <span className="inline-block px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider mb-1">{activeBanner?.label}</span>
        <h2 className="text-lg sm:text-xl font-display font-bold text-foreground drop-shadow-lg">{activeBanner?.title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{activeBanner?.subtitle}</p>
        {activeHref && (
          <Link to={activeHref} className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-brand-gold hover:underline pointer-events-auto" onClick={() => trackEvent("banner_cta_click", inventory.find((i) => i.id === activeBanner?.inventory_item_id))}>
            🔍 Ver Conteúdo do Drop →
          </Link>
        )}
      </div>
      {banners.length > 1 && (
        <>
          <button onClick={() => setCurrentBanner((p) => (p - 1 + banners.length) % banners.length)} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100 z-20"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCurrentBanner((p) => (p + 1) % banners.length)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100 z-20"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 right-4 flex gap-1.5 z-20">
            {banners.map((_, idx) => (<button key={idx} onClick={() => setCurrentBanner(idx)} className={`h-1.5 rounded-full transition-all ${idx === currentBanner ? "w-5 bg-primary" : "w-1.5 bg-foreground/30"}`} />))}
          </div>
        </>
      )}
    </div>
  );
};

/* Promo Highlights - redesigned */
const PromoHighlights = ({
  items, onAddToCart, isFavorite, onToggleFavorite, isLoggedIn,
}: {
  items: InventoryItem[]; onAddToCart: (item: InventoryItem) => void;
  isFavorite: (id: string) => boolean; onToggleFavorite: (id: string) => void; isLoggedIn: boolean;
}) => {
  const promoItems = useMemo(() => items.filter((i) => (i.discount ?? 0) > 0 && i.quantity > 0), [items]);
  if (promoItems.length === 0) return null;

  return (
    <div className="space-y-3 mt-6 sm:mt-8">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-semibold text-foreground" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          <span className="text-gradient">🔥 Em Promoção</span>
        </h2>
        <div className="flex-1 premium-divider" />
        <span className="text-xs text-muted-foreground">{promoItems.length} itens</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide items-stretch">
        {promoItems.map((item) => {
          const discount = item.discount ?? 0;
          const finalPrice = item.price * (1 - discount / 100);

          return (
            <div key={item.id} className="flex-shrink-0 w-52 sm:w-56 glass-card glow-hover overflow-hidden snap-start relative group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col h-auto">
              {/* Discount badge */}
              <div className="absolute top-2 left-2 z-30">
                <div className="bg-destructive text-destructive-foreground text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg">
                  -{discount}%
                </div>
              </div>
              <button
                className={`absolute top-2 right-2 z-30 h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${isFavorite(item.id) ? "bg-destructive/90 text-destructive-foreground" : "bg-background/70 text-muted-foreground hover:text-destructive border border-border/50"}`}
                onClick={() => { if (!isLoggedIn) { toast.error("Faça login para favoritar."); return; } onToggleFavorite(item.id); }}
              >
                <Heart className={`h-3.5 w-3.5 ${isFavorite(item.id) ? "fill-current" : ""}`} />
              </button>
              {/* Image - FIXED height for ALL cards (singles or drops, with or without image) */}
              <div className="relative z-10 px-2 pt-2">
                <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/20 h-44 sm:h-48">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/10"><Package className="h-8 w-8 text-muted-foreground/30" /></div>
                  )}
                </div>
              </div>
              <div className="relative z-10 p-3 pt-2 flex flex-col flex-1">
                {/* Title - fixed min height */}
                <div className="min-h-[40px]">
                  <h3 className="text-[14px] sm:text-[15px] font-semibold text-foreground line-clamp-2 leading-[1.3]">{item.name}</h3>
                </div>
                {/* Prices - fixed min height to align across cards */}
                <div className="space-y-0.5 mt-1.5 min-h-[52px]">
                  <span className="text-[22px] sm:text-[24px] font-bold text-primary font-display block leading-none">
                    R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[12px] text-muted-foreground line-through block">
                    R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Button anchored to bottom */}
                <div className="mt-auto pt-2">
                  <Button size="sm" variant="default" className="w-full h-9 text-[13px] gap-1 font-semibold transition-all duration-150 active:scale-[0.98]" onClick={() => onAddToCart(item)}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Catalogo = () => {
  const { data: inventoryData = [], isLoading, error } = useInventory();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { user, profile, signOut } = useCustomerAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { savedItems, isLoading: savedCartLoading, syncCart } = useSavedCart();
  const queryClient = useQueryClient();
  const cartLoadedFromDb = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fabsVisible, setFabsVisible] = useState(true);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => { setFabsVisible(!entry.isIntersecting); }, { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Restore guest cart from localStorage (preserved across login redirects)
  useEffect(() => {
    if (inventoryData.length === 0) return;
    try {
      const raw = localStorage.getItem("spencer_guest_cart");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { inventory_item_id: string; quantity: number }[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const restored: CartItem[] = [];
      parsed.forEach((g) => {
        const item = inventoryData.find((inv) => inv.id === g.inventory_item_id);
        if (item) restored.push({ item, qty: Math.min(g.quantity, item.quantity) });
      });
      if (restored.length > 0) {
        setCartItems((prev) => {
          const merged = [...prev];
          restored.forEach((r) => { if (!merged.find((m) => m.item.id === r.item.id)) merged.push(r); });
          return merged;
        });
      }
      // Clear only after we've successfully restored (or had nothing to restore)
      localStorage.removeItem("spencer_guest_cart");
    } catch {
      localStorage.removeItem("spencer_guest_cart");
    }
  }, [inventoryData]);

  useEffect(() => {
    if (!user || savedCartLoading || cartLoadedFromDb.current || inventoryData.length === 0) return;
    if (savedItems.length > 0) {
      const restored: CartItem[] = [];
      savedItems.forEach((si) => { const item = inventoryData.find((inv) => inv.id === si.inventory_item_id); if (item) restored.push({ item, qty: Math.min(si.quantity, item.quantity) }); });
      if (restored.length > 0) {
        setCartItems((prev) => { const merged = [...prev]; restored.forEach((r) => { if (!merged.find((m) => m.item.id === r.item.id)) merged.push(r); }); return merged; });
      }
    }
    cartLoadedFromDb.current = true;
  }, [user, savedItems, savedCartLoading, inventoryData]);

  const syncCartToDb = useCallback((items: CartItem[]) => {
    if (!user) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => { syncCart.mutate(items.map((ci) => ({ inventory_item_id: ci.item.id, quantity: ci.qty }))); }, 1500);
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
        next = prev.map((ci) => (ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci));
      } else {
        toast.success(`${item.name} adicionado ao carrinho!`);
        next = [...prev, { item, qty: 1 }];
      }
      syncCartToDb(next);
      return next;
    });
  }, [syncCartToDb]);

  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => { const next = prev.filter((ci) => ci.item.id !== itemId); syncCartToDb(next); return next; });
  }, [syncCartToDb]);

  const updateCartQty = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCartItems((prev) => { const next = prev.map((ci) => (ci.item.id === itemId ? { ...ci, qty } : ci)); syncCartToDb(next); return next; });
  }, [removeFromCart, syncCartToDb]);

  const clearCart = useCallback(() => { setCartItems([]); syncCartToDb([]); }, [syncCartToDb]);

  const handleOrderPlaced = useCallback(async (
    items: CartItem[],
    total: number,
    meta?: {
      paymentMethod?: "pix" | "whatsapp";
      receiptUrl?: string | null;
      customerInfo?: Record<string, unknown>;
    }
  ): Promise<boolean> => {
    const orderItems: OrderItem[] = items.map((ci) => {
      const discount = ci.item.discount ?? 0;
      const unitPrice = ci.item.price * (1 - discount / 100);
      return { id: ci.item.id, name: ci.item.name, description: ci.item.description, language: ci.item.language, condition: ci.item.condition, quantity: ci.qty, unit_price: unitPrice, total_price: unitPrice * ci.qty };
    });
    try {
      const isPix = meta?.paymentMethod === "pix";
      const ci = (meta?.customerInfo ?? {}) as { cpf?: string; phone?: string; address?: Record<string, unknown> };
      // Best-effort: persist cpf/phone/address back into the customer profile
      if (user && (ci.cpf || ci.phone || ci.address)) {
        supabase.from("customer_profiles").update({
          ...(ci.cpf ? { cpf: ci.cpf } : {}),
          ...(ci.phone ? { phone: ci.phone } : {}),
          ...(ci.address ? { address: ci.address as never } : {}),
        } as never).eq("id", user.id).then(() => {});
      }
      const { data: orderRow, error: orderErr } = await supabase.from("orders").insert({
        user_id: user?.id ?? null,
        items: orderItems as never,
        total,
        status: isPix ? "pending_payment" : "payment_confirmed",
        receipt_url: meta?.receiptUrl ?? null,
        payment_method: (meta?.paymentMethod ?? "whatsapp") as never,
        customer_info: (meta?.customerInfo ?? {}) as never,
      } as never).select("id").single();
      if (orderErr) {
        console.error("[CHECKOUT] Falha ao inserir pedido:", orderErr);
        toast.error(`Erro ao salvar pedido: ${orderErr.message}`);
        throw orderErr;
      }
      console.info("[CHECKOUT] Pedido criado", { orderId: (orderRow as any)?.id, isPix, total });

      // Track analytics
      for (const ci of items) {
        trackEvent("purchase", ci.item);
      }

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (user) queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
      clearCart();
      toast.success("Pedido registrado e estoque atualizado!");
      return true;
    } catch (err) {
      console.error("Order error:", err);
      return false;
    }
  }, [user, clearCart, queryClient]);

  const drops = useMemo(() => inventoryData.filter((i) => (i.product_type ?? "drop") === "drop"), [inventoryData]);
  const singles = useMemo(() => inventoryData.filter((i) => i.product_type === "single"), [inventoryData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background font-body">
        <div className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
            <img src={logo} alt="Spencer's Cardtopia" className="h-9" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (<ProductCardSkeleton key={i} />))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-destructive font-body font-semibold">Erro ao carregar catálogo.</p>
          <p className="text-xs text-muted-foreground font-mono break-all">{(error as any)?.message ?? String(error)}</p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Sticky Header Bar - dark blue brand identity */}
      <div className="sticky top-0 z-40 border-b border-brand-header-border bg-brand-header backdrop-blur-xl shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/catalogo">
            <img src={logo} alt="Spencer's Cardtopia" className="h-9 hover:scale-105 transition-transform" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/tendencias">
              <Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">Tendências</span>
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/conta"><Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200"><Heart className="h-4 w-4" /><span className="hidden sm:inline">Favoritos</span></Button></Link>
                <Link to="/conta"><Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200"><Layers className="h-4 w-4" /><span className="hidden sm:inline">Decks</span></Button></Link>
                <Link to="/conta"><Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200"><BookOpen className="h-4 w-4" /><span className="hidden sm:inline">Coleções</span></Button></Link>
                <div className="h-5 w-px bg-white/20 mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10 transition-colors">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs bg-brand-gold/20 text-brand-gold font-bold">{(profile?.display_name ?? user.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium text-brand-header-foreground hidden sm:inline max-w-[120px] truncate">{profile?.display_name ?? user.email?.split("@")[0]}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-brand-header-foreground/70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild className="cursor-pointer gap-2"><Link to="/conta"><User className="h-4 w-4" /> Minha Conta</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2"><Link to="/conta"><Heart className="h-4 w-4" /> Favoritos</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2"><Link to="/conta"><Layers className="h-4 w-4" /> Meus Decks</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2"><Link to="/conta"><BookOpen className="h-4 w-4" /> Minhas Coleções</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer gap-2"><Link to="/conta?tab=orders"><ShoppingBag className="h-4 w-4" /> Meus Pedidos</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer gap-2 text-destructive focus:text-destructive" onClick={() => signOut()}><LogOut className="h-4 w-4" /> Sair</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/conta/login">
                <Button size="sm" variant="outline" className="gap-1.5 bg-transparent border-brand-gold/60 text-brand-gold hover:bg-brand-gold hover:text-brand-gold-foreground hover:border-brand-gold transition-colors duration-200"><User className="h-4 w-4" /> Entrar</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <CatalogBanner />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6 relative z-20 pb-12 space-y-6">
        <PromoHighlights items={inventoryData} onAddToCart={addToCart} isFavorite={isFavorite} onToggleFavorite={(id) => toggleFavorite.mutate(id)} isLoggedIn={!!user} />

        <Tabs defaultValue="drops" className="w-full">
          <TabsList className="w-full max-w-md mx-auto mb-6 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="drops" className="flex-1 font-display">Drops ({drops.length})</TabsTrigger>
            <TabsTrigger value="singles" className="flex-1 font-display">Singles ({singles.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="drops">
            <ItemGrid items={drops} onAddToCart={addToCart} isFavorite={isFavorite} onToggleFavorite={(id) => toggleFavorite.mutate(id)} isLoggedIn={!!user} userId={user?.id} />
          </TabsContent>
          <TabsContent value="singles">
            <ItemGrid items={singles} isSingles onAddToCart={addToCart} isFavorite={isFavorite} onToggleFavorite={(id) => toggleFavorite.mutate(id)} isLoggedIn={!!user} userId={user?.id} />
          </TabsContent>
        </Tabs>
      </div>

      <div ref={bottomSentinelRef} className="h-1 w-full" />

      {/* Social FABs */}
      <div className={`fixed bottom-6 left-6 z-40 flex flex-col gap-3 transition-all duration-500 ${fabsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <a href="https://www.instagram.com/scardtopia/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-accent/50 hover:shadow-accent/10 hover:shadow-xl transition-all duration-300">
          <Instagram className="h-5 w-5 text-accent" /> Instagram
        </a>
        <a href="https://wa.me/5511947154555?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20drops%20dispon%C3%ADveis." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-medium text-white shadow-lg shadow-success/20 hover:shadow-success/40 hover:shadow-xl hover:brightness-110 transition-all duration-300">
          <MessageCircle className="h-5 w-5" /> Pedir via WhatsApp
        </a>
      </div>

      <ShoppingCart items={cartItems} onAdd={addToCart} onRemove={removeFromCart} onClear={clearCart} onUpdateQty={updateCartQty} onOrderPlaced={handleOrderPlaced} fabsVisible={fabsVisible} />
    </div>
  );
};

export default Catalogo;
