import { useState } from "react";
import { ShoppingCart as CartIcon, X, Trash2, Plus, Minus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type InventoryItem } from "@/data/inventory";

export interface CartItem {
  item: InventoryItem;
  qty: number;
}

interface ShoppingCartProps {
  items: CartItem[];
  onAdd: (item: InventoryItem) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onUpdateQty: (itemId: string, qty: number) => void;
}

const WHATSAPP_NUMBER = "5511947154555";
const STORE_EMAIL = "barbaradiasx@gmail.com";

const ShoppingCart = ({ items, onRemove, onClear, onUpdateQty }: ShoppingCartProps) => {
  const [open, setOpen] = useState(false);

  const total = items.reduce((s, ci) => {
    const discount = ci.item.discount ?? 0;
    const finalPrice = ci.item.price * (1 - discount / 100);
    return s + finalPrice * ci.qty;
  }, 0);

  const totalItems = items.reduce((s, ci) => s + ci.qty, 0);

  const buildMessage = () => {
    let msg = "🛒 *Lista de Interesse — Spencer's Cardtopia*\n\n";
    items.forEach((ci, i) => {
      const discount = ci.item.discount ?? 0;
      const finalPrice = ci.item.price * (1 - discount / 100);
      msg += `${i + 1}. *${ci.item.name}* (${ci.item.id})\n`;
      msg += `   Tipo: ${ci.item.description}`;
      if (ci.item.language) msg += ` | Idioma: ${ci.item.language}`;
      if (ci.item.condition) msg += ` | Estado: ${ci.item.condition}`;
      msg += `\n   Qtd: ${ci.qty} × R$ ${finalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = R$ ${(finalPrice * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n`;
    });
    msg += `💰 *Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\n`;
    msg += "Gostaria de fechar esse pedido! 🎴";
    return msg;
  };

  const handleBuy = () => {
    const msg = buildMessage();
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-6 right-6 z-50 flex items-center gap-2 glass-card rounded-full px-5 py-3 text-sm font-medium text-foreground shadow-lg hover:border-primary/50 hover:shadow-primary/10 hover:shadow-xl transition-all duration-300">
          <CartIcon className="h-5 w-5 text-primary" />
          Carrinho
          {totalItems > 0 && (
            <Badge className="bg-primary text-primary-foreground text-xs h-5 min-w-[20px] flex items-center justify-center">
              {totalItems}
            </Badge>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground flex items-center gap-2">
            <CartIcon className="h-5 w-5 text-primary" />
            Carrinho de Interesse
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <CartIcon className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
            <p className="text-xs text-muted-foreground">Adicione produtos do catálogo.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map((ci) => {
                const discount = ci.item.discount ?? 0;
                const finalPrice = ci.item.price * (1 - discount / 100);
                return (
                  <div key={ci.item.id} className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    {ci.item.image_url ? (
                      <img src={ci.item.image_url} alt={ci.item.name} className="h-16 w-12 rounded object-cover border border-border/40 shrink-0" />
                    ) : (
                      <div className="h-16 w-12 rounded bg-muted/30 border border-border/40 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ci.item.name}</p>
                      <p className="text-xs text-muted-foreground">{ci.item.description}{ci.item.language ? ` · ${ci.item.language}` : ""}{ci.item.condition ? ` · ${ci.item.condition}` : ""}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty - 1)} disabled={ci.qty <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{ci.qty}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onUpdateQty(ci.item.id, ci.qty + 1)} disabled={ci.qty >= ci.item.quantity}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-bold text-primary">
                          R$ {(finalPrice * ci.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(ci.item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-primary font-display">
                  R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Button className="w-full gap-2 font-body" size="lg" onClick={handleBuy}>
                <Send className="h-4 w-4" />
                Comprar via WhatsApp
              </Button>
              <Button variant="outline" className="w-full gap-2 font-body text-xs" size="sm" onClick={onClear}>
                <Trash2 className="h-3.5 w-3.5" />
                Limpar carrinho
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ShoppingCart;
