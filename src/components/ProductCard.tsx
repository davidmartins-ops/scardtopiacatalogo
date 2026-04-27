import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart, Plus, Share2, Bell, Star, Flame,
  Sparkles, Circle, Rainbow, MessageCircle,
  Twitter, Instagram, Copy, Search as SearchIcon, Package, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ImageZoom from "@/components/ImageZoom";
import { type InventoryItem } from "@/data/inventory";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const descriptionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30" },
  "Surge Foil": { label: "Surge Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
  "Holo Foil": { label: "Holo Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Galaxy Foil": { label: "Galaxy Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30" },
  "Confetti Foil": { label: "Confetti Foil", icon: Sparkles, className: "bg-accent/15 text-accent border-accent/30" },
  "Etched Foil": { label: "Etched Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30" },
  "Silver Scroll": { label: "Silver Scroll", icon: Sparkles, className: "bg-muted/40 text-foreground border-border" },
};

// Session-scoped tracking: avoid duplicate views per item per session
const SESSION_VIEWED = new Set<string>();
const getSessionId = () => {
  let id = sessionStorage.getItem("analytics_session");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("analytics_session", id); }
  return id;
};
const trackEvent = async (eventType: string, item: InventoryItem) => {
  // LGPD: only record analytics when user has given consent
  const { hasAnalyticsConsent } = await import("@/lib/consent");
  if (!hasAnalyticsConsent()) return;
  try {
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      inventory_item_id: item.id,
      item_name: item.name,
      category: item.category,
      session_id: getSessionId(),
    } as any);
  } catch {}
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const shareItem = async (item: InventoryItem, method: "whatsapp" | "twitter" | "instagram" | "copy") => {
  const discount = item.discount ?? 0;
  const priceCard = Math.max(0, item.price * (1 - discount / 100));
  const priceCardStr = formatBRL(priceCard);
  const rawPix = Number(item.price_pix ?? 0);
  const hasPix = rawPix > 0 && rawPix !== priceCard;
  const pricePix = hasPix ? rawPix : 0;
  const pricePixStr = hasPix ? formatBRL(pricePix) : "";

  const priceLines = hasPix
    ? `Valor Cartão: ${priceCardStr}\nValor PIX: ${pricePixStr}`
    : `Valor Cartão: ${priceCardStr}`;

  const text = `${item.name}\n${priceLines}\n${item.description}${item.language ? ` | ${item.language}` : ""}${item.condition ? ` | ${item.condition}` : ""}\n\nConfira no catalogo da Spencer's Cardtopia!`;
  const url = window.location.href;

  if (method === "copy") {
    if (navigator.share) {
      try { await navigator.share({ title: item.name, text, url }); return; } catch {}
    }
    navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success("Link copiado!");
    return;
  }

  const shareText = `${text}\n${url}`;
  if (method === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  else if (method === "twitter") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  else if (method === "instagram") { navigator.clipboard.writeText(shareText); toast.success("Texto copiado! Cole no seu Instagram Stories"); window.open("https://www.instagram.com/", "_blank"); }
  else { navigator.clipboard.writeText(shareText); toast.success("Link copiado!"); }
};

/* NotifyMe Dialog */
const NotifyMeDialog = ({ item, isLoggedIn, userId }: { item: InventoryItem; isLoggedIn: boolean; userId?: string }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNotify = async () => {
    if (!isLoggedIn || !userId) { toast.error("Faça login para receber notificações."); return; }
    setLoading(true);
    const { error } = await supabase.from("stock_notifications").insert({ user_id: userId, inventory_item_id: item.id } as any);
    setLoading(false);
    if (error) {
      if (error.code === "23505") toast.info("Você já está cadastrado para este produto!");
      else toast.error("Erro ao cadastrar notificação.");
      setOpen(false);
      return;
    }
    toast.success("Você será notificado quando o produto estiver disponível!");
    setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-10 text-[13px] sm:text-[14px] gap-1.5 border-primary/30 hover:border-primary/50 text-primary font-semibold transition-all duration-150 active:scale-[0.98]"
        onClick={() => { if (!isLoggedIn) { toast.error("Faça login para receber notificações."); return; } setOpen(true); }}
      >
        <Bell className="h-4 w-4" /> Me avise quando disponível!
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Receber Notificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Deseja ser notificado quando <strong className="text-foreground">{item.name}</strong> estiver disponível novamente?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleNotify} disabled={loading} className="gap-1.5"><Bell className="h-4 w-4" /> {loading ? "Cadastrando..." : "Me avise!"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* Skeleton Loading */
export const ProductCardSkeleton = ({ isSingle = false }: { isSingle?: boolean }) => (
  <div className="glass-card overflow-hidden">
    <div className="px-3 pt-3">
      <Skeleton className={`w-full ${isSingle ? "aspect-[2.5/3.5]" : "h-44 sm:h-48"} rounded-xl`} />
    </div>
    <div className="p-3 pt-2.5 space-y-2.5">
      <div className="min-h-[42px]">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded mt-1.5" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
      <div className="min-h-[110px] flex flex-col justify-start gap-2">
        <Skeleton className="h-7 w-28 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-4 w-24 rounded mt-1" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  </div>
);

/* Main Product Card */
interface ProductCardProps {
  item: InventoryItem;
  isSingle?: boolean;
  onAddToCart: (item: InventoryItem) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isLoggedIn: boolean;
  userId?: string;
}

const ProductCard = ({ item, isSingle, onAddToCart, isFavorite, onToggleFavorite, isLoggedIn, userId }: ProductCardProps) => {
  const config = descriptionConfig[item.description];
  const Icon = config?.icon ?? Circle;
  const discount = item.discount ?? 0;
  const finalPrice = item.price * (1 - discount / 100);
  const isOutOfStock = item.quantity <= 0;
  const cardRef = useRef<HTMLDivElement>(null);

  // Track product view once per session per item using IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el || SESSION_VIEWED.has(item.id)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !SESSION_VIEWED.has(item.id)) {
          SESSION_VIEWED.add(item.id);
          trackEvent("view", item);
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.id, item.name, item.category]);

  return (
    <div
      ref={cardRef}
      className={`group glass-card glow-hover overflow-hidden relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col h-full`}
    >
      {/* Discount badge - top left, prominent */}
      {discount > 0 && !isOutOfStock && (
        <div className="absolute top-2 left-2 z-30">
          <div className="bg-destructive text-destructive-foreground text-[11px] sm:text-[12px] font-bold px-2.5 py-1 rounded-lg shadow-lg">
            -{discount}%
          </div>
        </div>
      )}

      {/* Status Badge */}
      {item.status === "pre_sale" && (
        <div className="absolute top-2 left-2 z-30">
          <Badge className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 shadow-lg gap-1 animate-badge-glow">
            <Star className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} /> PRÉ VENDA
          </Badge>
        </div>
      )}
      {item.status === "launch" && (
        <div className="absolute top-2 left-2 z-30">
          <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-lg gap-1 animate-badge-glow-primary">
            <Flame className="h-3 w-3 animate-pulse" /> LANÇAMENTO
          </Badge>
        </div>
      )}

      {/* Favorite button */}
      <button
        className={`absolute top-2 right-2 z-30 h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-200 hover:scale-110 ${
          isFavorite ? "bg-destructive/90 text-destructive-foreground" : "bg-background/70 text-muted-foreground hover:text-destructive hover:bg-background/90 border border-border/50"
        }`}
        onClick={() => { if (!isLoggedIn) { toast.error("Faça login para favoritar."); return; } onToggleFavorite(); }}
      >
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
      </button>

      {/* Image - fixed height for consistent alignment */}
      <div className="relative z-10 px-3 pt-3">
        <div className={`overflow-hidden rounded-xl border border-border/40 bg-muted/20 relative ${isSingle ? "aspect-[2.5/3.5]" : "h-44 sm:h-48"}`}>
          {item.image_url ? (
            <ImageZoom
              src={item.image_url}
              alt={item.name}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${isOutOfStock ? "grayscale" : ""}`}
              containerClassName="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground bg-muted/10">
              <Package className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/40 z-20" />
          )}
        </div>
      </div>

      {/* Card Info - flex column with anchored bottom actions */}
      <div className="relative z-10 p-3 pt-2.5 space-y-1.5 flex flex-col flex-1">
        {/* Title */}
        <div className="min-h-[42px]">
          <h3 className="font-body font-semibold text-foreground leading-[1.3] text-[16px] sm:text-[17px] md:text-[18px] group-hover:text-primary transition-colors duration-300 line-clamp-2">
            {item.name}
          </h3>
        </div>

        {/* Foil badge */}
        <Badge variant="outline" className={`gap-1 text-[10px] w-fit ${config?.className ?? ""}`}>
          <Icon className="h-2.5 w-2.5" />
          {config?.label ?? item.description}
        </Badge>

        {/* Info block - standardized height */}
        <div className="min-h-[110px] flex flex-col justify-start pt-1">
          {isOutOfStock ? (
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-[13px] sm:text-[14px] text-muted-foreground font-medium">Indisponível</p>
            </div>
          ) : (
            <>
              {discount > 0 ? (
                <div className="space-y-0.5">
                  <span className="text-[24px] sm:text-[26px] md:text-[28px] font-bold text-primary font-display leading-none">
                    R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[13px] sm:text-[14px] text-muted-foreground line-through block">
                    R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[9px] text-muted-foreground italic">* Parcelamento s/ juros apenas para valores não promocionais</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-[24px] sm:text-[26px] md:text-[28px] font-bold text-primary font-display leading-none block">
                    R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  {(item.price_pix ?? 0) > 0 && (
                    <p className="text-[12px] sm:text-[13px] font-semibold text-success">
                      💰 PIX: R$ {(item.price_pix ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {!isSingle && item.price >= 50 && (
                    <p className="text-[12px] sm:text-[13px] text-muted-foreground">
                      💳 até 3x de R$ {(item.price / 3).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s/ juros
                    </p>
                  )}
                </div>
              )}
              <p className="text-[12px] sm:text-[13px] font-medium text-foreground/70 mt-1">
                {item.quantity === 1 ? "🔥 Última unidade!" : `📦 ${item.quantity} em estoque`}
              </p>
            </>
          )}
        </div>

        {/* Actions - anchored to bottom */}
        <div className="space-y-1.5 pt-1 mt-auto">
          {isOutOfStock ? (
            <NotifyMeDialog item={item} isLoggedIn={isLoggedIn} userId={userId} />
          ) : (
            <Button
              size="sm"
              variant="default"
              className="w-full h-10 text-[14px] sm:text-[15px] gap-1.5 font-semibold transition-all duration-150 active:scale-[0.98] hover:shadow-md"
              onClick={() => onAddToCart(item)}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          )}

          <div className="flex items-center gap-1.5">
            {isSingle ? (
              <Link to={`/catalogo/single/${encodeURIComponent(item.id)}`} className="flex-1" onClick={() => trackEvent("more_info_click", item)}>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-[12px] sm:text-[13px] text-primary hover:text-primary/80 font-medium border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 gap-1"
                >
                  🧐 Mais Informações
                </Button>
              </Link>
            ) : (
              <Link to={`/catalogo/drop/${item.id}`} className="flex-1" onClick={() => trackEvent("drop_content_click", item)}>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-[12px] sm:text-[13px] text-primary hover:text-primary/80 font-medium border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all duration-150"
                >
                  🔍 Conteúdo do Drop
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all duration-150 shrink-0">
                  <Share2 className="h-4 w-4" />
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
};

export default ProductCard;
