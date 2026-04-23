import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Filter, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  inventory_item_id: string;
  quantity_delta: number;
  source: string;
  user_id: string | null;
  order_id: string | null;
  created_at: string;
  metadata: any;
}

const InventoryAuditPanel = () => {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [itemFilter, setItemFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["inventory-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (itemFilter && !r.inventory_item_id.toLowerCase().includes(itemFilter.toLowerCase())) return false;
      if (userFilter && !(r.user_id ?? "").toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, from, to, itemFilter, userFilter]);

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("Nada para exportar."); return; }
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["id", "created_at", "inventory_item_id", "quantity_delta", "source", "user_id", "order_id", "metadata"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      lines.push([r.id, r.created_at, r.inventory_item_id, r.quantity_delta, r.source, r.user_id ?? "", r.order_id ?? "", JSON.stringify(r.metadata ?? {})].map(esc).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_audit_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} linhas exportadas.`);
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" /> Auditoria de Estoque
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
          </Button>
          <Button size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> Item ID</label>
          <Input placeholder="SLDXX01..." value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> Usuário (UUID)</label>
          <Input placeholder="uuid..." value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} de {rows.length} registros</p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-2 font-medium">Data</th>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Δ Qtd</th>
              <th className="px-2 py-2 font-medium">Origem</th>
              <th className="px-2 py-2 font-medium">Usuário</th>
              <th className="px-2 py-2 font-medium">Pedido</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline text-primary" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-2 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-2 py-2 font-mono text-[11px]">{r.inventory_item_id}</td>
                <td className={`px-2 py-2 font-bold ${r.quantity_delta < 0 ? "text-destructive" : "text-success"}`}>{r.quantity_delta}</td>
                <td className="px-2 py-2"><Badge variant="outline" className="text-[10px]">{r.source}</Badge></td>
                <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}</td>
                <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{r.order_id ? r.order_id.slice(0, 8) + "…" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryAuditPanel;
