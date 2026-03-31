import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";
import { toast } from "sonner";

export const useFavorites = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("favorites")
        .select("inventory_item_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((f) => f.inventory_item_id);
    },
    enabled: !!user,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user) throw new Error("Not logged in");
      const isFav = favorites.includes(itemId);
      if (isFav) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("inventory_item_id", itemId);
      } else {
        await supabase.from("favorites").insert({ user_id: user.id, inventory_item_id: itemId });
      }
      return !isFav;
    },
    onSuccess: (added, itemId) => {
      qc.invalidateQueries({ queryKey: ["favorites", user?.id] });
      toast.success(added ? "Adicionado aos favoritos! ❤️" : "Removido dos favoritos.");
    },
  });

  const isFavorite = (itemId: string) => favorites.includes(itemId);

  return { favorites, isLoading, toggleFavorite, isFavorite };
};
