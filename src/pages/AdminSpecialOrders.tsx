import { useNavigate } from "react-router-dom";
import { useAdminSpecialOrders, SPECIAL_ORDER_STATUS_LABELS } from "@/hooks/use-special-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronRight, Search, Package } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";

const statusBadgeVariant: Record<string, string> = {
  requested: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  quoted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-green-500/10 text-green-500 border-green-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  ordered: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  received: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  shipped: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const AdminSpecialOrders = () => {
  const navigate = useNavigate();
  const { orders, isLoading } = useAdminSpecialOrders();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = (orders ?? []).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const info = o.customer_info || {};
    return (
      o.id.toLowerCase().includes(q) ||
      (info.email && info.email.toLowerCase().includes(q)) ||
      (info.name && info.name.toLowerCase().includes(q)) ||
      (info.phone && info.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-gradient cursor-pointer" onClick={() => navigate("/admin")}>
            Spencer's Cardtopia
          </h1>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-foreground font-display">Encomendas Especiais</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por ID, e-mail, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(SPECIAL_ORDER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Nenhuma encomenda encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const info = order.customer_info || {};
              return (
                <div key={order.id} onClick={() => navigate(`/admin/encomendas/${order.id}`)} className="glass-card p-4 cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className={statusBadgeVariant[order.status] || ""}>
                        {SPECIAL_ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-sm text-foreground">{info.name || info.email || "Cliente"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary font-display">
                        R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSpecialOrders;
