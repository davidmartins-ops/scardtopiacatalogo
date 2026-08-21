import useSEO from "@/hooks/use-seo";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSpecialOrderProduct } from "@/hooks/use-special-order-catalog";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Package, ShieldCheck, Sparkles, Truck } from "lucide-react";
import logo from "@/assets/logo.png";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EncomendaProduto = () => {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useCustomerAuth();
  const { data, isLoading } = useSpecialOrderProduct(productId);

  const product = data?.product ?? null;
  const variants = data?.variants ?? [];

  const [variantId, setVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (variants.length > 0) setVariantId((prev) => prev ?? variants[0].id);
  }, [variants]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
  );

  const gallery = useMemo(() => {
    const list = [
      ...(product?.image_url ? [product.image_url] : []),
      ...((product?.image_urls ?? []) as string[]),
      ...variants.map((v) => v.image_url).filter(Boolean as unknown as (v: string | null) => v is string),
    ];
    return Array.from(new Set(list));
  }, [product, variants]);

  const cover = activeImage ?? selectedVariant?.image_url ?? gallery[0] ?? null;

  const price = Number(selectedVariant?.price || product?.price || 0);
  const pricePix = Number(selectedVariant?.price_pix || product?.price_pix || 0);
  const sku = selectedVariant?.sku ?? product?.sku ?? null;

  useSEO({
    title: product ? `${product.name} | Encomendas | Spencer's Cardtopia` : "Encomendas Especiais",
    description: product
      ? `${product.name} — ${product.category}. ${product.description ?? "Produto disponível sob encomenda."}`.slice(0, 155)
      : "Produto disponível sob encomenda na Spencer's Cardtopia.",
    canonical: product
      ? `https://www.spencerscardtopia.com.br/encomendas/${product.id}`
      : undefined,
  });

  const requestUrl = product
    ? user
      ? `/conta/encomendas/nova?produto=${product.id}${selectedVariant ? `&variacao=${selectedVariant.id}` : ""}`
      : `/conta/login?redirect=${encodeURIComponent(
          `/conta/encomendas/nova?produto=${product.id}${selectedVariant ? `&variacao=${selectedVariant.id}` : ""}`,
        )}`
    : "/encomendas";

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/encomendas"
            className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Encomendas
          </Link>
          <Link to="/encomendas">
            <img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : !product ? (
          <div className="glass-card p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">Produto de encomenda não encontrado.</p>
            <Link to="/encomendas">
              <Button variant="outline" className="mt-4">
                Ver todos os produtos
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div
                className="glass-card overflow-hidden bg-muted/30 flex items-center justify-center"
                style={{ aspectRatio: "1 / 1" }}
              >
                {cover ? (
                  <img src={cover} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {gallery.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setActiveImage(url)}
                      className={`h-16 w-16 rounded-lg overflow-hidden border flex-shrink-0 ${
                        cover === url ? "border-primary" : "border-border"
                      }`}
                      aria-label="Ver imagem do produto"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/90 text-primary-foreground border-0 text-[10px] uppercase tracking-wider">
                  Encomenda
                </Badge>
                {product.status === "featured" && (
                  <Badge className="bg-brand-gold/15 text-brand-gold border-brand-gold/30 gap-1">
                    <Sparkles className="h-3 w-3" /> Destaque
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{product.category}</span>
              </div>

              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground mt-2"
                style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.03em" }}
              >
                <span className="text-gradient">{product.name}</span>
              </h1>

              {sku && <p className="text-xs text-muted-foreground mt-1">SKU: {sku}</p>}

              {variants.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-foreground mb-2">Variação</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <Button
                        key={v.id}
                        size="sm"
                        variant={variantId === v.id ? "default" : "outline"}
                        onClick={() => {
                          setVariantId(v.id);
                          setActiveImage(v.image_url ?? null);
                        }}
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-card p-4 mt-5">
                <p className="text-2xl font-bold text-foreground">{formatBRL(price)}</p>
                <p className="text-xs text-muted-foreground">no cartão (até 6x sem juros — exclusivo para encomendas)</p>
                {pricePix > 0 && (
                  <p className="text-sm text-success mt-2 font-medium">{formatBRL(pricePix)} no PIX</p>
                )}
                <Link to={requestUrl}>
                  <Button className="w-full mt-4 gap-2">
                    <Truck className="h-4 w-4" /> Iniciar solicitação
                  </Button>
                </Link>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Confirmamos disponibilidade, prazo e valor final antes de qualquer pagamento.
                </p>
              </div>

              {product.description && (
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-foreground mb-1">Descrição</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
                </div>
              )}

              {(product as typeof product & { specifications?: string | null }).specifications && (
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-foreground mb-2">Especificações</h2>
                  <ul className="space-y-1">
                    {String(
                      (product as typeof product & { specifications?: string | null }).specifications,
                    )
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-brand-gold">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EncomendaProduto;
