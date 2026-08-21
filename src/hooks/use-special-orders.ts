import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";
import type { Database } from "@/integrations/supabase/types";

type SpecialOrderProductRow = Database["public"]["Tables"]["special_order_products"]["Row"];
type SpecialOrderProductInsert = Database["public"]["Tables"]["special_order_products"]["Insert"];



export type SpecialOrderStatus =
  | "requested"
  | "quoted"
  | "approved"
  | "paid"
  | "ordered"
  | "received"
  | "shipped"
  | "delivered"
  | "cancelled";

export type SpecialOrderItemType = "fixed_price" | "quotation";

export interface SpecialOrderItem {
  id: string;
  special_order_id: string;
  item_type: SpecialOrderItemType;
  product_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  reference_links: string[] | null;
  reference_image_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialOrderQuote {
  id: string;
  special_order_id: string;
  item_id: string | null;
  quoted_price: number;
  estimated_days: number | null;
  expires_at: string | null;
  admin_notes: string | null;
  customer_response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialOrder {
  id: string;
  user_id: string;
  status: SpecialOrderStatus;
  source: string;
  customer_info: Record<string, any>;
  shipping_address: Record<string, any> | null;
  shipping_cost: number;
  total: number;
  payment_method: string | null;
  payment_transaction_id: string | null;
  payment_invoice_slug: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  tracking_code: string | null;
  shipping_label_url: string | null;
  superfrete_order_id: string | null;
  shipping_label_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  status_updated_at: string;
}

export const SPECIAL_ORDER_STATUS_LABELS: Record<SpecialOrderStatus, string> = {
  requested: "Solicitada",
  quoted: "Cotada",
  approved: "Aprovada",
  paid: "Paga",
  ordered: "Encomendada",
  received: "Recebida",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

export const useSpecialOrders = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["special-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("special_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpecialOrder[];
    },
    enabled: !!user,
  });

  const createOrder = useMutation({
    mutationFn: async (input: {
      source?: "customer_request" | "catalog_fixed";
      items: Array<{
        item_type?: SpecialOrderItemType;
        product_id?: string;
        variant_id?: string;
        name: string;
        description?: string;
        quantity: number;
        unit_price?: number;
        reference_links?: string[];
        reference_image_url?: string;
      }>;
      customer_info?: Record<string, any>;
      shipping_address?: Record<string, any>;
      notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-special-order", {
        body: input,
      });
      if (error) throw error;
      return data as { id: string; status: SpecialOrderStatus; total: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["special-orders", user?.id] }),
  });

  const approveQuote = useMutation({
    mutationFn: async (input: { special_order_id: string; quote_id?: string; accept: boolean; customer_response?: string }) => {
      const { data, error } = await supabase.functions.invoke("special-order-approve", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["special-orders", user?.id] }),
  });

  const createPayment = useMutation({
    mutationFn: async (input: { special_order_id: string; payment_method: "pix" | "credit" | "debit" }) => {
      const { data, error } = await supabase.functions.invoke("process-special-order-payment", { body: input });
      if (error) throw error;
      return data as { checkout_url: string; transaction_id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["special-orders", user?.id] }),
  });

  return { orders, isLoading, createOrder, approveQuote, createPayment };
};

export const useSpecialOrderDetail = (orderId?: string) => {
  return useQuery({
    queryKey: ["special-order-detail", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const [orderRes, itemsRes, quotesRes, historyRes] = await Promise.all([
        supabase.from("special_orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("special_order_items").select("*").eq("special_order_id", orderId),
        supabase.from("special_order_quotes").select("*").eq("special_order_id", orderId).order("created_at", { ascending: true }),
        supabase.from("special_order_status_history").select("*").eq("special_order_id", orderId).order("created_at", { ascending: true }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (!orderRes.data) return null;
      return {
        order: orderRes.data as SpecialOrder,
        items: (itemsRes.data ?? []) as SpecialOrderItem[],
        quotes: (quotesRes.data ?? []) as SpecialOrderQuote[],
        history: (historyRes.data ?? []) as any[],
      };
    },
    enabled: !!orderId,
  });
};

export const useAdminSpecialOrderDetail = (orderId?: string) => {
  return useQuery({
    queryKey: ["admin-special-order-detail", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const [orderRes, itemsRes, quotesRes, historyRes] = await Promise.all([
        supabase.from("special_orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("special_order_items").select("*").eq("special_order_id", orderId),
        supabase.from("special_order_quotes").select("*").eq("special_order_id", orderId).order("created_at", { ascending: true }),
        supabase.from("special_order_status_history").select("*").eq("special_order_id", orderId).order("created_at", { ascending: true }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (!orderRes.data) return null;
      return {
        order: orderRes.data as SpecialOrder,
        items: (itemsRes.data ?? []) as SpecialOrderItem[],
        quotes: (quotesRes.data ?? []) as SpecialOrderQuote[],
        history: (historyRes.data ?? []) as any[],
      };
    },
    enabled: !!orderId,
  });
};



export const useAdminSpecialOrders = () => {
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-special-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_orders")
        .select("*, items:special_order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (SpecialOrder & { items: SpecialOrderItem[] })[];

    },
  });

  const updateStatus = useMutation({
    mutationFn: async (input: {
      id: string;
      status: SpecialOrderStatus;
      note?: string;
      paid_amount?: number;
      tracking_code?: string;
      shipping_label_url?: string;
      shipping_cost?: number;
    }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("special-order-status-update", {
        body: { special_order_id: id, ...rest },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-orders"] });
      qc.invalidateQueries({ queryKey: ["special-order-detail"] });
      qc.invalidateQueries({ queryKey: ["admin-special-order-detail"] });
    },

  });

  const createQuote = useMutation({
    mutationFn: async (input: {
      special_order_id: string;
      item_id?: string;
      quoted_price: number;
      estimated_days?: number;
      expires_at?: string;
      admin_notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("special-order-quote", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-special-orders"] });
      qc.invalidateQueries({ queryKey: ["special-order-detail"] });
    },
  });

  return { orders, isLoading, updateStatus, createQuote };
};

export const useSpecialOrderProducts = () => {
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["special-order-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_order_products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialOrderProductRow[];
    },
  });

  const saveProduct = useMutation({
    mutationFn: async (product: Partial<SpecialOrderProductRow> | SpecialOrderProductInsert) => {
      if ("id" in product && product.id) {
        const { data, error } = await supabase
          .from("special_order_products")
          .update(product as Partial<SpecialOrderProductRow>)
          .eq("id", product.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("special_order_products").insert(product as SpecialOrderProductInsert).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["special-order-products"] }),
  });

  return { products, isLoading, saveProduct };
};
