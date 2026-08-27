import useSEO from "@/hooks/use-seo";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useSpecialOrderDetail, useSpecialOrders, SPECIAL_ORDER_STATUS_LABELS } from "@/hooks/use-special-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Check, X, CreditCard, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import SpecialOrderAttachmentsPanel from "@/components/SpecialOrderAttachmentsPanel";
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

const CustomerSpecialOrderDetail = () => {
  useSEO({ title: "Detalhes da encomenda", noindex: true });
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useCustomerAuth();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("novo") === "1";
  const { data, isLoading } = useSpecialOrderDetail(orderId);
  const { approveQuote, createPayment } = useSpecialOrders();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    navigate("/conta/login");
    return null;
  }

  const order = data?.order;
  const items = data?.items ?? [];
  const quotes = data?.quotes ?? [];
  const history = data?.history ?? [];

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <p className="text-muted-foreground">Encomenda não encontrada.</p>}
      </div>
    );
  }

  const latestQuote = quotes[quotes.length - 1];

  const handleApprove = async (accept: boolean) => {
    try {
      await approveQuote.mutateAsync({ special_order_id: order.id, quote_id: latestQuote?.id, accept });
      toast.success(accept ? "Cotação aprovada!" : "Encomenda cancelada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao responder cotação.");
    }
  };

  const handlePay = async (method: "pix" | "credit" | "debit") => {
    try {
      const result = await createPayment.mutateAsync({ special_order_id: order.id, payment_method: method });
      if (result.checkout_url) window.open(result.checkout_url, "_blank");
      toast.success("Link de pagamento gerado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar pagamento.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/conta/encomendas" className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Minhas encomendas
          </Link>
          <Link to="/encomendas"><img src={logo} alt="Spencer's Cardtopia" className="h-10 hover:scale-105 transition-transform" /></Link>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: '0.05em' }}>
            <span className="text-gradient">Encomenda #{order.id.slice(0, 8).toUpperCase()}</span>
          </h1>
          <Badge variant="outline" className={statusBadgeVariant[order.status] || ""}>
            {SPECIAL_ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        {isNew && (
          <Card className="mb-6 border-success/40 bg-success/5">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" /> Solicitação registrada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Recibo da solicitação <span className="font-mono text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span> —{" "}
                {new Date(order.created_at).toLocaleString("pt-BR")}. Enviamos uma cópia por e-mail.
              </p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span className="text-foreground">{item.quantity}× {item.name}</span>
                    <span className="text-muted-foreground">
                      {item.item_type === "quotation" && !Number(item.total_price)
                        ? "Sob cotação"
                        : `R$ ${Number(item.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total estimado</span>
                <span className="font-bold text-primary">
                  R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir recibo
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Itens</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 pb-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Qtd: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">R$ {Number(item.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground">{item.item_type === "quotation" ? "Sob cotação" : "Preço fixo"}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Histórico</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {h.from_status ? `${SPECIAL_ORDER_STATUS_LABELS[h.from_status as any]} → ` : ""}
                      {SPECIAL_ORDER_STATUS_LABELS[h.to_status as any]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <SpecialOrderAttachmentsPanel specialOrderId={orderId} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total estimado</span>
                  <span className="font-bold text-primary">R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                {order.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">Observações</p>
                    <p className="text-sm text-foreground">{order.notes}</p>
                  </div>
                )}

                {order.status === "quoted" && latestQuote && (
                  <div className="space-y-3">
                    <div className="rounded-md bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Cotação enviada em {new Date(latestQuote.created_at).toLocaleString("pt-BR")}</p>
                      <p className="text-lg font-bold text-primary mt-1">
                        R$ {Number(latestQuote.quoted_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {latestQuote.estimated_days && <p className="text-xs text-muted-foreground">Prazo estimado: {latestQuote.estimated_days} dias úteis</p>}
                      {latestQuote.admin_notes && <p className="text-xs text-foreground mt-1">{latestQuote.admin_notes}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="gap-1" onClick={() => handleApprove(false)}>
                        <X className="h-4 w-4" /> Recusar
                      </Button>
                      <Button className="gap-1" onClick={() => handleApprove(true)}>
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                    </div>
                  </div>
                )}

                {order.status === "approved" && (
                  <div className="space-y-2">
                    {order.payment_transaction_id && (
                      <p className="text-xs text-warning">
                        Um checkout já foi gerado para esta encomenda. Se você já pagou, aguarde a confirmação — gerar um novo link pode resultar em pagamento duplicado.
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">A cotação foi aprovada. Escolha o método de pagamento:</p>
                    <Button className="w-full gap-1" onClick={() => handlePay("pix")}>
                      <CreditCard className="h-4 w-4" /> Pagar com PIX
                    </Button>
                    <Button variant="outline" className="w-full gap-1" onClick={() => handlePay("credit")}>
                      <CreditCard className="h-4 w-4" /> Cartão de crédito
                    </Button>
                  </div>
                )}

                {order.status === "paid" && (
                  <p className="text-sm text-success">Pagamento confirmado. Aguardando aquisição e envio.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerSpecialOrderDetail;
