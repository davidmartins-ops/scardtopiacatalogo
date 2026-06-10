import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReconciliationStatus = "matched" | "divergent" | "unmatched" | "manual";
export type ReconciliationMethod = "pix" | "credit" | "debit" | "cash" | "other";

export interface ReconciliationRow {
  id: string;
  order_id: string;
  expected_amount: number;
  received_amount: number;
  method: ReconciliationMethod;
  received_at: string | null;
  bank_reference: string | null;
  status: ReconciliationStatus;
  notes: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashClosure {
  id: string;
  closure_date: string;
  total_orders: number;
  total_expected: number;
  total_received: number;
  divergence: number;
  closed_by: string | null;
  closed_at: string;
  notes: string | null;
}

export const useReconciliation = (params: { from?: string; to?: string } = {}) => {
  const qc = useQueryClient();

  const records = useQuery({
    queryKey: ["reconciliation", params.from, params.to],
    queryFn: async (): Promise<ReconciliationRow[]> => {
      let q = supabase
        .from("payment_reconciliation")
        .select("*")
        .order("created_at", { ascending: false });
      if (params.from) q = q.gte("created_at", params.from);
      if (params.to) q = q.lte("created_at", params.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReconciliationRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<ReconciliationRow> & { order_id: string; expected_amount: number }) => {
      const { data: existing } = await supabase
        .from("payment_reconciliation")
        .select("id")
        .eq("order_id", row.order_id)
        .maybeSingle();

      const payload: any = {
        ...row,
        reconciled_at: row.status && row.status !== "unmatched" ? new Date().toISOString() : null,
      };
      if (row.status && row.status !== "unmatched") {
        const { data: u } = await supabase.auth.getUser();
        payload.reconciled_by = u.user?.id ?? null;
      }

      if (existing) {
        const { error } = await supabase
          .from("payment_reconciliation")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_reconciliation").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reconciliation"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_reconciliation").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reconciliation"] }),
  });

  return { records, upsert, remove };
};

export const useCashClosures = () => {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["cash-closures"],
    queryFn: async (): Promise<CashClosure[]> => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("*")
        .order("closure_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as CashClosure[];
    },
  });

  const closeDay = useMutation({
    mutationFn: async (input: {
      closure_date: string;
      total_orders: number;
      total_expected: number;
      total_received: number;
      notes?: string;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const divergence = +(input.total_received - input.total_expected).toFixed(2);
      const { error } = await supabase
        .from("cash_closures")
        .upsert(
          {
            closure_date: input.closure_date,
            total_orders: input.total_orders,
            total_expected: input.total_expected,
            total_received: input.total_received,
            divergence,
            notes: input.notes ?? null,
            closed_by: u.user?.id ?? null,
            closed_at: new Date().toISOString(),
          },
          { onConflict: "closure_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash-closures"] }),
  });

  return { list, closeDay };
};
