import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Loader2, ArrowLeft, RefreshCw, AlertTriangle,
  DollarSign, Search, ArrowUpDown, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import useSEO from "@/hooks/use-seo";
import logo from "@/assets/logo.png";

interface ScryfallCard {
  name: string; id: string;
  image_uris?: { normal: string; small: string };
  card_faces?: { image_uris?: { normal: string; small: string } }[];
  prices: { usd?: string; usd_foil?: string };
  set_name: string; set: string; collector_number: string; rarity: string;
  uri: string; scryfall_uri: string;
}

interface CardWithChange extends ScryfallCard {
  priceChange?: number; priceChangePct?: number; previousPrice?: number;
}

interface FormatData { rising: CardWithChange[]; falling: CardWithChange[]; }

const EXCHANGE_API = "https://economia.awesomeapi.com.br/last/USD-BRL";

const FORMAT_QUERIES: Record<string, { rising: string; falling: string; label: string }> = {
  standard: { rising: "https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>5+f:standard&unique=cards&page=1", falling: "https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+r>=rare+f:standard&unique=cards&page=1", label: "Standard" },
  pauper: { rising: "https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>0.5+f:pauper&unique=cards&page=1", falling: "https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+f:pauper&unique=cards&page=1", label: "Pauper" },
  commander: { rising: "https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>5+f:commander&unique=cards&page=1", falling: "https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+r>=rare+f:commander&unique=cards&page=1", label: "Commander" },
  legacy: { rising: "https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>5+f:legacy&unique=cards&page=1", falling: "https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+r>=rare+f:legacy&unique=cards&page=1", label: "Legacy" },
  modern: { rising: "https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>5+f:modern&unique=cards&page=1", falling: "https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+r>=rare+f:modern&unique=cards&page=1", label: "Modern" },
};

