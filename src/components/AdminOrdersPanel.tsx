import { useState, useMemo, useEffect } from "react";
import { useAdminOrders, type OrderStatus } from "@/hooks/use-orders";
import {
  useShippingLabelEvents,
  useSyncShippingStatus,
  useGenerateShippingLabel,
  SHIPPING_LABEL_STATUS_META,
  type ShippingLabelStatus,
  useCalculateShipping,
  type ShippingOption,
} from "@/hooks/use-shipping-label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User, UserCircle2, MapPin, Copy, ChevronDown, RefreshCw, History, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Package, Search, Truck, CheckCircle2, XCircle, Trash2, CreditCard, Clock, Wrench, Pencil, Download, Calendar, Printer } from "lucide-react";
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
  const syncShipping = useSyncShippingStatus();
  const generateLabel = useGenerateShippingLabel();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("payment_confirmed");
  const [editTracking, setEditTracking] = useState("");
  const [editNote, setEditNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [labelOrderId, setLabelOrderId] = useState<string | null>(null);

  // Auto-sync SuperFrete label status once per mount for non-terminal labels
  useEffect(() => {
    const stale = orders
      .filter((o) => (o as any).superfrete_order_id)
      .filter((o) => {
        const s = ((o as any).shipping_label_status ?? "pending") as ShippingLabelStatus;
        return s !== "delivered" && s !== "canceled";
      })
      .map((o) => o.id);
    if (stale.length === 0) return;
    let cancelled = false;
    // Fire and forget; ignore errors silently on background sync
    syncShipping.mutateAsync(stale).catch(() => undefined).finally(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);


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
      const ci = ((o as any).customer_info ?? {}) as { name?: string; full_name?: string; cpf?: string; phone?: string; email?: string };
      const isIdentified = !!((ci.name || ci.full_name || ci.email || "").trim());
      if (customerFilter === "identified" && !isIdentified) return false;
      if (customerFilter === "visitor" && isIdentified) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      if (o.id.toLowerCase().includes(s)) return true;
      if ((o.user_id ?? "").toLowerCase().includes(s)) return true;
      if ((o.tracking_code ?? "").toLowerCase().includes(s)) return true;
      if ((o.items as any[]).some((it) => (it.name ?? "").toLowerCase().includes(s))) return true;
      if ((ci.name ?? "").toLowerCase().includes(s)) return true;
      if ((ci.full_name ?? "").toLowerCase().includes(s)) return true;
      if ((ci.email ?? "").toLowerCase().includes(s)) return true;
      if ((ci.cpf ?? "").replace(/\D/g, "").includes(s.replace(/\D/g, ""))) return true;
      if ((ci.phone ?? "").replace(/\D/g, "").includes(s.replace(/\D/g, ""))) return true;
      return false;
    });
  }, [orders, search, statusFilter, customerFilter, dateFrom, dateTo]);

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

  const buildCSV = (list: typeof orders, kind: "full" | "shipping") => {
    const stamp = new Date().toISOString().slice(0, 10);
    let header: string[];
    let rows: string[][];
    if (kind === "shipping") {
      header = [
        "ID", "Data", "Cliente", "CPF", "E-mail", "Telefone",
        "CEP", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "UF",
        "Status pedido", "Status etiqueta", "Rastreio", "Etiqueta URL",
        "Serviço SF", "SF Order ID", "Frete (R$)", "Emitida em", "Emitida por",
      ];
      rows = list.map((o) => {
        const ci = ((o as any).customer_info ?? {}) as Record<string, any>;
        const addr = (ci.address ?? ci.shipping ?? ci) as Record<string, any>;
        const cep = String(addr.cep ?? addr.postal_code ?? "").replace(/\D/g, "");
        const status = ((o as any).shipping_label_status ?? "pending") as ShippingLabelStatus;
        const issuedAt = (o as any).shipping_label_issued_at as string | null;
        return [
          o.id,
          new Date(o.created_at).toLocaleString("pt-BR"),
          ci.name ?? ci.full_name ?? "",
          ci.cpf ?? ci.document ?? "",
          ci.email ?? "",
          ci.phone ?? "",
          cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep,
          addr.street ?? addr.address ?? "",
          String(addr.number ?? ""),
          addr.complement ?? addr.complemento ?? "",
          addr.neighborhood ?? addr.district ?? addr.bairro ?? "",
          addr.city ?? "",
          addr.state ?? addr.uf ?? "",
          statusConfig(o.status).label,
          SHIPPING_LABEL_STATUS_META[status]?.label ?? status,
          o.tracking_code ?? "",
          (o as any).shipping_label_url ?? "",
          (o as any).shipping_service ?? "",
          (o as any).superfrete_order_id ?? "",
          Number((o as any).shipping_cost ?? 0).toFixed(2).replace(".", ","),
          issuedAt ? new Date(issuedAt).toLocaleString("pt-BR") : "",
          (o as any).shipping_label_issued_by ?? "",
        ];
      });
    } else {
      header = [
        "ID", "Data", "Cliente (user_id)", "Status", "Total (R$)", "Código rastreio",
        "Itens (qtd × nome)", "Comprovante",
      ];
      rows = list.map((o) => [
        o.id,
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.user_id ?? "visitante",
        statusConfig(o.status).label,
        Number(o.total).toFixed(2).replace(".", ","),
        o.tracking_code ?? "",
        (o.items as any[]).map((it) => `${it.quantity}× ${it.name}`).join(" | "),
        o.receipt_url ?? "",
      ]);
    }
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = kind === "shipping" ? `envios-${stamp}.csv` : `pedidos-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${list.length} pedido(s) exportado(s).`);
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum pedido para exportar com os filtros atuais.");
      return;
    }
    buildCSV(filtered, "full");
  };

  const exportShippingCSV = () => {
    const list = selectedIds.size > 0
      ? orders.filter((o) => selectedIds.has(o.id))
      : filtered;
    if (list.length === 0) {
      toast.error("Nenhum pedido selecionado para exportar envio.");
      return;
    }
    buildCSV(list, "shipping");
  };

  const exportShippingPDF = () => {
    const list = selectedIds.size > 0
      ? orders.filter((o) => selectedIds.has(o.id))
      : filtered;
    if (list.length === 0) {
      toast.error("Nenhum pedido selecionado para imprimir.");
      return;
    }
    const rows = list.map((o) => {
      const ci = ((o as any).customer_info ?? {}) as Record<string, any>;
      const addr = (ci.address ?? ci.shipping ?? ci) as Record<string, any>;
      const cep = String(addr.cep ?? addr.postal_code ?? "").replace(/\D/g, "");
      const status = ((o as any).shipping_label_status ?? "pending") as ShippingLabelStatus;
      return `
        <div class="card">
          <div class="hd">
            <strong>#${o.id.slice(0, 8)}</strong>
            <span>${new Date(o.created_at).toLocaleString("pt-BR")}</span>
            <span class="badge">${SHIPPING_LABEL_STATUS_META[status]?.label ?? status}</span>
          </div>
          <div class="row"><b>Destinatário:</b> ${ci.name ?? ci.full_name ?? "—"} · ${ci.cpf ?? ""}</div>
          <div class="row"><b>Contato:</b> ${ci.email ?? ""} · ${ci.phone ?? ""}</div>
          <div class="row"><b>Endereço:</b> ${addr.street ?? ""}, ${addr.number ?? ""} ${addr.complement ? `— ${addr.complement}` : ""}</div>
          <div class="row"><b>Bairro:</b> ${addr.neighborhood ?? addr.district ?? "—"} · <b>${addr.city ?? ""}/${addr.state ?? ""}</b> · CEP ${cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep}</div>
          <div class="row"><b>Rastreio:</b> ${o.tracking_code ?? "—"} · <b>SF:</b> ${(o as any).superfrete_order_id ?? "—"}</div>
        </div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Envios ${new Date().toLocaleDateString("pt-BR")}</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;padding:16px;color:#111}
        h1{font-size:16px;margin:0 0 12px}
        .card{border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:10px;page-break-inside:avoid}
        .hd{display:flex;justify-content:space-between;gap:8px;font-size:12px;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:6px}
        .badge{background:#eef;padding:2px 6px;border-radius:4px}
        .row{font-size:12px;margin:2px 0}
      </style></head>
      <body><h1>Etiquetas de envio — ${list.length} pedido(s)</h1>${rows}
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Bloqueado pelo navegador"); return; }
    w.document.write(html);
    w.document.close();
  };


  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCustomerFilter("all");
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
  const hasActiveFilters = search.trim() || statusFilter !== "all" || customerFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Gerenciar Pedidos
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {filtered.length} pedido(s)
            {selectedIds.size > 0 && <> · <span className="text-primary font-semibold">{selectedIds.size} selecionado(s)</span></>}
            {" — "}<span className="text-foreground font-semibold">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={async () => {
              const list = selectedIds.size > 0
                ? Array.from(selectedIds)
                : filtered.filter((o) => (o as any).superfrete_order_id).map((o) => o.id);
              if (list.length === 0) { toast.info("Nenhum pedido com etiqueta para sincronizar."); return; }
              toast.loading("Sincronizando status SuperFrete…", { id: "sf-sync" });
              try {
                const res = await syncShipping.mutateAsync(list);
                const changed = res.results.filter((r) => r.changed).length;
                toast.success(`Sincronizados: ${res.checked}${changed > 0 ? ` · ${changed} atualizados` : ""}`, { id: "sf-sync" });
              } catch (e) {
                toast.error("Falha ao sincronizar status", { id: "sf-sync", description: (e as Error).message });
              }
            }}
            disabled={syncShipping.isPending}
          >
            {syncShipping.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar SF
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> CSV pedidos
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportShippingCSV}>
            <Download className="h-3.5 w-3.5" /> CSV envio{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={exportShippingPDF}>
            <Printer className="h-3.5 w-3.5" /> PDF envio{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
          )}
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
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 w-[180px]" aria-label="Filtrar por tipo de cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              <SelectItem value="identified">Identificados</SelectItem>
              <SelectItem value="visitor">Visitantes</SelectItem>
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
          <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
            <Checkbox
              id="select-all"
              checked={filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))}
              onCheckedChange={(v) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (v) filtered.forEach((o) => next.add(o.id));
                  else filtered.forEach((o) => next.delete(o.id));
                  return next;
                });
              }}
            />
            <label htmlFor="select-all">Selecionar todos os visíveis</label>
          </div>
          {filtered.map((order) => {
            const cfg = statusConfig(order.status);
            const Icon = cfg.icon;
            const ci = ((order as any).customer_info ?? {}) as { name?: string; full_name?: string; email?: string; phone?: string };
            const ciName = (ci.name || ci.full_name || "").trim();
            const ciEmail = (ci.email || "").trim();
            const ciPhone = (ci.phone || "").trim();
            const isIdentified = !!(ciName || ciEmail);
            const primaryLabel = ciName || ciEmail || "Cliente";
            const labelStatus = ((order as any).shipping_label_status ?? "pending") as ShippingLabelStatus;
            const labelMeta = SHIPPING_LABEL_STATUS_META[labelStatus] ?? SHIPPING_LABEL_STATUS_META.pending;
            const hasLabel = !!(order as any).superfrete_order_id;
            const lastSynced = (order as any).shipping_label_last_synced_at as string | null;
            return (
              <div key={order.id} className="border border-border rounded-lg p-3 bg-muted/10 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Checkbox
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={(v) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(order.id); else next.delete(order.id);
                          return next;
                        });
                      }}
                      aria-label="Selecionar pedido"
                    />
                    <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`}>
                      <Icon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${labelMeta.className} cursor-help`}>
                            <Truck className="h-3 w-3" /> {labelMeta.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {lastSynced
                            ? `Última sincronização: ${new Date(lastSynced).toLocaleString("pt-BR")}`
                            : "Ainda não sincronizado com a SuperFrete"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-[11px] text-muted-foreground font-mono">#{order.id.slice(0, 8)}</span>
                    <span className="text-[11px] text-muted-foreground">

                      {new Date(order.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isIdentified ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 bg-primary/5 text-foreground border-primary/30 cursor-help"
                            >
                              <UserCircle2 className="h-3 w-3" />
                              <span className="max-w-[160px] truncate">{primaryLabel}</span>
                              {ciName && ciEmail && (
                                <span className="text-muted-foreground/80 hidden sm:inline">· {ciEmail}</span>
                              )}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="space-y-0.5">
                              <div><span className="text-muted-foreground">Nome:</span> {ciName || "—"}</div>
                              <div><span className="text-muted-foreground">E-mail:</span> {ciEmail || "—"}</div>
                              <div><span className="text-muted-foreground">Telefone:</span> {ciPhone || "—"}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-muted/30 text-muted-foreground border-border">
                        <User className="h-3 w-3" /> Visitante
                      </Badge>
                    )}
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

                {(() => {
                  const full = ((order as any).customer_info ?? {}) as Record<string, any>;
                  const addr = (full.address ?? full.shipping ?? full) as Record<string, any>;
                  const cep = String(addr.cep ?? addr.postal_code ?? "").replace(/\D/g, "");
                  const cepFmt = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep || "—";
                  const street = addr.street ?? addr.address ?? "";
                  const number = addr.number ?? "";
                  const complement = addr.complement ?? addr.complemento ?? "";
                  const district = addr.neighborhood ?? addr.district ?? addr.bairro ?? "";
                  const city = addr.city ?? "";
                  const state = addr.state ?? addr.uf ?? "";
                  const cpf = full.cpf ?? full.document ?? "";
                  const labelUrl = (order as any).shipping_label_url as string | null;
                  const sfId = (order as any).superfrete_order_id as string | null;
                  const shippingCost = Number((order as any).shipping_cost ?? 0);
                  const hasAddress = !!(street || city || cep);
                  const addressLine = [
                    street && number ? `${street}, ${number}` : street,
                    complement,
                    district,
                    city && state ? `${city}/${state}` : city || state,
                    cepFmt !== "—" ? `CEP ${cepFmt}` : "",
                  ].filter(Boolean).join(" — ");
                  const copyAddress = async () => {
                    const text = [
                      ciName && `Nome: ${ciName}`,
                      cpf && `CPF: ${cpf}`,
                      ciPhone && `Tel: ${ciPhone}`,
                      addressLine && `Endereço: ${addressLine}`,
                    ].filter(Boolean).join("\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      toast.success("Dados de envio copiados");
                    } catch {
                      toast.error("Não foi possível copiar");
                    }
                  };
                  return (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-border/40 pt-2 group"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            Dados de envio
                            {labelUrl ? (
                              <Badge variant="outline" className="text-[10px] gap-1 bg-success/10 text-success border-success/30 ml-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Etiqueta emitida
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] gap-1 bg-muted/30 text-muted-foreground border-border ml-1">
                                Etiqueta pendente
                              </Badge>
                            )}
                          </span>
                          <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="rounded border border-border/50 bg-muted/20 p-2.5 text-[11px] space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground">{ciName || "—"}</span></div>
                            <div><span className="text-muted-foreground">CPF:</span> <span className="text-foreground">{cpf || "—"}</span></div>
                            <div><span className="text-muted-foreground">E-mail:</span> <span className="text-foreground break-all">{ciEmail || "—"}</span></div>
                            <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{ciPhone || "—"}</span></div>
                          </div>
                          {hasAddress ? (
                            <div className="pt-1 border-t border-border/40">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                <div><span className="text-muted-foreground">CEP:</span> <span className="text-foreground font-mono">{cepFmt}</span></div>
                                <div><span className="text-muted-foreground">Cidade/UF:</span> <span className="text-foreground">{city}{state ? `/${state}` : ""}</span></div>
                                <div className="sm:col-span-2"><span className="text-muted-foreground">Endereço:</span> <span className="text-foreground">{street}{number ? `, ${number}` : ""}{complement ? ` — ${complement}` : ""}</span></div>
                                <div className="sm:col-span-2"><span className="text-muted-foreground">Bairro:</span> <span className="text-foreground">{district || "—"}</span></div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground italic">Sem endereço de entrega registrado.</p>
                          )}
                          <div className="pt-1 border-t border-border/40 space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-muted-foreground">Etiqueta SuperFrete:</span>
                              {labelUrl ? (
                                <a href={labelUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                  <Printer className="h-3 w-3" /> Abrir DANFE / etiqueta
                                </a>
                              ) : (
                                <span className="text-muted-foreground">Não emitida</span>
                              )}
                            </div>
                            {order.tracking_code && (
                              <div><span className="text-muted-foreground">Rastreio:</span> <span className="font-mono text-foreground">{order.tracking_code}</span></div>
                            )}
                            {shippingCost > 0 && (
                              <div><span className="text-muted-foreground">Frete:</span> <span className="text-foreground">R$ {shippingCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                            )}
                            {sfId && (
                              <div className="text-[10px] text-muted-foreground/70 font-mono break-all">SF #{sfId}</div>
                            )}
                          </div>
                          <div className="flex justify-end pt-1">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={copyAddress}>
                              <Copy className="h-3 w-3" /> Copiar dados
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })()}

                <div className="flex items-center gap-2 pt-1 border-t border-border/40 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(order.id, order.status, order.tracking_code)}>
                    <Pencil className="h-3 w-3" /> Atualizar status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 gap-1 text-xs"
                    onClick={() => setLabelOrderId(order.id)}
                  >
                    {hasLabel ? <Send className="h-3 w-3" /> : <Printer className="h-3 w-3" />}
                    {hasLabel ? "Reenviar etiqueta" : "Gerar etiqueta"}
                  </Button>
                  {hasLabel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs"
                      disabled={syncShipping.isPending}
                      onClick={async () => {
                        toast.loading("Sincronizando…", { id: `sync-${order.id}` });
                        try {
                          const res = await syncShipping.mutateAsync([order.id]);
                          const r = res.results[0];
                          toast.success(`Status: ${SHIPPING_LABEL_STATUS_META[r?.status ?? "pending"]?.label ?? "—"}`, { id: `sync-${order.id}` });
                        } catch (e) {
                          toast.error("Falha ao sincronizar", { id: `sync-${order.id}`, description: (e as Error).message });
                        }
                      }}
                    >
                      <RefreshCw className="h-3 w-3" /> Sincronizar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => setHistoryOrderId(order.id)}>
                    <History className="h-3 w-3" /> Histórico
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
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Esta ação é permanente e não pode ser desfeita.</p>
                {(() => {
                  const o = orders.find((x) => x.id === deleteId);
                  if (!o) return null;
                  const willRestock = o.status === "payment_confirmed" || o.status === "preparing" || o.status === "shipped" || o.status === "delivered";
                  return (
                    <div className="rounded border bg-muted/40 p-2 text-xs space-y-1">
                      <p><strong>Status:</strong> {statusConfig(o.status).label}</p>
                      <p><strong>Itens:</strong> {(o.items as any[]).reduce((s, it) => s + Number(it.quantity || 0), 0)}</p>
                      {willRestock ? (
                        <p className="text-emerald-700">✓ Estoque será reposto automaticamente e registrado na auditoria.</p>
                      ) : (
                        <p className="text-muted-foreground">Pedido sem débito de estoque — nada a repor.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShippingLabelHistoryDialog orderId={historyOrderId} onClose={() => setHistoryOrderId(null)} />
      <ShippingOptionDialog
        order={orders.find((o) => o.id === labelOrderId) ?? null}
        onClose={() => setLabelOrderId(null)}
      />
    </div>
  );
};



const EVENT_TYPE_LABEL: Record<string, string> = {
  issued: "Etiqueta emitida",
  resent: "Etiqueta reenviada",
  synced: "Status sincronizado",
  canceled: "Etiqueta cancelada",
  error: "Erro no processo",
};

const ShippingLabelHistoryDialog = ({ orderId, onClose }: { orderId: string | null; onClose: () => void }) => {
  const { data: events = [], isLoading } = useShippingLabelEvents(orderId ?? undefined);
  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico da etiqueta
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado para este pedido.</p>
        ) : (
          <ol className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {events.map((ev) => {
              const meta = ev.status ? SHIPPING_LABEL_STATUS_META[ev.status] : null;
              return (
                <li key={ev.id} className="border border-border/60 rounded-lg p-3 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{EVENT_TYPE_LABEL[ev.event_type] ?? ev.event_type}</span>
                    {meta && <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>{meta.label}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Origem:</span> {ev.source === "cron" ? "Sincronização automática" : ev.source}
                    {ev.actor_email && <> · {ev.actor_email}</>}
                    {!ev.actor_email && ev.actor_id && <> · <span className="font-mono">{ev.actor_id.slice(0, 8)}</span></>}
                  </div>
                  {ev.tracking_code && (
                    <div className="text-[11px]"><span className="text-muted-foreground">Rastreio:</span> <span className="font-mono">{ev.tracking_code}</span></div>
                  )}
                  {ev.label_url && (
                    <a href={ev.label_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                      <Printer className="h-3 w-3" /> Abrir etiqueta
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOrdersPanel;

