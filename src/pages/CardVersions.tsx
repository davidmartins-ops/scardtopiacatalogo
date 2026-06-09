import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useInventory } from "@/hooks/use-inventory";
import { useMtgSets, extractSetCode } from "@/hooks/use-mtg-sets";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import useSEO from "@/hooks/use-seo";
import ImageZoom from "@/components/ImageZoom";
import type { InventoryItem } from "@/data/inventory";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const addToGuestCart = (item: InventoryItem) => {
  try {
    const raw = localStorage.getItem("spencer_guest_cart");
    const parsed: { inventory_item_id: string; quantity: number }[] = raw ? JSON.parse(raw) : [];
    const existing = parsed.find((p) => p.inventory_item_id === item.id);
    if (existing) {
      if (existing.quantity >= item.quantity) {
        toast.error("Quantidade máxima atingida.");
        return false;
      }
      existing.quantity += 1;
    } else {
      parsed.push({ inventory_item_id: item.id, quantity: 1 });
    }
    localStorage.setItem("spencer_guest_cart", JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
};

const CardVersions = () => {
  const { name = "" } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name);
  const navigate = useNavigate();
  const { data: inventory = [], isLoading } = useInventory();
  const { sets: allSets } = useMtgSets();
  const [sortKey, setSortKey] = useState<"price" | "set" | "stock">("price");

  useSEO({ title: `${decodedName} — Versões disponíveis` });

  const versions = useMemo(() => {
    const matches = inventory.filter(
      (i) =>
        (i.product_type ?? "drop") === "single" &&
        i.name.toLowerCase() === decodedName.toLowerCase() &&
        i.quantity > 0,
    );
    const setName = new Map(allSets.map((s) => [s.code, s.name]));
    const enriched = matches.map((i) => {
      const code = extractSetCode(i.id) ?? "";
      const discount = i.discount ?? 0;
      const pixBase = (i.price_pix ?? 0) > 0 ? (i.price_pix as number) : i.price;
      const pixFinal = Math.max(0, pixBase * (1 - discount / 100));
      return {
        item: i,
        setCode: code.toUpperCase(),
        setName: setName.get(code) ?? code.toUpperCase(),
        pixFinal,
        discount,
      };
    });
    const sorted = [...enriched];
    if (sortKey === "price") sorted.sort((a, b) => a.pixFinal - b.pixFinal);
    if (sortKey === "set") sorted.sort((a, b) => a.setName.localeCompare(b.setName));
    if (sortKey === "stock") sorted.sort((a, b) => b.item.quantity - a.item.quantity);
    return sorted;
  }, [inventory, decodedName, allSets, sortKey]);

  const heroImage = versions[0]?.item.image_url;

  const handleAdd = (item: InventoryItem) => {
    const ok = addToGuestCart(item);
    if (ok) toast.success(`${item.name} adicionado! Vá ao carrinho no catálogo.`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/catalogo"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Catálogo
          </Link>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/catalogo")}>
            <ShoppingCart className="h-3.5 w-3.5" /> Ver carrinho
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1
          className="text-2xl sm:text-3xl font-bold text-foreground mb-1"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
        >
          <span className="text-gradient">{decodedName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          {versions.length} versão(ões) disponível(is) — escolha coleção, idioma, condição e acabamento.
        </p>

        {versions.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma versão disponível no momento.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[280px,1fr] gap-6">
            {/* Hero */}
            <div className="hidden lg:block">
              <div className="glass-card p-3 sticky top-20">
                {heroImage ? (
                  <ImageZoom
                    src={heroImage}
                    alt={decodedName}
                    className="w-full rounded-lg object-cover aspect-[2.5/3.5]"
                    containerClassName="w-full"
                  />
                ) : (
                  <div className="w-full aspect-[2.5/3.5] flex items-center justify-center bg-muted/20 rounded-lg">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="glass-card p-4 overflow-x-auto">
              <div className="flex items-center gap-2 mb-3 text-xs">
                <span className="text-muted-foreground">Ordenar por:</span>
                {(
                  [
                    { v: "price", label: "Menor preço" },
                    { v: "set", label: "Coleção" },
                    { v: "stock", label: "Estoque" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setSortKey(o.v)}
                    className={`px-2.5 py-1 rounded-full border transition-all font-semibold ${
                      sortKey === o.v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b border-border/50">
                    <th className="py-2 px-2 font-semibold">Coleção</th>
                    <th className="py-2 px-2 font-semibold">Idioma</th>
                    <th className="py-2 px-2 font-semibold">Condição</th>
                    <th className="py-2 px-2 font-semibold">Acabamento</th>
                    <th className="py-2 px-2 font-semibold text-right">PIX</th>
                    <th className="py-2 px-2 font-semibold text-right">Cartão</th>
                    <th className="py-2 px-2 font-semibold text-center">Estoque</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr
                      key={v.item.id}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <Link
                          to={`/catalogo/single/${encodeURIComponent(v.item.id)}`}
                          className="text-foreground hover:text-primary transition-colors font-medium"
                        >
                          {v.setName}
                        </Link>
                        <div className="text-[10px] text-muted-foreground uppercase">{v.setCode}</div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {v.item.language ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {v.item.condition ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-foreground/80">{v.item.description}</td>
                      <td className="py-2 px-2 text-right font-bold text-success font-display">
                        {formatBRL(v.pixFinal)}
                        {v.discount > 0 && (
                          <div className="text-[9px] text-success/80 font-semibold">-{v.discount}%</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {formatBRL(v.item.price)}
                      </td>
                      <td className="py-2 px-2 text-center text-xs">{v.item.quantity}</td>
                      <td className="py-2 px-2 text-right">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleAdd(v.item)}
                        >
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardVersions;
