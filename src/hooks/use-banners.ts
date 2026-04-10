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
      return (data ?? []) as Banner[];
    },
  });
};

export const useActiveBanners = () => {
  return useQuery({
    queryKey: ["banners", "active"],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Banner[];
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
