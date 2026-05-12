import { useParams, Link, useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks/use-inventory";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Sparkles, Circle, Rainbow, Share2, MessageCircle, Twitter, Instagram, Copy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";
import ImageZoom from "@/components/ImageZoom";
import { toast } from "sonner";

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

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const sharePage = async (
  name: string,
  method: "whatsapp" | "twitter" | "instagram" | "copy",
  prices?: { priceCard?: number; pricePix?: number },
) => {
  const url = window.location.href;
  const priceCard = prices?.priceCard && prices.priceCard > 0 ? prices.priceCard : 0;
  const pricePix = prices?.pricePix && prices.pricePix > 0 && prices.pricePix !== priceCard ? prices.pricePix : 0;

  const priceLines: string[] = [];
  if (priceCard > 0) priceLines.push(`Valor Cartão: ${formatBRL(priceCard)}`);
  if (pricePix > 0) priceLines.push(`Valor PIX: ${formatBRL(pricePix)}`);

  const text = priceLines.length
    ? `${name}\n${priceLines.join("\n")}\n\nConfira no catálogo da Spencer's Cardtopia!`
    : `${name} — Confira no catálogo da Spencer's Cardtopia!`;
  const shareText = `${text}\n${url}`;

  if (method === "copy") {
    if (navigator.share) {
      try { await navigator.share({ title: name, text, url }); return; } catch {}
    }
    navigator.clipboard.writeText(shareText);
    toast.success("Link copiado!");
  } else if (method === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  } else if (method === "twitter") {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  } else if (method === "instagram") {
    navigator.clipboard.writeText(shareText);
    toast.success("Texto copiado! Cole no seu Instagram Stories");
    window.open("https://www.instagram.com/", "_blank");
  }
};

const DropDetail = () => {
  const { dropId } = useParams<{ dropId: string }>();
  const navigate = useNavigate();
  const { data: inventoryData = [], isLoading } = useInventory();

  const drop = inventoryData.find((item) => item.id === dropId && (item.product_type ?? "drop") === "drop");

  const { data: singlesImages = [] } = useQuery({
    queryKey: ["drop_singles_images", dropId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drop_singles_images")
        .select("*")
        .eq("inventory_item_id", dropId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dropId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Drop não encontrado.</p>
        <Link to="/catalogo"><Button variant="outline">Voltar ao catálogo</Button></Link>
      </div>
    );
  }

  const discount = drop.discount ?? 0;
  const finalPrice = drop.price * (1 - discount / 100);
  const config = descriptionConfig[drop.description];
  const Icon = config?.icon ?? Circle;

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-brand-header-border bg-brand-header backdrop-blur-xl shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/catalogo">
            <img src={logo} alt="Spencer's Cardtopia" className="h-9 hover:scale-105 transition-transform" />
          </Link>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-brand-header-foreground hover:bg-white/10 hover:text-brand-gold transition-colors duration-200">
                  <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {(() => {
                  const discount = drop.discount ?? 0;
                  const priceCard = Math.max(0, drop.price * (1 - discount / 100));
                  const pricePix = Number(drop.price_pix ?? 0);
                  const prices = { priceCard, pricePix };
                  return (
                    <>
                      <DropdownMenuItem onClick={() => sharePage(drop.name, "whatsapp", prices)} className="gap-2 cursor-pointer">
                        <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => sharePage(drop.name, "twitter", prices)} className="gap-2 cursor-pointer">
                        <Twitter className="h-4 w-4 text-sky-500" /> Twitter / X
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => sharePage(drop.name, "instagram", prices)} className="gap-2 cursor-pointer">
                        <Instagram className="h-4 w-4 text-pink-500" /> Instagram
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => sharePage(drop.name, "copy", prices)} className="gap-2 cursor-pointer">
                        <Copy className="h-4 w-4 text-muted-foreground" /> Copiar link
                      </DropdownMenuItem>
                    </>
                  );
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
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
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Main Product */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl overflow-hidden border border-border/40 bg-muted/20 flex items-center justify-center">
            {drop.image_url ? (
              <ImageZoom src={drop.image_url} alt={drop.name} className="w-full h-auto object-contain" containerClassName="w-full" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-muted-foreground bg-muted/10">
                <Package className="h-16 w-16" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                <span className="text-gradient">{drop.name}</span>
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">{drop.id}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`gap-1 ${config?.className ?? ""}`}>
                <Icon className="h-3 w-3" /> {config?.label ?? drop.description}
              </Badge>
              {drop.language && <Badge variant="outline">{drop.language}</Badge>}
              {drop.condition && <Badge variant="outline">{drop.condition}</Badge>}
              {drop.status === "pre_sale" && <Badge className="bg-accent text-accent-foreground">Pré Venda</Badge>}
              {drop.status === "launch" && <Badge className="bg-primary text-primary-foreground">Lançamento</Badge>}
            </div>

            <div className="space-y-1">
              {discount > 0 ? (
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-lg text-muted-foreground line-through">R$ {drop.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <span className="text-3xl font-bold text-gradient font-display">R$ {finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-sm font-bold">-{discount}%</Badge>
                </div>
              ) : (
                <span className="text-3xl font-bold text-gradient font-display">R$ {drop.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              )}
              {(drop.price_pix ?? 0) > 0 && (
                <p className="text-sm font-semibold text-success">💰 PIX: R$ {(drop.price_pix ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {drop.quantity <= 0 ? "Esgotado" : drop.quantity === 1 ? "🔥 Última unidade!" : `📦 ${drop.quantity} em estoque`}
              </p>
            </div>

            <AddToCartButton drop={drop} navigate={navigate} />

            {(drop as any).drop_description && (
              <div className="glass-card p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-foreground mb-2">Descrição</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(drop as any).drop_description}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{drop.category}</p>
          </div>
        </div>

        {/* Singles Images */}
        {singlesImages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-semibold text-foreground">
                <span className="text-gradient">Singles do Drop</span>
              </h2>
              <div className="flex-1 premium-divider" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {singlesImages.map((img) => (
                <div key={img.id} className="glass-card glow-hover overflow-hidden rounded-xl">
                  <ImageZoom src={img.image_url} alt={img.caption || "Single"} className="w-full aspect-[2.5/3.5] object-cover" containerClassName="w-full" />
                  {img.caption && (
                    <p className="p-2 text-xs text-muted-foreground text-center truncate">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropDetail;
