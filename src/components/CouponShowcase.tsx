import { Tag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useShowcaseCoupons, useAppliedCoupon, formatCouponValue } from "@/hooks/use-coupon";

/** Shows active coupons in the catalog; one tap applies it (non-cumulative). */
const CouponShowcase = () => {
  const { data } = useShowcaseCoupons();
  const { coupon, setCoupon } = useAppliedCoupon();
  if (!data?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {data.map((c) => {
        const active = coupon?.code === c.code;
        return (
          <div key={c.code} className="flex flex-1 min-w-[260px] items-center justify-between gap-3 rounded-xl border border-dashed border-success/50 bg-success/5 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-success" />
              <span className="font-bold tracking-wide text-foreground">{c.code}</span>
              <span className="font-semibold text-success">{formatCouponValue(c)}</span>
              {c.description && <span className="hidden sm:inline text-muted-foreground">· {c.description}</span>}
              {c.expires_at && <span className="text-xs text-muted-foreground">até {new Date(c.expires_at).toLocaleDateString("pt-BR")}</span>}
            </div>
            <Button
              size="sm"
              variant={active ? "secondary" : "outline"}
              className="h-8 gap-1"
              disabled={active}
              onClick={() => {
                if (coupon && coupon.code !== c.code) toast.info(`Cupom ${coupon.code} substituído — cupons não são acumulativos.`);
                setCoupon({ code: c.code, discount_type: c.discount_type, discount_value: Number(c.discount_value), allowed_categories: c.allowed_categories ?? [], blocked_categories: c.blocked_categories ?? [], description: c.description, expires_at: c.expires_at });
                toast.success(`Cupom ${c.code} aplicado! Os preços com desconto aparecem nos produtos.`);
              }}
            >
              {active ? <><Check className="h-3.5 w-3.5" /> Aplicado</> : "Usar cupom"}
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default CouponShowcase;
