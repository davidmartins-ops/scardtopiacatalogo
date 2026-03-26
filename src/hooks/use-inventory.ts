import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem } from "@/data/inventory";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, name, description, price, quantity, category, discount");

      if (error) throw error;

      return (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description as InventoryItem["description"],
        price: Number(item.price),
        quantity: item.quantity,
        category: item.category,
        discount: Number(item.discount ?? 0),
      }));
    },
  });
};
