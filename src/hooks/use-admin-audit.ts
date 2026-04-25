import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderHistoryWithMeta {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_by_name: string | null;
  created_at: string;
}

/**
 * Pulls order_status_history and joins with auth.users via admin_audit_log
 * (since we cannot query auth.users directly from client). We rely on
 * admin_audit_log for actor_email when present; otherwise fallback to id.
 */
export const useOrderStatusAudit = (limit = 200) => {
  return useQuery({
    queryKey: ["order-status-audit", limit],
    queryFn: async (): Promise<OrderHistoryWithMeta[]> => {
      const [historyRes, auditRes] = await Promise.all([
        supabase
          .from("order_status_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("admin_audit_log")
          .select("actor_id, actor_email, entity_id, action, created_at")
          .eq("entity_type", "order")
          .eq("action", "status_change")
          .order("created_at", { ascending: false })
          .limit(limit * 2),
      ]);

      if (historyRes.error) throw historyRes.error;
      const history = historyRes.data ?? [];
      const auditRows = auditRes.data ?? [];

      // Index audit by (order_id, ~timestamp) to find email
      const emailByActor = new Map<string, string>();
      for (const a of auditRows) {
        if (a.actor_id && a.actor_email) emailByActor.set(a.actor_id, a.actor_email);
      }

      return history.map((h) => ({
        id: h.id,
        order_id: h.order_id,
        from_status: h.from_status,
        to_status: h.to_status,
        note: h.note,
        changed_by: h.changed_by,
        changed_by_email: h.changed_by ? emailByActor.get(h.changed_by) ?? null : null,
        changed_by_name: null,
        created_at: h.created_at,
      }));
    },
  });
};
