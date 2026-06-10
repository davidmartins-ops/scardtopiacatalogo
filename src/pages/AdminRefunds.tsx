import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Upload, ExternalLink, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRefunds, type OrderRefund, type RefundStatus } from "@/hooks/use-refunds";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<RefundStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  processed: "Processado",
  rejected: "Rejeitado",
};
const STATUS_VARIANT: Record<RefundStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "outline",
  processed: "default",
  rejected: "destructive",
};

const AdminRefunds = () => {
  useSEO({
    title: "Reembolsos",
    canonical: "https://www.spencerscardtopia.com.br/admin/reembolsos",
    noindex: true,
  });
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { refunds, isLoading, updateRefund, uploadProof, remove } = useAdminRefunds();
  const [tab, setTab] = useState<RefundStatus | "all">("pending");
  const [editing, setEditing] = useState<OrderRefund | null>(null);

  const filtered = useMemo(() => {
    if (tab === "all") return refunds;
    return refunds.filter((r) => r.status === tab);
  }, [refunds, tab]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <h1 className="font-display text-lg sm:text-xl">Reembolsos</h1>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({refunds.filter((r) => r.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="processed">Processados</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground">
                Nenhum reembolso nesta lista.
              </Card>
            )}
            {filtered.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      <Link to={`/conta/pedidos/${r.order_id}`} className="font-mono text-xs text-primary hover:underline">
                        Pedido {r.order_id.slice(0, 8)}…
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                      {r.restocked && (
                        <Badge variant="outline" className="gap-1">
                          <RotateCcw className="h-3 w-3" /> Estoque reposto
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm"><strong>{fmt(Number(r.amount))}</strong> via {r.method.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground"><strong>Motivo:</strong> {r.reason}</p>
                    {r.pix_key && (
                      <p className="text-xs text-muted-foreground">
                        <strong>PIX:</strong> <span className="font-mono">{r.pix_key}</span>
                      </p>
                    )}
                    {r.notes && <p className="text-xs italic text-muted-foreground">"{r.notes}"</p>}
                    {r.proof_url && (
                      <a href={r.proof_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Ver comprovante de estorno
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => setEditing(r)}>Gerenciar</Button>
                    {r.status === "rejected" && (
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <RefundManageDialog
        refund={editing}
        onClose={() => setEditing(null)}
        onUpdate={updateRefund.mutateAsync}
        onUploadProof={uploadProof}
      />
    </div>
  );
};

interface ManageProps {
  refund: OrderRefund | null;
  onClose: () => void;
  onUpdate: (input: { id: string; patch: Partial<OrderRefund>; restock?: boolean }) => Promise<void>;
  onUploadProof: (refundId: string, file: File) => Promise<string>;
}

const RefundManageDialog = ({ refund, onClose, onUpdate, onUploadProof }: ManageProps) => {
  const [status, setStatus] = useState<RefundStatus>(refund?.status ?? "pending");
  const [amount, setAmount] = useState<string>(refund?.amount?.toString() ?? "0");
  const [method, setMethod] = useState<string>(refund?.method ?? "pix");
  const [pixKey, setPixKey] = useState<string>(refund?.pix_key ?? "");
  const [notes, setNotes] = useState<string>(refund?.notes ?? "");
  const [restock, setRestock] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when refund changes
  useMemo(() => {
    if (refund) {
      setStatus(refund.status);
      setAmount(refund.amount.toString());
      setMethod(refund.method);
      setPixKey(refund.pix_key ?? "");
      setNotes(refund.notes ?? "");
      setRestock(false);
      setFile(null);
    }
  }, [refund?.id]);

  if (!refund) return null;

  const save = async () => {
    setSaving(true);
    try {
      let proof_url = refund.proof_url ?? null;
      if (file) proof_url = await onUploadProof(refund.id, file);
      const patch: Partial<OrderRefund> = {
        status,
        amount: Number(amount) || 0,
        method: method as any,
        pix_key: pixKey || null,
        notes: notes || null,
        proof_url,
      };
      const shouldRestock = restock && status === "processed" && !refund.restocked;
      await onUpdate({ id: refund.id, patch, restock: shouldRestock });
      toast.success("Reembolso atualizado");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar reembolso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RefundStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="processed">Processado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="reverse_credit">Estorno cartão</SelectItem>
                  <SelectItem value="store_credit">Crédito na loja</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave PIX (se aplicável)</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações internas</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>Comprovante do estorno (PDF/imagem)</Label>
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {refund.proof_url && !file && (
              <a href={refund.proof_url} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Atual
              </a>
            )}
          </div>
          {status === "processed" && !refund.restocked && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restock} onCheckedChange={(v) => setRestock(!!v)} />
              Repor itens deste pedido ao estoque
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminRefunds;
