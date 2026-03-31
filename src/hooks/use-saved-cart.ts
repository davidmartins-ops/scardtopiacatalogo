import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";

export interface SavedCartRow {
  inventory_item_id: string;
  quantity: number;
}

export const useSavedCart = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: savedItems = [], isLoading } = useQuery({
    queryKey: ["saved_cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_cart_items")
        .select("inventory_item_id, quantity")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as SavedCartRow[];
    },
    enabled: !!user,
  });

  const syncCart = useMutation({
    mutationFn: async (items: SavedCartRow[]) => {
      if (!user) return;
      // Delete all, then insert
      await supabase.from("saved_cart_items").delete().eq("user_id", user.id);
      if (items.length > 0) {
        await supabase.from("saved_cart_items").insert(
          items.map((i) => ({ user_id: user.id, inventory_item_id: i.inventory_item_id, quantity: i.quantity }))
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_cart", user?.id] }),
  });

  return { savedItems, isLoading, syncCart };
};
