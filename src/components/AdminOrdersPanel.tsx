import { useState, useMemo, useEffect } from "react";
import { useAdminOrders, type OrderStatus } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Package, Search, Truck, CheckCircle2, XCircle, Trash2, CreditCard, Clock, Wrench, Pencil, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS: { value: OrderStatus; label: string; icon: typeof Package; className: string }[] = [
  { value: "pending_payment", label: "Aguardando pagamento", icon: Clock, className: "bg-muted text-muted-foreground border-border" },
  { value: "payment_confirmed", label: "Pagamento confirmado", icon: CreditCard, className: "bg-primary/10 text-primary border-primary/30" },
  { value: "preparing", label: "Em preparação", icon: Wrench, className: "bg-accent/10 text-accent border-accent/30" },
  { value: "shipped", label: "Despachado", icon: Truck, className: "bg-accent/10 text-accent border-accent/30" },
  { value: "delivered", label: "Entregue", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" },
  { value: "cancelled", label: "Cancelado", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
];

const statusConfig = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status) ?? { value: status as OrderStatus, label: status, icon: Package, className: "bg-muted text-muted-foreground border-border" };

const csvEscape = (val: unknown): string => {
  const s = String(val ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const AdminOrdersPanel = () => {
  const { orders, isLoading, updateStatus, removeOrder } = useAdminOrders();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("payment_confirmed");
  const [editTracking, setEditTracking] = useState("");
  const [editNote, setEditNote] = useState("");

  // Realtime: notify on new orders
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const total = Number((payload.new as any)?.total ?? 0);
        toast.success(`🛒 Novo pedido recebido — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, {
          duration: 6000,
        });
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      if (o.id.toLowerCase().includes(s)) return true;
      if ((o.user_id ?? "").toLowerCase().includes(s)) return true;
      if ((o.tracking_code ?? "").toLowerCase().includes(s)) return true;
      if ((o.items as any[]).some((it) => (it.name ?? "").toLowerCase().includes(s))) return true;
      const ci = ((o as any).customer_info ?? {}) as { name?: string; cpf?: string; phone?: string; email?: string };
      if ((ci.name ?? "").toLowerCase().includes(s)) return true;
      if ((ci.email ?? "").toLowerCase().includes(s)) return true;
      if ((ci.cpf ?? "").replace(/\D/g, "").includes(s.replace(/\D/g, ""))) return true;
      if ((ci.phone ?? "").replace(/\D/g, "").includes(s.replace(/\D/g, ""))) return true;
      return false;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const openEdit = (orderId: string, currentStatus: OrderStatus, currentTracking: string | null) => {
    setEditingOrderId(orderId);
    setEditStatus(currentStatus);
    setEditTracking(currentTracking ?? "");
    setEditNote("");
  };

  const submitEdit = async () => {
    if (!editingOrderId) return;
    try {
      await updateStatus.mutateAsync({
        id: editingOrderId,
        status: editStatus,
        tracking_code: editTracking.trim() || null,
        note: editNote.trim() || undefined,
      });
      toast.success("Pedido atualizado! Email enviado ao cliente.");
      setEditingOrderId(null);
    } catch {
      toast.error("Erro ao atualizar pedido.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await removeOrder.mutateAsync(deleteId);
      toast.success("Pedido removido!");
    } catch {
      toast.error("Erro ao remover pedido.");
    }
    setDeleteId(null);
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum pedido para exportar com os filtros atuais.");
      return;
    }
    const header = [
      "ID", "Data", "Cliente (user_id)", "Status", "Total (R$)", "Código rastreio",
      "Itens (qtd × nome)", "Comprovante",
    ];
    const rows = filtered.map((o) => [
      o.id,
      new Date(o.created_at).toLocaleString("pt-BR"),
      o.user_id ?? "visitante",
      statusConfig(o.status).label,
      Number(o.total).toFixed(2).replace(".", ","),
      o.tracking_code ?? "",
      (o.items as any[]).map((it) => `${it.quantity}× ${it.name}`).join(" | "),
      o.receipt_url ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `pedidos-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} pedido(s) exportado(s).`);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalRevenue = filtered.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const hasActiveFilters = search.trim() || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Gerenciar Pedidos
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {filtered.length} pedido(s) — <span className="text-foreground font-semibold">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, nome, CPF, telefone, email, item ou rastreio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs bg-muted/30 border-border/50"
              aria-label="Buscar pedidos"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 w-[200px]" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="date-from" className="text-[11px] text-muted-foreground">De</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs bg-muted/30 border-border/50 w-[150px]"
            />
            <Label htmlFor="date-to" className="text-[11px] text-muted-foreground">até</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-xs bg-muted/30 border-border/50 w-[150px]"
            />
          </div>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const cfg = statusConfig(order.status);
            const Icon = cfg.icon;
            const ci = ((order as any).customer_info ?? {}) as { name?: string; full_name?: string; email?: string; phone?: string };
            const customerName = ci.name || ci.full_name || ci.email || (order.user_id ? "Cliente" : "Visitante");
            return (
              <div key={order.id} className="border border-border rounded-lg p-3 bg-muted/10 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`}>
                      <Icon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">#{order.id.slice(0, 8)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-foreground border-primary/30">
                      {customerName}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {order.user_id ? "Cliente" : "Visitante"}
                    </Badge>
                    {order.tracking_code && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-accent/5">
                        <Truck className="h-3 w-3" /> {order.tracking_code}
                      </Badge>
                    )}
                    {order.receipt_url && (
                      <a href={order.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">
                        comprovante PIX
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary font-display">
                      R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5 pl-1">
                  {(order.items as any[]).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate flex-1">{item.quantity}× {item.name}</span>
                      <span className="shrink-0 ml-2">R$ {Number(item.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/40 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(order.id, order.status, order.tracking_code)}>
                    <Pencil className="h-3 w-3" /> Atualizar status
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(order.id)} aria-label="Remover pedido">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingOrderId} onOpenChange={(open) => !open && setEditingOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Atualizar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status-select">Novo status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as OrderStatus)}>
                <SelectTrigger id="status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(editStatus === "shipped" || editTracking) && (
              <div>
                <Label htmlFor="tracking">Código de rastreio (Correios)</Label>
                <Input id="tracking" value={editTracking} onChange={(e) => setEditTracking(e.target.value.toUpperCase())} placeholder="Ex: BR123456789BR" />
              </div>
            )}
            <div>
              <Label htmlFor="note">Observação para o cliente (opcional)</Label>
              <Textarea id="note" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ex: Despachado pelo SEDEX hoje pela manhã" rows={3} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Um email automático será enviado ao cliente com a nova situação.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrderId(null)}>Cancelar</Button>
            <Button onClick={submitEdit} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Salvar e notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Remover pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOrdersPanel;
