import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Banner {
  id: string;
  image_url: string;
  alt: string;
  label: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_active: boolean;
  display_page: "all" | "login" | "catalogo";
  inventory_item_id?: string | null;
}

export const useBanners = () => {
  return useQuery({
    queryKey: ["banners"],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({ ...d, display_page: d.display_page ?? "all", inventory_item_id: d.inventory_item_id ?? null })) as Banner[];
    },
  });
};

export const useActiveBanners = (page?: "login" | "catalogo") => {
  return useQuery({
    queryKey: ["banners", "active", page],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const all = (data ?? []).map((d: any) => ({ ...d, display_page: d.display_page ?? "all", inventory_item_id: d.inventory_item_id ?? null })) as Banner[];
      if (!page) return all;
      return all.filter((b) => b.display_page === "all" || b.display_page === page);
    },
  });
};

export const useBannerMutations = () => {
  const queryClient = useQueryClient();

  const addBanner = useMutation({
    mutationFn: async (banner: Omit<Banner, "id">) => {
      const { error } = await supabase.from("banners").insert(banner as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banners"] }),
  });

  const updateBanner = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Banner> & { id: string }) => {
      const { error } = await supabase.from("banners").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banners"] }),
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banners"] }),
  });

  return { addBanner, updateBanner, deleteBanner };
};
