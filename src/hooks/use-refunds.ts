import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";

export type RefundStatus = "pending" | "approved" | "processed" | "rejected";
export type RefundMethod = "pix" | "reverse_credit" | "store_credit" | "cash";

export interface OrderRefund {
  id: string;
  order_id: string;
  dispute_id: string | null;
  amount: number;
  reason: string;
  method: RefundMethod;
  status: RefundStatus;
  pix_key: string | null;
  proof_url: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  restocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Customer-facing
export const useOrderRefunds = (orderId?: string) => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["refunds", orderId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from("order_refunds").select("*").order("created_at", { ascending: false });
      if (orderId) q = q.eq("order_id", orderId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrderRefund[];
    },
    enabled: !!user,
  });

  const requestRefund = useMutation({
    mutationFn: async (input: {
      order_id: string;
      amount: number;
      reason: string;
      method?: RefundMethod;
      pix_key?: string;
      dispute_id?: string | null;
    }) => {
      if (!user) throw new Error("Login obrigatório");
      const { error } = await supabase.from("order_refunds").insert({
        order_id: input.order_id,
        amount: input.amount,
        reason: input.reason,
        method: input.method ?? "pix",
        pix_key: input.pix_key ?? null,
        dispute_id: input.dispute_id ?? null,
        requested_by: user.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });

  return { refunds, isLoading, requestRefund };
};

// Admin
export const useAdminRefunds = () => {
  const qc = useQueryClient();

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["admin-refunds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_refunds")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRefund[];
    },
  });

  const updateRefund = useMutation({
    mutationFn: async ({
      id,
      patch,
      restock,
    }: {
      id: string;
      patch: Partial<OrderRefund>;
      restock?: boolean;
    }) => {
      const { error } = await supabase.from("order_refunds").update(patch).eq("id", id);
      if (error) throw error;
      if (restock) {
        const { error: rErr } = await supabase.rpc("restock_refunded_items", { _refund_id: id });
        if (rErr) throw rErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-refunds"] });
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const uploadProof = async (refundId: string, file: File) => {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `refunds/${refundId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (upErr) throw upErr;
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? path;
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_refunds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-refunds"] }),
  });

  return { refunds, isLoading, updateRefund, uploadProof, remove };
};
