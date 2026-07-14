import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks/use-inventory";
import { ArrowLeft, Loader2, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import ProductMedia from "@/components/ProductMedia";
import AddToCartButton from "@/components/AddToCartButton";
import { supabase } from "@/integrations/supabase/client";
import { fetchScryfallCard, pickBestImageUrl, type ScryfallCardData } from "@/lib/scryfall-cache";
import ManaCost from "@/components/ManaCost";
import useSEO from "@/hooks/use-seo";


const SingleDetail = () => {
  const { singleId } = useParams<{ singleId: string }>();
  const navigate = useNavigate();
  const { data: inventoryData = [], isLoading } = useInventory();
  const item = inventoryData.find((i) => i.id === singleId && i.product_type === "single");
  const [card, setCard] = useState<ScryfallCardData | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);


  useEffect(() => {
    if (!item) return;
    const parts = item.id.split("-");
    if (parts.length < 2) return;
    const set = parts[0]?.toLowerCase();
    const num = parts[1]?.toLowerCase();
    if (!set || !num) return;
    setLoadingCard(true);
    fetchScryfallCard(set, num, item.id)
      .then((data) => {
        setCard(data);
        if (data && data._imageQuality && data._imageQuality !== "high") {
          try {
            supabase.from("analytics_events").insert({
              event_type: "scryfall_low_quality_image",
              inventory_item_id: item.id,
              item_name: item.name,
              category: item.category,
              metadata: { quality: data._imageQuality, set, num } as any,
            } as any);
          } catch {}
        }
      })
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
  // Desconto aplica SOMENTE ao PIX. Cartão permanece com valor cheio.
  const cardPrice = item.price;
  const pixBase = (item.price_pix ?? 0) > 0 ? (item.price_pix as number) : item.price;
  const pixFinal = Math.max(0, pixBase * (1 - discount / 100));
  const hasPixHighlight = pixFinal < cardPrice;
  const displayName = card?.printed_name || card?.name || item.name;
  const displayType = card?.printed_type_line || card?.type_line || "";
  const displayText = card?.printed_text || card?.oracle_text || "";
  const bestImage = pickBestImageUrl(card?.image_uris, item.image_url);

  const canonical = `https://www.spencerscardtopia.com.br/single/${item.id}`;
  const availability = item.quantity <= 0 ? "OutOfStock" : "InStock";
  const seoDesc = card?.printed_text || card?.oracle_text
    ? `${displayName} (${card?.set_name ?? ""}${card?.collector_number ? ` #${card.collector_number}` : ""}) — ${item.description} ${item.language ?? ""} ${item.condition ?? ""}. Disponível na Spencer's Cardtopia.`
    : `${displayName} — Magic: The Gathering single (${item.description}${item.language ? `, ${item.language}` : ""}${item.condition ? `, ${item.condition}` : ""}) na Spencer's Cardtopia.`;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSEO({
    title: displayName,
    description: seoDesc,
    canonical,
    image: bestImage || item.image_url,
    type: "product",
    product: {
      name: displayName,
      price: pixFinal,
      currency: "BRL",
      availability,
      image: bestImage || item.image_url,
      description: seoDesc,
      sku: item.id,
      category: card?.set_name || item.category || "Magic: The Gathering",
      brand: "Magic: The Gathering",
    },
  });

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="sticky top-0 z-40 border-b border-brand-header-border bg-brand-header backdrop-blur-xl shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/"><img src={logo} alt="Spencer's Cardtopia" className="h-9 hover:scale-105 transition-transform" /></Link>
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
        {/* Fixed-aspect container prevents layout shift between low/high-res versions */}
        <div className="w-full max-w-[420px] mx-auto">
          {loadingCard && !bestImage ? (
            <div className="rounded-2xl overflow-hidden border border-border/40 bg-muted/20 relative aspect-[2.5/3.5] w-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ProductMedia
              src={bestImage}
              alt={displayName}
              itemId={item.id}
              itemName={item.name}
              category={item.category}
              className="rounded-2xl border border-border/40 aspect-[2.5/3.5] w-full"
              imageClassName="absolute inset-0 w-full h-full object-contain"
            />
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
                  <ManaCost cost={card.mana_cost} className="text-base mt-1" />
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
            {hasPixHighlight ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold text-success font-display">R$ {pixFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <Badge className="bg-success/10 text-success border-success/30">💰 PIX{discount > 0 ? ` · -${discount}%` : ""}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">💳 Cartão: R$ {cardPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            ) : (
              <span className="text-3xl font-bold text-gradient">R$ {cardPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            )}
            <p className="text-sm text-muted-foreground">{item.quantity <= 0 ? "Esgotado" : `📦 ${item.quantity} em estoque`}</p>
          </div>

          <AddToCartButton item={item} />

        </div>
      </div>
    </div>
  );
};

export default SingleDetail;
