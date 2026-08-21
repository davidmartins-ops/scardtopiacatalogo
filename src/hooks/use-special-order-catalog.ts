import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SpecialOrderProduct = Database["public"]["Tables"]["special_order_products"]["Row"];
export type SpecialOrderVariant = Database["public"]["Tables"]["special_order_product_variants"]["Row"];
export type SpecialOrderVariantInsert =
  Database["public"]["Tables"]["special_order_product_variants"]["Insert"];

export type SpecialOrderProductStatus = "active" | "inactive" | "featured";

export const SPECIAL_ORDER_PRODUCT_STATUS_LABELS: Record<SpecialOrderProductStatus, string> = {
  active: "Ativo",
  featured: "Em destaque",
  inactive: "Inativo",
};

/** Public product detail (only visible products) + active variants. */
export const useSpecialOrderProduct = (productId?: string) =>
  useQuery({
    queryKey: ["special-order-product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const [productRes, variantsRes] = await Promise.all([
        supabase.from("special_order_products").select("*").eq("id", productId).maybeSingle(),
        supabase
          .from("special_order_product_variants")
          .select("*")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      if (productRes.error) throw productRes.error;
      if (!productRes.data) return null;
      return {
        product: productRes.data as SpecialOrderProduct,
        variants: (variantsRes.data ?? []) as SpecialOrderVariant[],
      };
    },
    enabled: !!productId,
  });

/** All active variants for the public listing (used to show "a partir de" and variant counts). */
export const useSpecialOrderVariantsIndex = () =>
  useQuery({
    queryKey: ["special-order-variants-index"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_order_product_variants")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialOrderVariant[];
    },
  });

/** Admin CRUD for variants of one product. */
export const useAdminSpecialOrderVariants = (productId?: string) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-special-order-variants", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("special_order_product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialOrderVariant[];
    },
    enabled: !!productId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-special-order-variants", productId] });
    qc.invalidateQueries({ queryKey: ["special-order-variants-index"] });
    qc.invalidateQueries({ queryKey: ["special-order-product", productId] });
  };

  const saveVariant = useMutation({
    mutationFn: async (variant: SpecialOrderVariantInsert & { id?: string }) => {
      if (variant.id) {
        const { id, ...rest } = variant;
        const { error } = await supabase
          .from("special_order_product_variants")
          .update(rest)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("special_order_product_variants").insert(variant);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("special_order_product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { variants: query.data ?? [], isLoading: query.isLoading, saveVariant, deleteVariant };
};
