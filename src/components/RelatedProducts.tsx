import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInventory } from "@/hooks/use-inventory";
import { prioritizeInStock } from "@/lib/stock";
import type { InventoryItem } from "@/data/inventory";

const KEY = "recently_viewed_products";

const readViewed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

const pathFor = (i: InventoryItem) =>
  i.product_type === "single" ? `/catalogo/single/${i.id}` : `/catalogo/drop/${i.id}`;

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props { current: InventoryItem }

const RelatedProducts = ({ current }: Props) => {
  const { data: inventory = [] } = useInventory();

  // Record this view after computing suggestions from previous history
  const viewed = useMemo(() => readViewed(), [current.id]);
  useEffect(() => {
    try {
      const next = [current.id, ...readViewed().filter((id) => id !== current.id)].slice(0, 20);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, [current.id]);

  const items = useMemo(() => {
    const visible = inventory.filter(
      (i) => i.id !== current.id && !(i.product_type === "single" && i.quantity <= 0),
    );
    const byId = new Map(visible.map((i) => [i.id, i]));
    const result: InventoryItem[] = [];
    const add = (i?: InventoryItem) => { if (i && !result.includes(i)) result.push(i); };
    visible.filter((i) => i.category === current.category).forEach(add);
    viewed.forEach((id) => add(byId.get(id)));
    visible.filter((i) => i.product_type === current.product_type).forEach(add);
    // Produtos com estoque vêm sempre antes dos esgotados.
    return prioritizeInStock(result).slice(0, 8);
  }, [inventory, current.id, current.category, current.product_type, viewed]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-semibold"><span className="text-gradient">Você também pode gostar</span></h2>
        <div className="flex-1 premium-divider" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((i) => {
          const d = i.discount ?? 0;
          const pixBase = (i.price_pix ?? 0) > 0 ? (i.price_pix as number) : i.price;
          const pix = Math.max(0, pixBase * (1 - d / 100));
          const inStock = i.quantity > 0;
          const isSingle = i.product_type === "single";
          return (
            <Link key={i.id} to={pathFor(i)} className="glass-card glow-hover rounded-xl overflow-hidden flex flex-col">
              <div className={`bg-muted/20 ${isSingle ? "aspect-[2.5/3.5]" : "aspect-square"} flex items-center justify-center`}>
                {i.image_url ? (
                  <img src={i.image_url} alt={i.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                <p className="text-xs font-semibold text-foreground line-clamp-2">{i.name}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-foil/10 text-foil border-foil/30">{i.description}</Badge>
                  {i.language && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{i.language}</Badge>}
                  {i.condition && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{i.condition}</Badge>}
                </div>
                <div className="mt-auto space-y-0.5">
                  <p className="text-sm font-bold text-success">R$ {fmt(pix)} <span className="text-[10px] font-medium">PIX</span></p>
                  {pix < i.price && <p className="text-[10px] text-muted-foreground">Cartão: R$ {fmt(i.price)}</p>}
                  <p className={`text-[11px] font-medium ${inStock ? "text-success" : "text-destructive"}`}>
                    {inStock ? `Em estoque (${i.quantity})` : "Esgotado"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default RelatedProducts;
