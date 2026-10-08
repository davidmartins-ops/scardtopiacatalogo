import { useState } from "react";
import { Tag, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  order: { id: string; status: string; coupon_code?: string | null; coupon_discount?: number | null };
  onApplied?: () => void;
}

/** Apply one (non-cumulative) coupon to an approved encomenda before payment. */
const SpecialOrderCouponBox = ({ order, onApplied }: Props) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  if (order.coupon_code) {
    return (
      <div className="flex items-center justify-between rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5"><Tag className="h-4 w-4 text-success" /> Cupom <strong>{order.coupon_code}</strong></span>
        <span className="font-medium text-success">− R$ {Number(order.coupon_discount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    );
  }
  if (order.status !== "approved") return null;

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("apply_special_order_coupon" as never, { _special_order_id: order.id, _code: code.trim() } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const d = data as unknown as { discount: number; code: string };
    toast.success(`Cupom ${d.code} aplicado: − R$ ${Number(d.discount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    setCode("");
    void qc.invalidateQueries();
    onApplied?.();
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={40} placeholder="Cupom de desconto" className="h-9 uppercase" />
        <Button size="sm" variant="outline" className="h-9 gap-1" onClick={apply} disabled={busy || !code.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />} Aplicar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Um cupom por encomenda, aplicado antes do pagamento.</p>
    </div>
  );
};

export default SpecialOrderCouponBox;
