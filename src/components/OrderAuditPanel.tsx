import { useState, useMemo } from "react";
import { useOrderStatusAudit } from "@/hooks/use-admin-audit";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Search, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  payment_confirmed: "Pagamento confirmado",
  preparing: "Em preparação",
  shipped: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const OrderAuditPanel = () => {
  const { data: entries = [], isLoading } = useOrderStatusAudit(300);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const s = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.order_id.toLowerCase().includes(s) ||
        (e.changed_by_email ?? "").toLowerCase().includes(s) ||
        (e.note ?? "").toLowerCase().includes(s) ||
        e.to_status.toLowerCase().includes(s)
    );
  }, [entries, search]);

  if (isLoading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> Auditoria de Pedidos
        </h3>
        <div className="text-xs text-muted-foreground">{filtered.length} alteração(ões)</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por pedido, email do admin, nota ou status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 text-xs bg-muted/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhuma alteração registrada.</p>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/conta/pedidos/${e.order_id}`}
                    className="text-xs font-mono text-primary hover:underline inline-flex items-center gap-1"
                  >
                    #{e.order_id.slice(0, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px]">
                  {e.from_status ? (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                      {STATUS_LABEL[e.from_status] ?? e.from_status}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">criado</Badge>
                  )}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge className="text-[9px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                    {STATUS_LABEL[e.to_status] ?? e.to_status}
                  </Badge>
                </div>
                {e.note && (
                  <p className="text-[11px] text-muted-foreground italic mt-1 truncate">"{e.note}"</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Por</p>
                <p className="text-[11px] text-foreground truncate max-w-[180px]">
                  {e.changed_by_email ?? (e.changed_by ? `${e.changed_by.slice(0, 8)}…` : "sistema")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default OrderAuditPanel;
