import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Loader2, ArrowLeft, RefreshCw, AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import logo from "@/assets/logo.png";

interface ScryfallCard {
  name: string;
  image_uris?: { normal: string; small: string };
  card_faces?: { image_uris?: { normal: string; small: string } }[];
  prices: { usd?: string; usd_foil?: string };
  set_name: string;
  rarity: string;
  uri: string;
  scryfall_uri: string;
}

const EXCHANGE_API = "https://economia.awesomeapi.com.br/last/USD-BRL";

const TrendingCards = () => {
  const [risingCards, setRisingCards] = useState<ScryfallCard[]>([]);
  const [fallingCards, setFallingCards] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch(EXCHANGE_API);
      const data = await res.json();
      if (data?.USDBRL?.bid) {
        setExchangeRate(parseFloat(data.USDBRL.bid));
      }
    } catch {
      setExchangeRate(null);
    }
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      await fetchExchangeRate();

      // Fetch expensive cards (trending high) - most expensive standard cards
      const risingRes = await fetch("https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>5+f:standard&unique=cards&page=1");
      const risingData = await risingRes.json();
      const risingList: ScryfallCard[] = (risingData.data ?? []).slice(0, 50);

      // Small delay to respect Scryfall rate limit
      await new Promise(r => setTimeout(r, 150));

      // Fetch cheap cards (trending low) - cheapest rares/mythics
      const fallingRes = await fetch("https://api.scryfall.com/cards/search?order=usd&dir=asc&q=usd>0+r>=rare+f:standard&unique=cards&page=1");
      const fallingData = await fallingRes.json();
      const fallingList: ScryfallCard[] = (fallingData.data ?? []).slice(0, 50);

      setRisingCards(risingList);
      setFallingCards(fallingList);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error fetching trending cards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const getImage = (card: ScryfallCard) => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
    return null;
  };

  const getSmallImage = (card: ScryfallCard) => {
    if (card.image_uris?.small) return card.image_uris.small;
    if (card.card_faces?.[0]?.image_uris?.small) return card.card_faces[0].image_uris.small;
    return null;
  };

  const formatUSD = (val: string | undefined) => {
    if (!val) return "N/A";
    return `$ ${parseFloat(val).toFixed(2)}`;
  };

  const formatBRL = (val: string | undefined) => {
    if (!val || !exchangeRate) return "—";
    const brl = parseFloat(val) * exchangeRate;
    return `R$ ${brl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rarityColor = (rarity: string) => {
    switch (rarity) {
      case "mythic": return "text-orange-400";
      case "rare": return "text-yellow-400";
      case "uncommon": return "text-slate-300";
      default: return "text-muted-foreground";
    }
  };

  const CardList = ({ cards, type }: { cards: ScryfallCard[]; type: "rising" | "falling" }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card, idx) => {
        const img = getSmallImage(card);
        const price = card.prices.usd ?? card.prices.usd_foil;
        return (
          <a
            key={`${card.name}-${idx}`}
            href={card.scryfall_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="group glass-card overflow-hidden glow-hover transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="relative">
              <div className="absolute top-1.5 left-1.5 z-10">
                <Badge className={`text-[10px] font-bold px-1.5 py-0.5 ${type === "rising" ? "bg-green-600/90 text-green-50" : "bg-red-600/90 text-red-50"}`}>
                  #{idx + 1}
                </Badge>
              </div>
              {img ? (
                <img src={img} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" loading="lazy" />
              ) : (
                <div className="w-full aspect-[2.5/3.5] bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                  Sem imagem
                </div>
              )}
            </div>
            <div className="p-2.5 space-y-1">
              <h3 className="text-xs font-medium text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {card.name}
              </h3>
              <p className="text-[10px] text-muted-foreground truncate">{card.set_name}</p>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className={`text-sm font-bold ${type === "rising" ? "text-green-400" : "text-red-400"}`}>
                    {formatUSD(price)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{formatBRL(price)}</span>
                </div>
                {type === "rising" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
              </div>
              <Badge variant="outline" className={`text-[9px] ${rarityColor(card.rarity)}`}>
                {card.rarity}
              </Badge>
            </div>
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/catalogo">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <img src={logo} alt="Spencer's Cardtopia" className="h-8 hover:scale-105 transition-transform" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/catalogo">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs">
                Catálogo
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs" onClick={fetchCards} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-400" />
            Tendências de Mercado
            <TrendingDown className="h-6 w-6 text-red-400" />
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Top 50 cartas em alta e em baixa no formato Standard — valores atualizados via Scryfall
          </p>
          {lastUpdate && (
            <p className="text-[11px] text-muted-foreground">
              Atualizado em {lastUpdate.toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <div className="glass-card p-3 flex items-start gap-2 border-yellow-500/30 max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Aviso:</strong> Os valores são em dólar americano (USD) obtidos do Scryfall. 
            A conversão para Real (BRL) é <strong>ilustrativa</strong>, baseada na cotação atual, e pode não refletir o preço real de mercado no Brasil.
          </p>
        </div>

        {/* Exchange rate info */}
        {exchangeRate && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            Cotação: 1 USD = R$ {exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="rising" className="w-full">
            <TabsList className="w-full max-w-md mx-auto mb-6 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="rising" className="flex-1 font-display gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Em Alta ({risingCards.length})
              </TabsTrigger>
              <TabsTrigger value="falling" className="flex-1 font-display gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Em Baixa ({fallingCards.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rising">
              <CardList cards={risingCards} type="rising" />
            </TabsContent>
            <TabsContent value="falling">
              <CardList cards={fallingCards} type="falling" />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default TrendingCards;
