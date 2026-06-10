import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useOrderDetail, useOrderDisputes, type OrderStatus } from "@/hooks/use-orders";
import { useOrderRefunds, type RefundMethod, type RefundStatus } from "@/hooks/use-refunds";
import { useInventory } from "@/hooks/use-inventory";
import { useSavedCart } from "@/hooks/use-saved-cart";
import { OrderStatusBadge, ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart as CartIcon, Truck, ExternalLink, FileText, AlertTriangle, Loader2, RefreshCw, DollarSign } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const DISPUTE_REASONS = [
  { value: "defective", label: "Produto com defeito" },
  { value: "not_as_described", label: "Diferente do anunciado" },
  { value: "wrong_item", label: "Item errado" },
  { value: "missing_item", label: "Item faltando" },
  { value: "regret", label: "Arrependimento (CDC art. 49 — até 7 dias após entrega)" },
  { value: "other", label: "Outro motivo" },
];

const TIMELINE_ORDER: OrderStatus[] = ["payment_confirmed", "preparing", "shipped", "delivered"];

const OrderDetailPage = () => {
  useSEO({ title: "Detalhes do pedido", noindex: true });
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useOrderDetail(orderId);
  const { data: inventory = [] } = useInventory();
  const { syncCart } = useSavedCart();
  const { disputes, createDispute } = useOrderDisputes(orderId);
  const { refunds, requestRefund } = useOrderRefunds(orderId);

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("defective");
  const [description, setDescription] = useState("");

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("pix");
  const [refundPix, setRefundPix] = useState("");

  const order = data?.order;
  const history = data?.history ?? [];

  const canDispute = useMemo(() => {
    if (!order) return false;
    if (order.status === "cancelled") return false;
    if (disputes.some((d) => d.status === "open" || d.status === "in_review")) return false;
    return true;
  }, [order, disputes]);

  const reorder = async () => {
    if (!order) return;
    const items = order.items
      .map((it) => {
        const inv = inventory.find((i) => i.id === it.id);
        if (!inv || inv.quantity <= 0) return null;
        return { inventory_item_id: it.id, quantity: Math.min(it.quantity, inv.quantity) };
      })
      .filter(Boolean) as { inventory_item_id: string; quantity: number }[];

    if (items.length === 0) {
      toast.error("Nenhum item deste pedido está disponível no estoque.");
      return;
    }

    const missing = order.items.length - items.length;
    try {
      await syncCart.mutateAsync(items);
      toast.success(missing > 0 ? `${items.length} itens adicionados. ${missing} indisponível(is).` : "Itens adicionados ao carrinho!");
      navigate("/catalogo");
    } catch {
      toast.error("Erro ao adicionar ao carrinho.");
    }
  };

  const submitDispute = async () => {
    if (!order || !description.trim()) return;
    try {
      await createDispute.mutateAsync({
        order_id: order.id,
        reason,
        description: description.trim(),
      });
      toast.success("Solicitação enviada! Responderemos em breve.");
      setDisputeOpen(false);
      setDescription("");
    } catch {
      toast.error("Erro ao enviar solicitação.");
    }
  };

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
        <Link to="/conta?tab=orders"><Button variant="outline">Voltar</Button></Link>
      </div>
    );
  }

  const shortId = order.id.slice(0, 8).toUpperCase();
  const currentIdx = TIMELINE_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta?tab=orders" className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Meus pedidos
          </Link>
          <Link to="/"><img src={logo} alt="Spencer's Cardtopia" className="h-10" /></Link>
          <div className="w-20" />
        </div>
      </div>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            <span className="text-gradient">Pedido #{shortId}</span>
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-muted-foreground">
              Criado em {new Date(order.created_at).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-muted-foreground">
              · Atualizado em {new Date(order.status_updated_at).toLocaleString("pt-BR")}
            </span>
          </div>
        </header>

        <section className="glass-card p-5" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="font-display text-base font-semibold mb-4">Acompanhamento</h2>
          {isCancelled ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Pedido cancelado. Em caso de dúvidas, entre em contato pelo WhatsApp.
            </div>
          ) : (
            <ol className="relative border-l-2 border-border ml-3 space-y-6">
              {TIMELINE_ORDER.map((step, idx) => {
                const Icon = ORDER_STATUS_ICONS[step];
                const reached = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                const histEntry = history.find((h) => h.to_status === step);
                return (
                  <li key={step} className="ml-6">
                    <span
                      className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        reached
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/20" : ""}`}
                      aria-hidden="true"
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <p className={`text-sm font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                      {ORDER_STATUS_LABELS[step]}
                    </p>
                    {histEntry && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(histEntry.created_at).toLocaleString("pt-BR")}
                        {histEntry.note && <> — {histEntry.note}</>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {order.tracking_code && (
          <section className="glass-card p-5" aria-labelledby="tracking-heading">
            <h2 id="tracking-heading" className="font-display text-base font-semibold mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Rastreio
            </h2>
            <p className="font-mono text-lg font-bold mb-3">{order.tracking_code}</p>
            <a
              href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(order.tracking_code)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Rastrear nos Correios
              </Button>
            </a>
          </section>
        )}

        <section className="glass-card p-5" aria-labelledby="items-heading">
          <h2 id="items-heading" className="font-display text-base font-semibold mb-3">Itens</h2>
          <ul className="space-y-2">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                <span className="flex-1 truncate">{it.quantity}× {it.name}</span>
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

        {order.receipt_url && (
          <section className="glass-card p-5" aria-labelledby="receipt-heading">
            <h2 id="receipt-heading" className="font-display text-base font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Comprovante PIX
            </h2>
            <a href={order.receipt_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Ver comprovante
              </Button>
            </a>
          </section>
        )}

        <section className="flex flex-wrap gap-3">
          <Button onClick={reorder} disabled={syncCart.isPending} className="gap-2">
            {syncCart.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Comprar novamente
          </Button>
          <Link to="/catalogo">
            <Button variant="outline" className="gap-2"><CartIcon className="h-4 w-4" /> Voltar ao catálogo</Button>
          </Link>
          {canDispute && (
            <Button variant="outline" className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setDisputeOpen(true)}>
              <AlertTriangle className="h-4 w-4" /> Solicitar devolução
            </Button>
          )}
        </section>

        {disputes.length > 0 && (
          <section className="glass-card p-5" aria-labelledby="disputes-heading">
            <h2 id="disputes-heading" className="font-display text-base font-semibold mb-3">Solicitações de devolução</h2>
            <ul className="space-y-3">
              {disputes.map((d) => (
                <li key={d.id} className="border border-border rounded-md p-3 bg-muted/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.reason}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-sm">{d.description}</p>
                  <div className="mt-2">
                    <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.status}</span>
                  </div>
                  {d.admin_response && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <p className="text-[11px] font-semibold text-muted-foreground">Resposta da equipe:</p>
                      <p className="text-xs">{d.admin_response}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Solicitar devolução / reclamação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPUTE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Descrição detalhada</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Descreva o que aconteceu para que possamos ajudar." />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Conforme o Código de Defesa do Consumidor (CDC art. 49), você tem direito ao arrependimento em até 7 dias após o recebimento. Em caso de vício do produto, o prazo se estende.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancelar</Button>
            <Button onClick={submitDispute} disabled={!description.trim() || createDispute.isPending}>
              {createDispute.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetailPage;
