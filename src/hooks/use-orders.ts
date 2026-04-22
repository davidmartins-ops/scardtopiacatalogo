import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";

export interface OrderItem {
  id: string;
  name: string;
  description: string;
  language?: string;
  condition?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: string;
  user_id: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
}

export const useOrders = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        items: typeof o.items === "string" ? JSON.parse(o.items) : o.items,
      })) as Order[];
    },
    enabled: !!user,
  });

  const createOrder = useMutation({
    mutationFn: async (order: { items: OrderItem[]; total: number }) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        items: order.items as any,
        total: order.total,
        status: "sent",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  return { orders, isLoading, createOrder };
};

// Admin: list/manage all orders
export const useAdminOrders = () => {
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        items: typeof o.items === "string" ? JSON.parse(o.items) : o.items,
      })) as Order[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const removeOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  return { orders, isLoading, updateStatus, removeOrder };
};
