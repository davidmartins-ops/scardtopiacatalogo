import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem } from "@/data/inventory";

// Last good stock list, kept on the device so the catalog still shows products
// instantly (and while the server is slow or down). Orders are always re-checked
// by the server, so a slightly old copy here never changes prices or stock.
const CACHE_KEY = "inventory-cache-v1";
const CACHE_MAX_AGE = 7 * 24 * 60 * 60_000;

type Cached = { at: number; items: InventoryItem[] };

const readCache = (): Cached | undefined => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Cached;
    if (!Array.isArray(parsed?.items) || Date.now() - parsed.at > CACHE_MAX_AGE) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const writeCache = (items: InventoryItem[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* storage full or blocked: cache is optional */
  }
};

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    // Stock list changes rarely; reuse it for 3 min instead of refetching on every visit/focus.
    staleTime: 3 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // Show the device copy immediately; it is marked old so a fresh fetch still runs.
    initialData: () => readCache()?.items,
    initialDataUpdatedAt: () => readCache()?.at,
    refetchOnMount: true,
    // A hung request would leave the catalog on skeletons forever: abort after 10s and retry.
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 5000),
    // While the server is unreachable keep trying in the background every 20s.
    refetchInterval: (query) => (query.state.status === "error" ? 20_000 : false),
    queryFn: async ({ signal }): Promise<InventoryItem[]> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      signal?.addEventListener("abort", () => ctrl.abort());
      let res;
      try {
        res = await supabase
          .from("inventory")
          .select("id, name, description, price, price_pix, quantity, category, discount, image_url, product_type, language, condition, status, availability, drop_description")
          .abortSignal(ctrl.signal);
      } finally {
        clearTimeout(timer);
      }
      const { data, error } = res;

      if (error) {
        console.error("[useInventory] Supabase error:", error);
        throw error;
      }

      const items = (data ?? []).map((item) => ({
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
      if (items.length > 0) writeCache(items);
      return items;
    },
  });
};
