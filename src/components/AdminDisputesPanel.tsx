import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";
import type { OrderDispute } from "@/hooks/use-orders";

type DisputeStatus = "open" | "in_review" | "resolved" | "rejected";

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "Aberta",
  in_review: "Em análise",
  resolved: "Resolvida",
  rejected: "Rejeitada",
};

const STATUS_CLASSES: Record<DisputeStatus, string> = {
  open: "bg-destructive/10 text-destructive border-destructive/30",
  in_review: "bg-accent/10 text-accent border-accent/30",
  resolved: "bg-success/10 text-success border-success/30",
  rejected: "bg-muted text-muted-foreground border-border",
};

const AdminDisputesPanel = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<OrderDispute | null>(null);
  const [editStatus, setEditStatus] = useState<DisputeStatus>("in_review");
  const [response, setResponse] = useState("");

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderDispute[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status, admin_response }: { id: string; status: DisputeStatus; admin_response: string }) => {
      const { error } = await supabase.from("order_disputes").update({ status, admin_response }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      toast.success("Solicitação atualizada!");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const filtered = useMemo(
    () => (statusFilter === "all" ? disputes : disputes.filter((d) => d.status === statusFilter)),
    [disputes, statusFilter]
  );

  const openEdit = (d: OrderDispute) => {
    setEditing(d);
    setEditStatus(d.status);
    setResponse(d.admin_response ?? "");
  };

  if (isLoading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Devoluções e reclamações
        </h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(Object.keys(STATUS_LABELS) as DisputeStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <div key={d.id} className="border border-border rounded-lg p-3 bg-muted/10 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[d.status]}`}>
                    {STATUS_LABELS[d.status]}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">Pedido #{d.order_id.slice(0, 8)}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(d)}>Responder</Button>
              </div>
              <p className="text-xs"><strong>Motivo:</strong> {d.reason}</p>
              <p className="text-sm">{d.description}</p>
              {d.admin_response && (
                <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                  <strong className="text-foreground">Resposta:</strong> {d.admin_response}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Responder solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dispute-status">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as DisputeStatus)}>
                <SelectTrigger id="dispute-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as DisputeStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dispute-resp">Resposta ao cliente</Label>
              <Textarea id="dispute-resp" value={response} onChange={(e) => setResponse(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && update.mutate({ id: editing.id, status: editStatus, admin_response: response })}
              disabled={update.isPending}
            >
              {update.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDisputesPanel;
