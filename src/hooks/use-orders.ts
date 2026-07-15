import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";

export type OrderStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

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
  user_id: string | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  tracking_code: string | null;
  status_updated_at: string;
  receipt_url: string | null;
  created_at: string;
}

export interface OrderHistoryEntry {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: string | null;
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
    mutationFn: async (order: { items: OrderItem[]; total: number; receipt_url?: string | null }) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        items: order.items as any,
        total: order.total,
        status: "payment_confirmed" as OrderStatus,
        receipt_url: order.receipt_url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  return { orders, isLoading, createOrder };
};

// Detail of a single order + history (works for owner and admin)
export const useOrderDetail = (orderId?: string) => {
  return useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const [orderRes, historyRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase
          .from("order_status_history")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (!orderRes.data) return null;
      const order = {
        ...orderRes.data,
        items:
          typeof orderRes.data.items === "string"
            ? JSON.parse(orderRes.data.items)
            : orderRes.data.items,
      } as Order;
      const history = (historyRes.data ?? []) as OrderHistoryEntry[];
      return { order, history };
    },
    enabled: !!orderId,
  });
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
    mutationFn: async ({
      id,
      status,
      tracking_code,
      note,
    }: {
      id: string;
      status: OrderStatus;
      tracking_code?: string | null;
      note?: string;
    }) => {
      const update: { status: OrderStatus; tracking_code?: string | null } = { status };
      if (tracking_code !== undefined) update.tracking_code = tracking_code;
      const { error } = await supabase.from("orders").update(update).eq("id", id);
      if (error) throw error;
      // Trigger transactional email (best-effort, non-blocking failure)
      try {
        await supabase.functions.invoke("notify-order-status", {
          body: { orderId: id, status, trackingCode: tracking_code, note },
        });
      } catch (e) {
        console.warn("notify-order-status failed", e);
      }
      // Auto-emit SuperFrete label when order enters fulfillment
      if (status === "payment_confirmed" || status === "preparing") {
        try {
          const { data: current } = await supabase
            .from("orders")
            .select("superfrete_order_id, shipping_label_url")
            .eq("id", id)
            .maybeSingle();
          if (current && !current.superfrete_order_id && !current.shipping_label_url) {
            await supabase.functions.invoke("superfrete-create-label", {
              body: { orderId: id, checkout: true },
            });
          }
        } catch (e) {
          console.warn("auto superfrete-create-label failed", e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
    },
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

// Disputes (returns / complaints)
export interface OrderDispute {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  description: string;
  attachment_url: string | null;
  status: "open" | "in_review" | "resolved" | "rejected";
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

export const useOrderDisputes = (orderId?: string) => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["disputes", orderId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from("order_disputes").select("*").order("created_at", { ascending: false });
      if (orderId) q = q.eq("order_id", orderId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrderDispute[];
    },
    enabled: !!user,
  });

  const createDispute = useMutation({
    mutationFn: async (input: {
      order_id: string;
      reason: string;
      description: string;
      attachment_url?: string | null;
    }) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("order_disputes").insert({
        order_id: input.order_id,
        user_id: user.id,
        reason: input.reason,
        description: input.description,
        attachment_url: input.attachment_url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });

  return { disputes, isLoading, createDispute };
};
