import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks/use-inventory";
import { ArrowLeft, Loader2, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import ImageZoom from "@/components/ImageZoom";
import { extractSetCode } from "@/hooks/use-mtg-sets";
import { supabase } from "@/integrations/supabase/client";

interface ScryfallCard {
  name: string;
  printed_name?: string;
  mana_cost?: string;
  type_line?: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set_name?: string;
  collector_number?: string;
  image_uris?: { normal?: string; large?: string; png?: string; border_crop?: string };
  prices?: { usd?: string | null; usd_foil?: string | null };
}

const SingleDetail = () => {
  const { singleId } = useParams<{ singleId: string }>();
  const navigate = useNavigate();
  const { data: inventoryData = [], isLoading } = useInventory();
  const item = inventoryData.find((i) => i.id === singleId && i.product_type === "single");
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  useEffect(() => {
    if (!item) return;
    const parts = item.id.split("-");
    if (parts.length < 2) return;
    const set = parts[0]?.toLowerCase();
    const num = parts[1]?.toLowerCase();
    if (!set || !num) return;
    setLoadingCard(true);
    // Try to fetch in PT first; fallback to default
    fetch(`https://api.scryfall.com/cards/${set}/${num}/pt`)
      .then((r) => (r.ok ? r.json() : fetch(`https://api.scryfall.com/cards/${set}/${num}`).then((r2) => r2.json())))
      .then((data) => setCard(data))
      .catch(() => setCard(null))
      .finally(() => setLoadingCard(false));

    // Track view
    try {
      const sid = sessionStorage.getItem("analytics_session") || (() => { const id = crypto.randomUUID(); sessionStorage.setItem("analytics_session", id); return id; })();
      supabase.from("analytics_events").insert({
        event_type: "single_detail_view",
        inventory_item_id: item.id,
        item_name: item.name,
        category: item.category,
        session_id: sid,
      } as any);
    } catch {}
  }, [item?.id]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Single não encontrada.</p>
        <Link to="/catalogo"><Button variant="outline">Voltar ao catálogo</Button></Link>
      </div>
    );
  }

  const discount = item.discount ?? 0;
  const finalPrice = item.price * (1 - discount / 100);
  const displayName = card?.printed_name || card?.name || item.name;
  const displayType = card?.printed_type_line || card?.type_line || "";
  const displayText = card?.printed_text || card?.oracle_text || "";

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="sticky top-0 z-40 border-b border-brand-header-border bg-brand-header backdrop-blur-xl shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/catalogo"><img src={logo} alt="Spencer's Cardtopia" className="h-9 hover:scale-105 transition-transform" /></Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/catalogo"))}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl overflow-hidden border border-border/40 bg-muted/20">
          {(card?.image_uris?.png || card?.image_uris?.large || card?.image_uris?.normal || item.image_url) ? (
            <ImageZoom
              src={card?.image_uris?.png || card?.image_uris?.large || card?.image_uris?.normal || item.image_url!}
              alt={displayName}
              className="w-full h-auto object-contain"
              containerClassName="w-full"
            />
          ) : (
            <div className="aspect-[2.5/3.5] flex items-center justify-center text-muted-foreground"><Package className="h-12 w-12" /></div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient" style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif" }}>{displayName}</h1>
            {card?.name && card.name !== displayName && <p className="text-xs text-muted-foreground italic mt-1">{card.name}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-foil/15 text-foil border-foil/30 gap-1"><Sparkles className="h-3 w-3" />{item.description}</Badge>
            {item.language && <Badge variant="outline">{item.language}</Badge>}
            {item.condition && <Badge variant="outline">{item.condition}</Badge>}
            {card?.rarity && <Badge variant="outline" className="capitalize">{card.rarity}</Badge>}
            {card?.set_name && <Badge variant="outline">{card.set_name}{card.collector_number ? ` #${card.collector_number}` : ""}</Badge>}
          </div>

          {loadingCard ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando informações da carta...</div>
          ) : card ? (
            <div className="glass-card p-4 rounded-xl space-y-3">
              {card.mana_cost && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Custo de Mana</p>
                  <p className="text-lg font-mono text-foreground">{card.mana_cost}</p>
                </div>
              )}
              {displayType && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</p>
                  <p className="text-sm text-foreground">{displayType}</p>
                </div>
              )}
              {displayText && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Texto / Regras</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{displayText}</p>
                </div>
              )}
              {(card.power || card.toughness) && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Poder / Resistência</p>
                  <p className="text-sm text-foreground">{card.power}/{card.toughness}</p>
                </div>
              )}
              {card.loyalty && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Lealdade</p>
                  <p className="text-sm text-foreground">{card.loyalty}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Informações detalhadas da carta indisponíveis.</p>
          )}

          <div className="space-y-1">
            {discount > 0 ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-lg text-muted-foreground line-through">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span className="text-3xl font-bold text-gradient">R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <Badge className="bg-destructive/10 text-destructive border-destructive/30">-{discount}%</Badge>
              </div>
            ) : (
              <span className="text-3xl font-bold text-gradient">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            )}
            {(item.price_pix ?? 0) > 0 && <p className="text-sm font-semibold text-success">💰 PIX: R$ {(item.price_pix ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
            <p className="text-sm text-muted-foreground">{item.quantity <= 0 ? "Esgotado" : `📦 ${item.quantity} em estoque`}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleDetail;
