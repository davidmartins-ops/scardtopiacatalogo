import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSpecialOrderProducts } from "@/hooks/use-special-orders";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Package, Plus, Search } from "lucide-react";
import logo from "@/assets/logo.png";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Encomendas = () => {
  useSEO({
    title: "Encomendas Especiais | Spencer's Cardtopia",
    description:
      "Action figures, colecionáveis e cartas sob encomenda. Veja os produtos disponíveis para encomenda e solicite o seu.",
    canonical: "https://www.spencerscardtopia.com.br/encomendas",
  });

  const { user } = useCustomerAuth();
  const { products, isLoading } = useSpecialOrderProducts();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = category === "all" || p.category === category;
      const matchesTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [products, search, category]);

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
          <Link to="/">
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

        <div className="glass-card p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto de encomenda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar produto de encomenda"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={category === "all" ? "default" : "outline"}
                onClick={() => setCategory("all")}
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={category === cat ? "default" : "outline"}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
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
            {filtered.map((product) => (
              <article key={product.id} className="glass-card overflow-hidden flex flex-col">
                <div className="relative w-full bg-muted/30" style={{ aspectRatio: "1 / 1" }}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
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
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h2 className="text-sm font-semibold text-foreground line-clamp-2">{product.name}</h2>
                  {product.category && (
                    <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                  )}
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  )}
                  <div className="mt-auto pt-3">
                    <p className="text-base font-bold text-foreground">{formatBRL(Number(product.price))}</p>
                    {Number(product.price_pix) > 0 && (
                      <p className="text-xs text-success">
                        {formatBRL(Number(product.price_pix))} no PIX
                      </p>
                    )}
                    <Link
                      to={
                        user
                          ? `/conta/encomendas/nova?produto=${product.id}`
                          : `/conta/login?redirect=/conta/encomendas/nova`
                      }
                    >
                      <Button size="sm" className="w-full mt-2">
                        Encomendar
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Encomendas;
