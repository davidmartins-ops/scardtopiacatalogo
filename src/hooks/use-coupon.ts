import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppliedCoupon {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  allowed_categories: string[];
  blocked_categories: string[];
  description?: string | null;
  expires_at?: string | null;
}

export interface CouponLine {
  category: string;
  amount: number;
}

const KEY = "applied_coupon_v1";
const EVT = "applied-coupon-change";

const read = (): AppliedCoupon | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppliedCoupon) : null;
  } catch {
    return null;
  }
};

/** Coupon applied in the cart, shared across catalog and checkout. Only one at a time. */
export function useAppliedCoupon() {
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(() => (typeof window === "undefined" ? null : read()));

  useEffect(() => {
    const sync = () => setCoupon(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((c: AppliedCoupon | null) => {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  }, []);

  return { coupon, setCoupon: save, clearCoupon: () => save(null) };
}

export const isCategoryEligible = (c: Pick<AppliedCoupon, "allowed_categories" | "blocked_categories">, category?: string | null) => {
  const cat = (category ?? "").trim().toLowerCase();
  if ((c.blocked_categories ?? []).some((b) => b.trim().toLowerCase() === cat)) return false;
  if ((c.allowed_categories ?? []).length > 0) return c.allowed_categories.some((a) => a.trim().toLowerCase() === cat);
  return true;
};

/** Mirrors the server rule (server recomputes and is authoritative). */
export const computeCouponDiscount = (c: AppliedCoupon | null, lines: CouponLine[]) => {
  if (!c) return 0;
  const eligible = lines.filter((l) => isCategoryEligible(c, l.category)).reduce((s, l) => s + l.amount, 0);
  if (eligible <= 0) return 0;
  const d = c.discount_type === "percent" ? (eligible * Math.min(c.discount_value, 100)) / 100 : Math.min(c.discount_value, eligible);
  return Math.round(d * 100) / 100;
};

export const priceWithCoupon = (c: AppliedCoupon | null, price: number, category?: string | null) => {
  if (!c || !isCategoryEligible(c, category)) return null;
  if (c.discount_type === "percent") return Math.round(price * (1 - Math.min(c.discount_value, 100) / 100) * 100) / 100;
  return null; // valor fixo vale para o pedido inteiro, não por item
};

export async function previewCoupon(code: string, cpf: string, lines: CouponLine[], context: "catalog" | "special_order" = "catalog") {
  const { data, error } = await supabase.rpc("preview_coupon" as never, {
    _code: code, _cpf: cpf, _lines: lines, _context: context,
  } as never);
  if (error) return { ok: false as const, error: error.message };
  const d = data as unknown as { ok: boolean; error?: string } & AppliedCoupon & { discount: number };
  if (!d?.ok) return { ok: false as const, error: d?.error ?? "Cupom inválido" };
  return { ok: true as const, coupon: d as AppliedCoupon, discount: Number(d.discount) };
}

export interface ShowcaseCoupon {
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  expires_at: string | null;
  allowed_categories: string[];
  blocked_categories: string[];
}

export function useShowcaseCoupons() {
  return useQuery({
    queryKey: ["showcase-coupons"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_showcase_coupons" as never);
      if (error) throw error;
      return (data ?? []) as unknown as ShowcaseCoupon[];
    },
  });
}

export const formatCouponValue = (c: { discount_type: string; discount_value: number }) =>
  c.discount_type === "percent"
    ? `${Number(c.discount_value).toLocaleString("pt-BR")}% OFF`
    : `R$ ${Number(c.discount_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} OFF`;
