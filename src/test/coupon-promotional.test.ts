import { describe, it, expect } from "vitest";
import {
  computeCouponDiscount,
  priceWithCoupon,
  isCardPayment,
  isPromotionalEligible,
  type AppliedCoupon,
  type CouponLine,
} from "@/hooks/use-coupon";

// Regra do David: cupom não incide sobre item que já está em promoção.
// Exceção: pagamento no cartão, porque o desconto promocional não é aplicado no valor do cartão.

const coupon = (over: Partial<AppliedCoupon> = {}): AppliedCoupon => ({
  code: "JEFF3ND",
  discount_type: "percent",
  discount_value: 10,
  allowed_categories: [],
  blocked_categories: [],
  allow_on_promotional: false,
  ...over,
});

const lines: CouponLine[] = [
  { category: "Secret Lair", amount: 100, product_type: "drop", discount: 20 }, // já em promoção
  { category: "Commander", amount: 50, product_type: "single", discount: 0 }, // sem promoção
];

describe("cupom x itens já promocionais", () => {
  it("no PIX ignora o item em promoção e desconta só do item sem promoção", () => {
    expect(computeCouponDiscount(coupon(), lines, "pix")).toBe(5); // 10% de R$ 50
  });

  it("no cartão o item em promoção entra no cálculo", () => {
    expect(computeCouponDiscount(coupon(), lines, "credit")).toBe(15); // 10% de R$ 150
  });

  it("cupom com 'permitir em promocionais' ligado também vale no PIX", () => {
    expect(computeCouponDiscount(coupon({ allow_on_promotional: true }), lines, "pix")).toBe(15);
  });

  it("pedido só com itens promocionais não ganha desconto no PIX", () => {
    expect(computeCouponDiscount(coupon(), [lines[0]], "pix")).toBe(0);
    expect(computeCouponDiscount(coupon(), [lines[0]], "credit")).toBe(10);
  });

  it("prévia do card não mostra preço com cupom para item promocional no PIX", () => {
    expect(priceWithCoupon(coupon(), 80, "Secret Lair", "drop", true)).toBeNull();
    expect(priceWithCoupon(coupon(), 80, "Secret Lair", "drop", true, "credit")).toBe(72);
    expect(priceWithCoupon(coupon(), 80, "Secret Lair", "drop", false)).toBe(72);
  });

  it("teto de desconto continua valendo depois de excluir os promocionais", () => {
    expect(computeCouponDiscount(coupon({ max_discount: 3 }), lines, "credit")).toBe(3);
  });

  it("isCardPayment reconhece só as formas de pagamento do cartão", () => {
    expect(isCardPayment("credit")).toBe(true);
    expect(isCardPayment("debit")).toBe(true);
    expect(isCardPayment("pix")).toBe(false);
    expect(isCardPayment("whatsapp")).toBe(false);
    expect(isCardPayment(null)).toBe(false);
  });

  it("item sem promoção participa independentemente do pagamento", () => {
    expect(isPromotionalEligible(coupon(), false, "pix")).toBe(true);
    expect(isPromotionalEligible(coupon(), true, "pix")).toBe(false);
    expect(isPromotionalEligible(coupon(), true, "credit")).toBe(true);
    expect(isPromotionalEligible(coupon({ allow_on_promotional: true }), true, "pix")).toBe(true);
  });
});
