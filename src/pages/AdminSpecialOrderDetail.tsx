import { useNavigate, useParams } from "react-router-dom";
import { useAdminSpecialOrderDetail, useAdminSpecialOrders, SPECIAL_ORDER_STATUS_LABELS, SpecialOrderStatus } from "@/hooks/use-special-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
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

const AdminSpecialOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminSpecialOrderDetail(orderId);
  const { updateStatus, createQuote } = useAdminSpecialOrders();

  const [quotePrice, setQuotePrice] = useState("");
  const [quoteDays, setQuoteDays] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [newStatus, setNewStatus] = useState<SpecialOrderStatus>("quoted");
  const [trackingCode, setTrackingCode] = useState("");

  if (isLoading || !data?.order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <p className="text-muted-foreground">Encomenda não encontrada.</p>}
      </div>
    );
  }

  const order = data.order;
  const items = data.items ?? [];
  const quotes = data.quotes ?? [];
  const history = data.history ?? [];
  const customerInfo = order.customer_info || {};

  const handleQuote = async () => {
    if (!quotePrice) { toast.error("Informe o valor da cotação."); return; }
    try {
      await createQuote.mutateAsync({
        special_order_id: order.id,
        quoted_price: Number(quotePrice),
        estimated_days: quoteDays ? Number(quoteDays) : undefined,
        admin_notes: quoteNotes,
      });
      toast.success("Cotação enviada ao cliente.");
      setQuotePrice("");
      setQuoteDays("");
      setQuoteNotes("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar cotação.");
    }
  };

  const handleStatusChange = async () => {
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: newStatus,
        tracking_code: trackingCode || undefined,
      });
      toast.success("Status atualizado.");
      setTrackingCode("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar status.");
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/admin/encomendas")} className="flex items-center gap-2 text-sm text-brand-header-foreground hover:text-brand-gold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <h1 className="font-display text-lg font-bold text-gradient cursor-pointer" onClick={() => navigate("/admin")}>
            Spencer's Cardtopia
          </h1>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <h2 className="text-2xl font-bold text-foreground font-display">
            Encomenda #{order.id.slice(0, 8).toUpperCase()}
          </h2>
          <Badge variant="outline" className={statusBadgeVariant[order.status] || ""}>
            {SPECIAL_ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

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
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Cliente</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-foreground font-medium">{customerInfo.name || customerInfo.email || "—"}</p>
                <p className="text-muted-foreground">{customerInfo.email}</p>
                {customerInfo.phone && <p className="text-muted-foreground">{customerInfo.phone}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Cotação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {quotes.length > 0 && (
                  <div className="rounded-md bg-muted/30 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Última cotação</p>
                    <p className="font-bold text-primary">R$ {Number(quotes[quotes.length - 1].quoted_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{quotes[quotes.length - 1].admin_notes}</p>
                  </div>
                )}
                <div>
                  <Label>Valor total (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} />
                </div>
                <div>
                  <Label>Prazo estimado (dias úteis)</Label>
                  <Input type="number" min={1} value={quoteDays} onChange={(e) => setQuoteDays(e.target.value)} />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} />
                </div>
                <Button className="w-full gap-1" onClick={handleQuote} disabled={createQuote.isPending}>
                  {createQuote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Send className="h-4 w-4" /> Enviar cotação
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Gerenciar status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SpecialOrderStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPECIAL_ORDER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Label>Código de rastreamento</Label>
                  <Input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Ex: BR1234567890" />
                </div>
                <Button className="w-full gap-1" onClick={handleStatusChange} disabled={updateStatus.isPending}>
                  {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" /> Salvar status
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSpecialOrderDetail;
