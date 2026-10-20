import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem } from "@/data/inventory";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    // Stock list changes rarely; reuse it for 3 min instead of refetching on every visit/focus.
    staleTime: 3 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // A hung request would leave the catalog on skeletons forever: abort after 12s and retry.
    retry: 4,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
    queryFn: async ({ signal }): Promise<InventoryItem[]> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      signal?.addEventListener("abort", () => ctrl.abort());
      const { data, error } = await supabase
        .from("inventory")
        .select("id, name, description, price, price_pix, quantity, category, discount, image_url, product_type, language, condition, status, availability, drop_description")
        .abortSignal(ctrl.signal)
        .finally(() => clearTimeout(timer));

      if (error) {
        console.error("[useInventory] Supabase error:", error);
        throw error;
      }

      return (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description as InventoryItem["description"],
        price: Number(item.price),
        price_pix: Number((item as any).price_pix ?? 0),
        quantity: item.quantity,
        category: item.category,
        discount: Number(item.discount ?? 0),
        image_url: item.image_url ?? null,
        product_type: (item as any).product_type as InventoryItem["product_type"] ?? "drop",
        language: (item as any).language ?? "PT",
        condition: (item as any).condition ?? "NM",
        status: (item as any).status ?? "none",
        availability: (item as any).availability ?? "pronta_entrega",
        drop_description: (item as any).drop_description ?? "",
      }));
    },
  });
};