const TrendingCards = () => {
  const [formatData, setFormatData] = useState<Record<string, FormatData>>({});
  const [activeFormat, setActiveFormat] = useState("standard");
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"pct_desc" | "pct_asc">("pct_desc");

  useSEO({
    title: "Tendências Magic — Cartas em alta e em baixa",
    description: "Top 50 cartas de Magic: The Gathering com maiores variações de preço em Standard, Modern, Commander, Legacy e Pauper. Dados atualizados via Scryfall.",
    canonical: "https://www.spencerscardtopia.com.br/tendencias",
  });
  const fetchExchangeRate = async () => {
    try { const res = await fetch(EXCHANGE_API); const data = await res.json(); if (data?.USDBRL?.bid) setExchangeRate(parseFloat(data.USDBRL.bid)); } catch { setExchangeRate(null); }
  };

  const fetchPriceHistory = async (cards: ScryfallCard[], format: string): Promise<Map<string, number>> => {
    const priceMap = new Map<string, number>();
    try {
      const scryfallIds = cards.map((c) => c.id).filter(Boolean);
      if (scryfallIds.length === 0) return priceMap;
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const { data } = await supabase.from("price_history").select("scryfall_id, price_usd").in("scryfall_id", scryfallIds).eq("format", format).lte("captured_at", yesterdayStr).order("captured_at", { ascending: false });
      if (data) {
        const seen = new Set<string>();
        for (const row of data) {
          if (row.scryfall_id && !seen.has(row.scryfall_id) && row.price_usd != null) { priceMap.set(row.scryfall_id, Number(row.price_usd)); seen.add(row.scryfall_id); }
        }
      }
    } catch {}
    return priceMap;
  };

  const fetchFormatCards = async (format: string) => {
    const q = FORMAT_QUERIES[format]; if (!q) return;
    setLoading(true);
    try {
      if (!exchangeRate) await fetchExchangeRate();
      const risingRes = await fetch(q.rising); const risingData = await risingRes.json();
      const risingList: ScryfallCard[] = (risingData.data ?? []).slice(0, 54);
      await new Promise((r) => setTimeout(r, 150));
      const fallingRes = await fetch(q.falling); const fallingData = await fallingRes.json();
      const fallingList: ScryfallCard[] = (fallingData.data ?? []).slice(0, 54);

      const allCards = [...risingList, ...fallingList];
      const historyMap = await fetchPriceHistory(allCards, format);

      const enrichCards = (cards: ScryfallCard[]): CardWithChange[] => {
        return cards.map((card) => {
          const currentPrice = parseFloat(card.prices.usd ?? card.prices.usd_foil ?? "0");
          const previousPrice = historyMap.get(card.id);
          const priceChange = previousPrice != null ? currentPrice - previousPrice : undefined;
          const priceChangePct = previousPrice != null && previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : undefined;
          return { ...card, priceChange, priceChangePct, previousPrice };
        });
      };

      const enrichedRising = enrichCards(risingList);
      const enrichedFalling = enrichCards(fallingList);

      // Sort by percentage change
      enrichedRising.sort((a, b) => (b.priceChangePct ?? 0) - (a.priceChangePct ?? 0));
      enrichedFalling.sort((a, b) => (a.priceChangePct ?? 0) - (b.priceChangePct ?? 0));

      setFormatData((prev) => ({ ...prev, [format]: { rising: enrichedRising, falling: enrichedFalling } }));
      setLastUpdate(new Date());
    } catch (err) { console.error("Error fetching trending cards:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExchangeRate(); fetchFormatCards("standard"); }, []);
  useEffect(() => { if (!formatData[activeFormat]) fetchFormatCards(activeFormat); }, [activeFormat]);

  const currentData = formatData[activeFormat] ?? { rising: [], falling: [] };

  const getPrice = (card: ScryfallCard) => { const p = card.prices.usd ?? card.prices.usd_foil; return p ? parseFloat(p) : 0; };

  const applyFilterAndSort = (cards: CardWithChange[], type: "rising" | "falling") => {
    let filtered = cards;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(q) || c.set_name.toLowerCase().includes(q));
    }
    // CORREÇÃO 28.2: hard split by sign of variation. Zeros and missing data are excluded from both tabs.
    if (type === "rising") {
      filtered = filtered.filter((c) => (c.priceChangePct ?? 0) > 0);
      return [...filtered].sort((a, b) => {
        const aPct = a.priceChangePct ?? 0;
        const bPct = b.priceChangePct ?? 0;
        return sortOrder === "pct_desc" ? bPct - aPct : aPct - bPct;
      });
    } else {
      filtered = filtered.filter((c) => (c.priceChangePct ?? 0) < 0);
      return [...filtered].sort((a, b) => {
        const aPct = a.priceChangePct ?? 0;
        const bPct = b.priceChangePct ?? 0;
        // "desc" = biggest fall first (most negative). "asc" = smallest fall first (closer to 0).
        return sortOrder === "pct_desc" ? aPct - bPct : bPct - aPct;
      });
    }
  };

  // CORREÇÃO 28.2: union the rising+falling pools so a card with negative variation
  // accidentally returned by the "rising" Scryfall query still ends up in the correct tab.
  const allCards = useMemo(
    () => [...currentData.rising, ...currentData.falling],
    [currentData.rising, currentData.falling],
  );
  const filteredRising = useMemo(() => applyFilterAndSort(allCards, "rising"), [allCards, search, sortOrder]);
  const filteredFalling = useMemo(() => applyFilterAndSort(allCards, "falling"), [allCards, search, sortOrder]);

  const getImage = (card: ScryfallCard) => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
    return null;
  };

  const formatUSD = (val: string | undefined) => { if (!val) return "N/A"; return `$ ${parseFloat(val).toFixed(2)}`; };

  const formatBRL = (val: string | undefined) => {
    if (!val || !exchangeRate) return "—";
    const brl = parseFloat(val) * exchangeRate;
    return `R$ ${brl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rarityColor = (rarity: string) => {
    switch (rarity) { case "mythic": return "text-orange-500"; case "rare": return "text-yellow-500"; default: return "text-muted-foreground"; }
  };

  const PriceDistributionChart = ({ cards, type }: { cards: ScryfallCard[]; type: "rising" | "falling" }) => {
    const chartData = useMemo(() => {
      const ranges = [
        { label: "$0-5", min: 0, max: 5 }, { label: "$5-10", min: 5, max: 10 },
        { label: "$10-25", min: 10, max: 25 }, { label: "$25-50", min: 25, max: 50 },
        { label: "$50-100", min: 50, max: 100 }, { label: "$100+", min: 100, max: Infinity },
      ];
      return ranges.map((r) => ({ range: r.label, count: cards.filter((c) => { const p = getPrice(c); return p >= r.min && p < r.max; }).length })).filter((d) => d.count > 0);
    }, [cards]);

    if (chartData.length === 0) return null;
    const gradientId = `bar-gradient-${type}`;
    const colorStart = type === "rising" ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)";
    const colorEnd = type === "rising" ? "hsl(142, 60%, 30%)" : "hsl(0, 50%, 35%)";
    const maxCount = Math.max(...chartData.map((d) => d.count));

    return (
      <div className="glass-card p-4 sm:p-6 mb-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-display font-semibold text-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" /><span className="text-gradient">Distribuição de Preços</span></h2>
          <span className="text-[10px] text-muted-foreground">{cards.length} cartas</span>
        </div>
        <div className="premium-divider mb-4" />
        <div className="h-52 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colorStart} stopOpacity={0.95} /><stop offset="100%" stopColor={colorEnd} stopOpacity={0.6} /></linearGradient></defs>
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: "hsl(var(--foreground))", fontFamily: "'Cinzel', serif" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontFamily: "'Open Sans', sans-serif", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", padding: "10px 14px" }} labelStyle={{ color: "hsl(var(--primary))", fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 600, marginBottom: 6 }} itemStyle={{ color: "hsl(var(--foreground))", fontSize: 12 }} formatter={(value: number) => [`${value} carta${value !== 1 ? "s" : ""}`, "Quantidade"]} />
              <Bar dataKey="count" name="Cartas" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData.map((entry, i) => (<Cell key={i} fill={`url(#${gradientId})`} opacity={0.6 + (entry.count / maxCount) * 0.4} stroke={colorStart} strokeWidth={1} strokeOpacity={0.3} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const CardList = ({ cards, type }: { cards: CardWithChange[]; type: "rising" | "falling" }) => {
    const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());

    useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { const idx = Number(entry.target.getAttribute("data-idx")); setVisibleCards((prev) => new Set(prev).add(idx)); observer.unobserve(entry.target); }
        });
      }, { threshold: 0.1, rootMargin: "50px" });
      const elements = document.querySelectorAll(`[data-card-type="${type}"]`);
      elements.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    }, [cards, type]);

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {cards.map((card, idx) => {
          const img = getImage(card);
          const price = card.prices.usd ?? card.prices.usd_foil;
          const isVisible = visibleCards.has(idx);
          const hasPctChange = card.priceChangePct != null;
          const pctValue = card.priceChangePct ?? 0;
          const isPositive = pctValue >= 0;
          const changeStr = hasPctChange ? `${isPositive ? "+" : ""}${pctValue.toFixed(1)}%` : null;

          return (
            <a key={`${card.name}-${idx}`} href={card.scryfall_uri} target="_blank" rel="noopener noreferrer"
              data-idx={idx} data-card-type={type}
              className={`group glass-card overflow-hidden glow-hover transition-all duration-500 hover:scale-[1.02] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{ transitionDelay: `${Math.min(idx % 12, 8) * 60}ms` }}>
              <div className="relative">
                <div className="absolute top-1.5 left-1.5 z-10">
                  <Badge className="text-[10px] font-bold px-1.5 py-0.5 bg-foreground/80 text-background">#{idx + 1}</Badge>
                </div>
                {changeStr && (
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <Badge className={`text-[10px] font-bold px-2 py-0.5 ${isPositive ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                      {isPositive ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                      {changeStr}
                    </Badge>
                  </div>
                )}
                {img ? (
                  <img src={img} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[2.5/3.5] bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <h3 className="text-xs font-medium text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{card.name}</h3>
                <p className="text-[10px] text-muted-foreground truncate">{card.set_name}</p>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className={`text-sm font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>{formatUSD(price)}</span>
                    <span className="block text-[10px] text-muted-foreground">{formatBRL(price)}</span>
                    {card.previousPrice != null && (
                      <span className="block text-[9px] text-muted-foreground">Anterior: ${card.previousPrice.toFixed(2)}</span>
                    )}
                  </div>
                  {isPositive ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
                </div>
                <Badge variant="outline" className={`text-[9px] ${rarityColor(card.rarity)}`}>{card.rarity}</Badge>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="sticky top-0 z-40 border-b border-brand-header-border bg-brand-header backdrop-blur-xl shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/catalogo" aria-label="Voltar para o catálogo"><Button variant="ghost" size="icon" className="h-8 w-8 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200" aria-label="Voltar para o catálogo"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Button></Link>
            <Link to="/catalogo"><img src={logo} alt="Spencer's Cardtopia" className="h-8 hover:scale-105 transition-transform" /></Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/catalogo"><Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold text-xs transition-colors duration-200">Catálogo</Button></Link>
            <Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold text-xs transition-colors duration-200" onClick={() => fetchFormatCards(activeFormat)} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center justify-center gap-2" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}>
            <TrendingUp className="h-6 w-6 text-green-600" />
            <span className="text-gradient">Tendências de Mercado</span>
            <TrendingDown className="h-6 w-6 text-red-600" />
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">Top 50 cartas — variações percentuais ordenadas da maior para a menor</p>
          {lastUpdate && <p className="text-[11px] text-muted-foreground">Atualizado em {lastUpdate.toLocaleString("pt-BR")}</p>}
        </div>

        <div className="glass-card p-3 sm:p-4 space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin sm:justify-center px-1">
            {Object.entries(FORMAT_QUERIES).map(([key, val]) => (
              <Button key={key} variant={activeFormat === key ? "default" : "outline"} size="sm" className="text-xs shrink-0" onClick={() => setActiveFormat(key)}>{val.label}</Button>
            ))}
          </div>
          <div className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou coleção..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/30 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-colors" />
            </div>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
              <SelectTrigger className="w-[160px] sm:w-[180px] bg-muted/30 border-border/50"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pct_desc">Maior variação %</SelectItem>
                <SelectItem value="pct_asc">Menor variação %</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="glass-card p-3 flex items-start gap-2 border-primary/20 flex-1">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground"><strong className="text-foreground">Aviso:</strong> Valores em USD (Scryfall). Conversão BRL é <strong>ilustrativa</strong>. Variações % calculadas com base no histórico registrado.</p>
          </div>
          {exchangeRate && (
            <div className="glass-card p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground shrink-0">
              <DollarSign className="h-3.5 w-3.5 text-primary" />1 USD = R$ {exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="rising" className="w-full">
            <TabsList className="w-full max-w-md mx-auto mb-5 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="rising" className="flex-1 font-display gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> 📈 Em Alta ({filteredRising.length})</TabsTrigger>
              <TabsTrigger value="falling" className="flex-1 font-display gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> 📉 Em Baixa ({filteredFalling.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="rising" className="space-y-5">
              <PriceDistributionChart cards={filteredRising} type="rising" />
              <CardList cards={filteredRising} type="rising" />
            </TabsContent>
            <TabsContent value="falling" className="space-y-5">
              <PriceDistributionChart cards={filteredFalling} type="falling" />
              <CardList cards={filteredFalling} type="falling" />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default TrendingCards;
