import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  inventory_item_id: string;
  quantity_delta: number;
  source: string;
  order_id: string | null;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString("pt-BR");

const DeletedOrdersPanel = () => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["deleted-orders-audit"],
    queryFn: async () => {
      const [auditRes, ordersRes] = await Promise.all([
        supabase
          .from("inventory_audit")
          .select("*")
          .in("source", ["order_delete", "order_trigger", "order_confirm"])
          .not("order_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("orders").select("id"),
      ]);
      if (auditRes.error) throw auditRes.error;
      if (ordersRes.error) throw ordersRes.error;
      const rows = (auditRes.data ?? []) as AuditRow[];
      const existing = new Set((ordersRes.data ?? []).map((o) => o.id as string));

      // Enrich with product names and customer display names
      const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id).filter(Boolean)));
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));

      const [invRes, profRes] = await Promise.all([
        itemIds.length
          ? supabase.from("inventory").select("id, name").in("id", itemIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from("customer_profiles").select("id, display_name").in("id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const productNames = new Map<string, string>();
      for (const p of (invRes.data ?? []) as { id: string; name: string }[]) {
        productNames.set(p.id, p.name);
      }
      const customerNames = new Map<string, string>();
      for (const p of (profRes.data ?? []) as { id: string; display_name: string | null }[]) {
        if (p.display_name) customerNames.set(p.id, p.display_name);
      }

      return { rows, existing, productNames, customerNames };
    },
  });

  const productNames = data?.productNames ?? new Map<string, string>();
  const customerNames = data?.customerNames ?? new Map<string, string>();

  const { deletedGroups, orphans } = useMemo(() => {
    const rows = data?.rows ?? [];
    const existing = data?.existing ?? new Set<string>();

    // group by order_id
    const byOrder = new Map<string, AuditRow[]>();
    for (const r of rows) {
      if (!r.order_id) continue;
      const arr = byOrder.get(r.order_id) ?? [];
      arr.push(r);
      byOrder.set(r.order_id, arr);
    }

    const deletedGroups: { orderId: string; debit: AuditRow[]; restock: AuditRow[]; lastAt: string }[] = [];
    const orphans: { orderId: string; debit: AuditRow[]; lastAt: string }[] = [];

    for (const [orderId, arr] of byOrder) {
      const debit = arr.filter((r) => r.quantity_delta < 0 && (r.source === "order_trigger" || r.source === "order_confirm"));
      const restock = arr.filter((r) => r.source === "order_delete" && r.quantity_delta > 0);
      if (debit.length === 0 && restock.length === 0) continue;
      const lastAt = arr[0].created_at;
      if (!existing.has(orderId)) {
        if (restock.length > 0) {
          deletedGroups.push({ orderId, debit, restock, lastAt });
        } else if (debit.length > 0) {
          orphans.push({ orderId, debit, lastAt });
        }
      }
    }

    deletedGroups.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    orphans.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return { deletedGroups, orphans };
  }, [data]);

  const runRestock = async (orderId: string, debits: AuditRow[]) => {
    try {
      // Aggregate per item
      const perItem = new Map<string, number>();
      for (const d of debits) {
        perItem.set(d.inventory_item_id, (perItem.get(d.inventory_item_id) ?? 0) + Math.abs(d.quantity_delta));
      }
      for (const [itemId, qty] of perItem) {
        const { data: inv, error: e1 } = await supabase.from("inventory").select("quantity").eq("id", itemId).maybeSingle();
        if (e1) throw e1;
        if (!inv) continue;
        const { error: e2 } = await supabase
          .from("inventory")
          .update({ quantity: (inv.quantity ?? 0) + qty })
          .eq("id", itemId);
        if (e2) throw e2;
        const { error: e3 } = await supabase.from("inventory_audit").insert({
          inventory_item_id: itemId,
          quantity_delta: qty,
          source: "order_delete",
          order_id: orderId,
          metadata: { backfill: true, note: "Reposição manual via painel de pedidos excluídos" },
        });
        if (e3) throw e3;
      }
      toast.success(`Estoque reposto para pedido ${orderId.slice(0, 8)}…`);
      refetch();
    } catch (e: any) {
      toast.error("Falha ao repor estoque", { description: e?.message });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div id="deleted-orders-panel" className="space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2"><Trash2 className="h-4 w-4" /> Pedidos excluídos com impacto em estoque</h3>
          <p className="text-xs text-muted-foreground">Rastreia reposições automáticas e detecta débitos órfãos por conta e produto.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {orphans.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-sm">Débitos órfãos ({orphans.length}) — pedido excluído sem reposição</span>
          </div>
          <ul className="space-y-2">
            {orphans.map((o) => {
              const userIds = Array.from(new Set(o.debit.map((d) => d.user_id).filter((v): v is string => !!v)));
              return (
                <li key={o.orderId} className="rounded border bg-card p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono truncate" title={o.orderId}>Pedido: {o.orderId}</p>
                      <p className="text-muted-foreground">{formatDate(o.lastAt)}</p>
                      {userIds.length > 0 && (
                        <p className="mt-1">
                          <span className="text-[10px] uppercase text-muted-foreground mr-1">Conta:</span>
                          {userIds.map((uid) => (
                            <Badge key={uid} variant="secondary" className="mr-1 h-4 text-[10px]">
                              {customerNames.get(uid) ?? uid.slice(0, 8)}
                            </Badge>
                          ))}
                        </p>
                      )}
                      <p className="text-[10px] uppercase text-muted-foreground mt-1">Produtos afetados</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {o.debit.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center gap-1">
                            <span className="font-medium">{productNames.get(d.inventory_item_id) ?? "(sem nome)"}</span>
                            <Badge variant="outline" className="h-4 text-[10px]">{d.inventory_item_id}</Badge>
                            <span className="text-muted-foreground">débito {d.quantity_delta}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => runRestock(o.orderId, o.debit)} className="shrink-0 h-7">
                      Repor estoque
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {deletedGroups.length === 0 && orphans.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
          Nenhum pedido excluído com impacto em estoque.
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="p-3 border-b bg-muted/30">
            <span className="text-sm font-medium">Histórico de reposições ({deletedGroups.length})</span>
          </div>
          <ul className="divide-y">
            {deletedGroups.map((g) => (
              <li key={g.orderId} className="p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono truncate">{g.orderId}</p>
                    <p className="text-muted-foreground">{formatDate(g.lastAt)}</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 shrink-0">Reposto</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Débito</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {g.debit.map((d) => (
                        <li key={d.id}>
                          <Badge variant="outline" className="mr-1 h-4 text-[10px]">{d.inventory_item_id}</Badge>
                          {d.quantity_delta}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Reposição</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {g.restock.map((d) => (
                        <li key={d.id}>
                          <Badge variant="outline" className="mr-1 h-4 text-[10px]">{d.inventory_item_id}</Badge>
                          +{d.quantity_delta}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DeletedOrdersPanel;
