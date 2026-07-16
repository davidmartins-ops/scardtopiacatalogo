import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ShippingLabelStatus =
  | "pending"
  | "released"
  | "posted"
  | "delivered"
  | "canceled"
  | "error";

export interface ShippingLabelEvent {
  id: string;
  order_id: string;
  event_type: "issued" | "resent" | "synced" | "canceled" | "error";
  status: ShippingLabelStatus | null;
  tracking_code: string | null;
  label_url: string | null;
  actor_id: string | null;
  actor_email: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const SHIPPING_LABEL_STATUS_META: Record<
  ShippingLabelStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pendente", className: "bg-muted/40 text-muted-foreground border-border" },
  released: { label: "Etiqueta emitida", className: "bg-primary/10 text-primary border-primary/30" },
  posted: { label: "Coletada / postada", className: "bg-accent/10 text-accent border-accent/30" },
  delivered: { label: "Entregue", className: "bg-success/10 text-success border-success/30" },
  canceled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/30" },
  error: { label: "Falha", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const useShippingLabelEvents = (orderId?: string) => {
  return useQuery({
    queryKey: ["shipping-label-events", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("shipping_label_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ShippingLabelEvent[];
    },
    enabled: !!orderId,
  });
};

export const useSyncShippingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderIds?: string[]) => {
      const { data, error } = await supabase.functions.invoke("superfrete-sync-status", {
        body: orderIds && orderIds.length > 0 ? { orderIds } : {},
      });
      if (error) throw error;
      return data as { success: boolean; checked: number; results: Array<{ orderId: string; status: ShippingLabelStatus; changed: boolean }> };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["shipping-label-events"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });
};

export interface ShippingOption {
  id: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: string;
}

export const useCalculateShipping = () => {
  return useMutation({
    mutationFn: async ({ cep, itemCount }: { cep: string; itemCount: number }) => {
      const { data, error } = await supabase.functions.invoke("superfrete-calculate", {
        body: { cep, itemCount },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return (data as { options: ShippingOption[] }).options ?? [];
    },
  });
};

export const useGenerateShippingLabel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, checkout = true, serviceId }: { orderId: string; checkout?: boolean; serviceId?: number }) => {
      const { data, error } = await supabase.functions.invoke("superfrete-create-label", {
        body: { orderId, checkout, serviceId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { trackingCode?: string; labelUrl?: string; resent?: boolean; status: ShippingLabelStatus };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["shipping-label-events"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });
};
