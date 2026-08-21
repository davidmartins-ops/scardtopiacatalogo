import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSpecialOrderProducts } from "@/hooks/use-special-orders";
import { useSpecialOrderVariantsIndex } from "@/hooks/use-special-order-catalog";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Package, Plus, Search, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type SortOption = "featured" | "name" | "price_asc" | "price_desc";

const Encomendas = () => {
  useSEO({
    title: "Encomendas Especiais | Spencer's Cardtopia",
    description:
      "Action figures, colecionáveis e cartas sob encomenda. Veja os produtos disponíveis para encomenda e solicite o seu.",
    canonical: "https://www.spencerscardtopia.com.br/encomendas",
  });

  const { user } = useCustomerAuth();
  const { products, isLoading } = useSpecialOrderProducts();
  const { data: variants = [] } = useSpecialOrderVariantsIndex();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sort, setSort] = useState<SortOption>("featured");

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, typeof variants>();
    variants.forEach((v) => {
      const list = map.get(v.product_id) ?? [];
      list.push(v);
      map.set(v.product_id, list);
    });
    return map;
  }, [variants]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const priceOf = (productId: string, fallback: number) => {
    const list = variantsByProduct.get(productId) ?? [];
    const prices = list.map((v) => Number(v.price)).filter((n) => n > 0);
    return prices.length > 0 ? Math.min(...prices) : fallback;
  };

  const pixPriceOf = (productId: string, fallback: number) => {
    const list = variantsByProduct.get(productId) ?? [];
    const prices = list.map((v) => Number(v.price_pix)).filter((n) => n > 0);
    return prices.length > 0 ? Math.min(...prices) : fallback;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = products.filter((p) => {
      const matchesCategory = category === "all" || p.category === category;
      const matchesFeatured = !onlyFeatured || p.status === "featured";
      const matchesTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term) ||
        (variantsByProduct.get(p.id) ?? []).some(
          (v) =>
            v.label.toLowerCase().includes(term) || (v.sku ?? "").toLowerCase().includes(term),
        );
      return matchesCategory && matchesFeatured && matchesTerm;
    });

    const sorted = [...result];
    sorted.sort((a, b) => {
      if (sort === "price_asc") return priceOf(a.id, Number(a.price)) - priceOf(b.id, Number(b.price));
      if (sort === "price_desc") return priceOf(b.id, Number(b.price)) - priceOf(a.id, Number(a.price));
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      const aFeat = a.status === "featured" ? 0 : 1;
      const bFeat = b.status === "featured" ? 0 : 1;
      if (aFeat !== bFeat) return aFeat - bFeat;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    return sorted;
  }, [products, search, category, onlyFeatured, sort, variantsByProduct]);

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/catalogo"
            className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Catálogo
          </Link>
          <Link to="/encomendas">
            <img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
          >
            <span className="text-gradient">Encomendas Especiais</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Action figures, colecionáveis e cartas que trazemos sob encomenda. Escolha um produto
            com preço fixo ou solicite uma cotação personalizada.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Link to={user ? "/conta/encomendas/nova" : "/conta/login?redirect=/conta/encomendas/nova"}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Solicitar encomenda
              </Button>
            </Link>
            {user && (
              <Link to="/conta/encomendas">
                <Button variant="outline" className="gap-2">
                  <Package className="h-4 w-4" /> Minhas encomendas
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="glass-card p-4 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, SKU ou variação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar produto de encomenda"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-48" aria-label="Filtrar por categoria">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="sm:w-44" aria-label="Ordenar produtos">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Destaques primeiro</SelectItem>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
                <SelectItem value="price_asc">Menor preço</SelectItem>
                <SelectItem value="price_desc">Maior preço</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={onlyFeatured ? "default" : "outline"}
              className="gap-1"
              onClick={() => setOnlyFeatured((v) => !v)}
            >
              <Sparkles className="h-3.5 w-3.5" /> Somente destaques
            </Button>
            {(search || category !== "all" || onlyFeatured || sort !== "featured") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setOnlyFeatured(false);
                  setSort("featured");
                }}
              >
                Limpar filtros
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} produto(s)
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">Nenhum produto de encomenda disponível.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Você ainda pode solicitar uma cotação personalizada para o item que procura.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product) => {
              const variantCount = (variantsByProduct.get(product.id) ?? []).length;
              const basePrice = priceOf(product.id, Number(product.price));
              const basePix = pixPriceOf(product.id, Number(product.price_pix));
              return (
                <article key={product.id} className="glass-card overflow-hidden flex flex-col">
                  <Link to={`/encomendas/${product.id}`} className="block">
                    <div className="relative w-full bg-muted/30" style={{ aspectRatio: "1 / 1" }}>
                      {product.image_url || (product.image_urls ?? [])[0] ? (
                        <img
                          src={product.image_url ?? (product.image_urls ?? [])[0]}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground border-0 text-[10px] uppercase tracking-wider">
                        Encomenda
                      </Badge>
                      {product.status === "featured" && (
                        <Badge className="absolute top-2 right-2 bg-brand-gold/90 text-background border-0 text-[10px] gap-1">
                          <Sparkles className="h-3 w-3" /> Destaque
                        </Badge>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 flex flex-col flex-1">
                    <Link to={`/encomendas/${product.id}`}>
                      <h2 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
                        {product.name}
                      </h2>
                    </Link>
                    {product.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                    )}
                    {variantCount > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {variantCount} variação(ões)
                      </p>
                    )}
                    <div className="mt-auto pt-3">
                      <p className="text-base font-bold text-foreground">
                        {variantCount > 0 ? "a partir de " : ""}
                        {formatBRL(basePrice)}
                      </p>
                      {basePix > 0 && (
                        <p className="text-xs text-success">{formatBRL(basePix)} no PIX</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">ou até 6x sem juros no cartão</p>
                      <Link to={`/encomendas/${product.id}`}>
                        <Button size="sm" className="w-full mt-2">
                          Ver detalhes
                        </Button>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Encomendas;
