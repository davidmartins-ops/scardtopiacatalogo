import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks/use-inventory";
import { ArrowLeft, Loader2, Package, Sparkles, Plus, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import ImageZoom from "@/components/ImageZoom";
import { supabase } from "@/integrations/supabase/client";
import { fetchScryfallCard, pickBestImageUrl, type ScryfallCardData } from "@/lib/scryfall-cache";
import ManaCost from "@/components/ManaCost";
import { toast } from "sonner";

const SingleDetail = () => {
  const { singleId } = useParams<{ singleId: string }>();
  const navigate = useNavigate();
  const { data: inventoryData = [], isLoading } = useInventory();
  const item = inventoryData.find((i) => i.id === singleId && i.product_type === "single");
  const [card, setCard] = useState<ScryfallCardData | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

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
  const finalPrice = item.price * (1 - discount / 100);
  const displayName = card?.printed_name || card?.name || item.name;
  const displayType = card?.printed_type_line || card?.type_line || "";
  const displayText = card?.printed_text || card?.oracle_text || "";
  const bestImage = pickBestImageUrl(card?.image_uris, item.image_url);

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
        {/* Fixed-aspect container prevents layout shift between low/high-res versions */}
        <div className="rounded-2xl overflow-hidden border border-border/40 bg-muted/20 relative aspect-[2.5/3.5] w-full max-w-[420px] mx-auto">
          {bestImage && !imgError ? (
            <>
              <ImageZoom
                src={bestImage}
                alt={displayName}
                className="absolute inset-0 w-full h-full object-contain"
                containerClassName="absolute inset-0"
                onLoad={() => setImgLoaded(true)}
                onError={async () => {
                  setImgError(true);
                  // Diagnostic: try to determine cause (network/CORS/4xx/5xx)
                  let diagnosis = "unknown";
                  try {
                    if (!bestImage) diagnosis = "empty_src";
                    else {
                      const res = await fetch(bestImage, { method: "HEAD", mode: "cors" });
                      diagnosis = `http_${res.status}`;
                    }
                  } catch (e) {
                    diagnosis = `network_or_cors:${(e as Error).message}`;
                  }
                  console.warn("[SingleDetail] image failed", { src: bestImage, id: item.id, diagnosis });
                  try {
                    supabase.from("analytics_events").insert({
                      event_type: "image_load_error",
                      inventory_item_id: item.id,
                      item_name: item.name,
                      category: item.category,
                      metadata: { src: bestImage, diagnosis } as any,
                    } as any);
                  } catch {}
                }}
              />
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </>
          ) : imgError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
              <ImageOff className="h-10 w-10" />
              <p className="text-xs">Não foi possível carregar a imagem.</p>
            </div>
          ) : loadingCard ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Package className="h-12 w-12" />
              <p className="text-xs">Sem imagem cadastrada</p>
            </div>
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

          <Button
            size="lg"
            className="w-full gap-2 font-semibold min-h-[44px]"
            disabled={item.quantity <= 0 || addingToCart}
            aria-busy={addingToCart}
            onClick={() => {
              setAddingToCart(true);
              try {
                const raw = localStorage.getItem("spencer_guest_cart");
                const current = raw ? (JSON.parse(raw) as { inventory_item_id: string; quantity: number }[]) : [];
                const idx = current.findIndex((c) => c.inventory_item_id === item.id);
                if (idx >= 0) {
                  if (current[idx].quantity >= item.quantity) {
                    toast.error("Quantidade máxima atingida.");
                    setAddingToCart(false);
                    return;
                  }
                  current[idx].quantity += 1;
                } else {
                  current.push({ inventory_item_id: item.id, quantity: 1 });
                }
                localStorage.setItem("spencer_guest_cart", JSON.stringify(current));
                toast.success(`${item.name} adicionado ao carrinho!`);
                setTimeout(() => navigate("/catalogo"), 250);
              } catch {
                toast.error("Não foi possível adicionar ao carrinho.");
                setAddingToCart(false);
              }
            }}
          >
            {addingToCart ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            {item.quantity <= 0 ? "Esgotado" : addingToCart ? "Adicionando..." : "Adicionar ao carrinho"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SingleDetail;
