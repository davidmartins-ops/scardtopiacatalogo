import useSEO from "@/hooks/use-seo";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrderDetail, useAdminOrders, type OrderStatus } from "@/hooks/use-orders";
import {
  useShippingLabelEvents,
  useSyncShippingStatus,
  useGenerateShippingLabel,
  SHIPPING_LABEL_STATUS_META,
  type ShippingLabelStatus,
} from "@/hooks/use-shipping-label";
import { OrderStatusBadge, ORDER_STATUS_LABELS } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  Truck,
  FileText,
  RefreshCw,
  Copy,
  Trash2,
  Save,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment",
  "payment_confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

const AdminOrderDetail = () => {
  useSEO({ title: "Gerenciar pedido — Admin", noindex: true });
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useOrderDetail(orderId);
  const { updateStatus, removeOrder } = useAdminOrders();
  const { data: events = [] } = useShippingLabelEvents(orderId);
  const syncStatus = useSyncShippingStatus();
  const generateLabel = useGenerateShippingLabel();

  const order = data?.order;
  const history = data?.history ?? [];
  const orderRaw = (order ?? {}) as unknown as Record<string, unknown>;
  const customer = ((orderRaw.customer_info ?? {}) as Record<string, unknown>);

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [tracking, setTracking] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Initialize form defaults when order loads
  useMemo(() => {
    if (order) {
      setStatus((prev) => prev || order.status);
      setTracking((prev) => (prev !== "" ? prev : order.tracking_code ?? ""));
    }
  }, [order]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-3">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Link to="/admin"><Button variant="outline">Voltar ao painel</Button></Link>
      </div>
    );
  }

  const shortId = order.id.slice(0, 8).toUpperCase();
  const labelStatus = ((orderRaw.shipping_label_status as ShippingLabelStatus | null | undefined) ?? "pending") as ShippingLabelStatus;
  const labelMeta = SHIPPING_LABEL_STATUS_META[labelStatus];
  const labelUrl = (orderRaw.shipping_label_url as string | null | undefined) ?? null;
  const superfreteId = (orderRaw.superfrete_order_id as string | null | undefined) ?? null;

  const saveStatus = async () => {
    if (!status || (status === order.status && tracking === (order.tracking_code ?? ""))) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: status as OrderStatus,
        tracking_code: tracking || null,
        note: note || undefined,
      });
      toast.success("Pedido atualizado.");
      setNote("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar pedido.";
      toast.error(msg);
    }
  };

  const copyCustomer = async () => {
    const address = (customer.address ?? {}) as Record<string, unknown>;
    const lines = [
      `Nome: ${customer.name ?? "-"}`,
      `E-mail: ${customer.email ?? "-"}`,
      `CPF: ${customer.cpf ?? "-"}`,
      `Telefone: ${customer.phone ?? "-"}`,
      address && Object.keys(address).length > 0
        ? `Endereço: ${Object.entries(address).map(([k, v]) => `${k}: ${v}`).join(", ")}`
        : "Endereço: -",
      `Método: ${customer.deliveryMethod ?? "-"}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Dados do cliente copiados.");
  };

  const emitLabel = async () => {
    try {
      const res = await generateLabel.mutateAsync({ orderId: order.id, checkout: true });
      toast.success(res.resent ? "Etiqueta reenviada." : "Etiqueta emitida.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao emitir etiqueta.";
      toast.error(msg);
    }
  };

  const syncNow = async () => {
    try {
      await syncStatus.mutateAsync([order.id]);
      toast.success("Status sincronizado.");
    } catch {
      toast.error("Falha ao sincronizar.");
    }
  };

  const deleteOrder = async () => {
    try {
      await removeOrder.mutateAsync(order.id);
      toast.success("Pedido removido. Estoque foi reposto automaticamente.");
      navigate("/admin");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir.";
      toast.error(msg);
    }
  };

  const address = (customer.address ?? {}) as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Painel</Link>
          </Button>
          <Link to="/"><img src={logo} alt="Spencer's Cardtopia" className="h-9" /></Link>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-display">
              <span className="text-gradient">Pedido #{shortId}</span>
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <OrderStatusBadge status={order.status} />
              <Badge variant="outline" className={labelMeta.className}>
                Etiqueta: {labelMeta.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Criado em {new Date(order.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Excluir pedido
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir pedido #{shortId}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O estoque será reposto automaticamente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir e repor estoque
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Status control */}
        <section className="glass-card p-5 space-y-4" aria-labelledby="status-heading">
          <h2 id="status-heading" className="font-display text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Gerenciar status
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Status do pedido</Label>
              <Select value={status || order.status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tracking">Código de rastreio</Label>
              <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ex: AA123456789BR" />
            </div>
          </div>
          <div>
            <Label htmlFor="note">Nota interna (opcional — enviada no e-mail)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Postagem confirmada nos Correios." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveStatus} disabled={updateStatus.isPending} className="gap-2">
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </section>

        {/* Customer info */}
        <section className="glass-card p-5" aria-labelledby="customer-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="customer-heading" className="font-display text-base font-semibold">Cliente</h2>
            <Button variant="outline" size="sm" className="gap-1" onClick={copyCustomer}>
              <Copy className="h-3.5 w-3.5" /> Copiar dados
            </Button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{String(customer.name ?? "-")}</dd></div>
            <div><dt className="text-muted-foreground">E-mail</dt><dd className="font-medium break-all">{String(customer.email ?? "-")}</dd></div>
            <div><dt className="text-muted-foreground">CPF</dt><dd className="font-medium">{String(customer.cpf ?? "-")}</dd></div>
            <div><dt className="text-muted-foreground">Telefone</dt><dd className="font-medium">{String(customer.phone ?? "-")}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Entrega</dt>
              <dd className="font-medium">
                {String(customer.deliveryMethod ?? "-")}
                {Object.keys(address).length > 0 && (
                  <div className="mt-1 text-sm text-muted-foreground font-normal">
                    {Object.entries(address).map(([k, v]) => (
                      <div key={k}><span className="capitalize">{k}</span>: {String(v)}</div>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* Items */}
        <section className="glass-card p-5" aria-labelledby="items-heading">
          <h2 id="items-heading" className="font-display text-base font-semibold mb-3">Itens</h2>
          <ul className="space-y-2">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                <span className="flex-1 truncate">
                  {it.quantity}× {it.name}
                  {it.language ? <span className="text-xs text-muted-foreground"> · {it.language}</span> : null}
                  {it.condition ? <span className="text-xs text-muted-foreground"> · {it.condition}</span> : null}
                  <span className="text-[11px] text-muted-foreground block font-mono">{it.id}</span>
                </span>
                <span className="font-medium ml-3">R$ {Number(it.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-primary font-display">
              R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </section>

        {/* Shipping label */}
        <section className="glass-card p-5" aria-labelledby="ship-heading">
          <h2 id="ship-heading" className="font-display text-base font-semibold mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Etiqueta SuperFrete
          </h2>
          <div className="text-sm space-y-1 mb-3">
            <p><span className="text-muted-foreground">ID SuperFrete:</span> <span className="font-mono">{superfreteId ?? "—"}</span></p>
            <p><span className="text-muted-foreground">Rastreio:</span> <span className="font-mono">{order.tracking_code ?? "—"}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={emitLabel} disabled={generateLabel.isPending} className="gap-1">
              {generateLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {superfreteId ? "Reemitir etiqueta" : "Emitir etiqueta"}
            </Button>
            <Button size="sm" variant="outline" onClick={syncNow} disabled={syncStatus.isPending} className="gap-1">
              {syncStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar status
            </Button>
            {labelUrl && (
              <a href={labelUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir etiqueta
                </Button>
              </a>
            )}
          </div>
          {events.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico da etiqueta</p>
              <ul className="space-y-1.5 text-xs">
                {events.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5">
                    <div>
                      <span className="font-medium capitalize">{e.event_type}</span>
                      {e.status && <span className="text-muted-foreground"> · {e.status}</span>}
                      {e.actor_email && <div className="text-muted-foreground">{e.actor_email}</div>}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Receipt */}
        {order.receipt_url && (
          <section className="glass-card p-5" aria-labelledby="receipt-heading">
            <h2 id="receipt-heading" className="font-display text-base font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Comprovante PIX
            </h2>
            <a href={order.receipt_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir comprovante
              </Button>
            </a>
          </section>
        )}

        {/* Status history */}
        <section className="glass-card p-5" aria-labelledby="history-heading">
          <h2 id="history-heading" className="font-display text-base font-semibold mb-3">Histórico de status</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                  <div>
                    <p className="font-medium">
                      {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}{ORDER_STATUS_LABELS[h.to_status]}
                    </p>
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminOrderDetail;
