import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AdminNotificationType =
  | "new_order"
  | "new_dispute"
  | "low_stock"
  | "out_of_stock"
  | "payment_confirmed"
  | "sla_breach"
  | "system";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export const useAdminNotifications = () => {
  const { session } = useAuth();
  const qc = useQueryClient();
  const adminId = session?.user?.id;

  const query = useQuery({
    queryKey: ["admin-notifications", adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<AdminNotification[]> => {
      const { data: notifs, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const ids = (notifs ?? []).map((n) => n.id);
      let reads: { notification_id: string; read_at: string }[] = [];
      if (ids.length && adminId) {
        const { data: r } = await supabase
          .from("admin_notification_reads")
          .select("notification_id, read_at")
          .eq("admin_id", adminId)
          .in("notification_id", ids);
        reads = r ?? [];
      }
      const readMap = new Map(reads.map((r) => [r.notification_id, r.read_at]));
      return (notifs ?? []).map((n) => ({
        ...(n as any),
        read_at: readMap.get(n.id) ?? null,
      })) as AdminNotification[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!adminId) return;
    const ch = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-notifications", adminId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notification_reads", filter: `admin_id=eq.${adminId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-notifications", adminId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [adminId, qc]);

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!adminId || ids.length === 0) return;
      const rows = ids.map((notification_id) => ({ notification_id, admin_id: adminId }));
      const { error } = await supabase
        .from("admin_notification_reads")
        .upsert(rows, { onConflict: "notification_id,admin_id" });
      if (error) throw error;
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["admin-notifications", adminId] });
      const prev = qc.getQueryData<AdminNotification[]>(["admin-notifications", adminId]);
      if (prev) {
        const set = new Set(ids);
        const now = new Date().toISOString();
        qc.setQueryData<AdminNotification[]>(
          ["admin-notifications", adminId],
          prev.map((n) => (set.has(n.id) ? { ...n, read_at: n.read_at ?? now } : n)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-notifications", adminId], ctx.prev);
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const list = (qc.getQueryData<AdminNotification[]>(["admin-notifications", adminId]) ?? []).filter((n) => !n.read_at);
      await markRead.mutateAsync(list.map((n) => n.id));
    },
  });

  const data = query.data ?? [];
  const unreadCount = data.filter((n) => !n.read_at).length;

  return { ...query, data, unreadCount, markRead, markAllRead };
};
