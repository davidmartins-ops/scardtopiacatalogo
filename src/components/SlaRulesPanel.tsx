import { useSlaRules } from "@/hooks/use-sla-rules";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlarmClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  payment_confirmed: "Pagamento confirmado",
  preparing: "Em preparação",
  shipped: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const SlaRulesPanel = () => {
  const { rules, isLoading, updateRule } = useSlaRules();

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlarmClock className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold text-foreground">Alertas SLA</h4>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Configure o tempo máximo (em horas) que um pedido pode ficar em cada status antes de gerar um alerta.
        A verificação roda a cada hora automaticamente.
      </p>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/10">
            <Switch
              checked={r.enabled}
              onCheckedChange={async (v) => {
                try {
                  await updateRule.mutateAsync({ id: r.id, enabled: v });
                } catch {
                  toast.error("Erro ao atualizar regra.");
                }
              }}
              aria-label={`Ativar regra ${STATUS_LABEL[r.status]}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{STATUS_LABEL[r.status] ?? r.status}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={r.max_hours}
                onChange={async (e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isFinite(n) || n <= 0) return;
                  try {
                    await updateRule.mutateAsync({ id: r.id, max_hours: n });
                  } catch {
                    toast.error("Erro ao atualizar regra.");
                  }
                }}
                className="h-8 w-20 text-xs"
              />
              <Label className="text-[11px] text-muted-foreground">horas</Label>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SlaRulesPanel;
