import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus } from "./use-orders";

export interface SlaRule {
  id: string;
  status: OrderStatus;
  max_hours: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const useSlaRules = () => {
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["sla-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_sla_rules")
        .select("*")
        .order("status");
      if (error) throw error;
      return (data ?? []) as SlaRule[];
    },
  });

  const updateRule = useMutation({
    mutationFn: async (input: { id: string; max_hours?: number; enabled?: boolean }) => {
      const patch: { max_hours?: number; enabled?: boolean } = {};
      if (input.max_hours !== undefined) patch.max_hours = input.max_hours;
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      const { error } = await supabase.from("order_sla_rules").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sla-rules"] }),
  });

  return { rules, isLoading, updateRule };
};
