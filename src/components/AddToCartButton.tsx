import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { InventoryItem } from "@/data/inventory";

interface Props {
  item: InventoryItem;
  redirectTo?: string;
  className?: string;
}

const AddToCartButton = ({ item, redirectTo = "/catalogo", className = "" }: Props) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const disabled = item.quantity <= 0 || loading;

  const handleAdd = () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem("spencer_guest_cart");
      const current = raw ? (JSON.parse(raw) as { inventory_item_id: string; quantity: number }[]) : [];
      const idx = current.findIndex((c) => c.inventory_item_id === item.id);
      if (idx >= 0) {
        if (current[idx].quantity >= item.quantity) {
          toast.error("Quantidade máxima atingida.");
          setLoading(false);
          return;
        }
        current[idx].quantity += 1;
      } else {
        current.push({ inventory_item_id: item.id, quantity: 1 });
      }
      localStorage.setItem("spencer_guest_cart", JSON.stringify(current));
      toast.success(`${item.name} adicionado ao carrinho!`);
      setTimeout(() => navigate(redirectTo), 250);
    } catch {
      toast.error("Não foi possível adicionar ao carrinho.");
      setLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      className={`w-full gap-2 font-semibold min-h-[44px] box-border ${className}`}
      disabled={disabled}
      aria-busy={loading}
      aria-label={item.quantity <= 0 ? "Produto esgotado" : "Adicionar ao carrinho"}
      onClick={handleAdd}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
      {item.quantity <= 0 ? "Esgotado" : loading ? "Adicionando..." : "Adicionar ao carrinho"}
    </Button>
  );
};

export default AddToCartButton;
