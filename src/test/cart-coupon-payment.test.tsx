import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShoppingCart from "@/components/ShoppingCart";
import type { AppliedCoupon } from "@/hooks/use-coupon";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), upload: vi.fn(), invoke: vi.fn(),
  user: { id: "test-customer", email: "test@example.test" },
  profile: { display_name: "Teste", cpf: "52998224725", phone: "11999999999" },
}));
vi.mock("@/hooks/use-customer-auth", () => ({ useCustomerAuth: () => ({ user: mocks.user, profile: mocks.profile }) }));
vi.mock("@/hooks/use-store-credits", () => ({ useMyStoreCredit: () => ({ balance: 0 }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  from: () => ({ insert: mocks.insert }),
  functions: { invoke: mocks.invoke },
  storage: { from: () => ({ upload: mocks.upload, createSignedUrl: async () => ({ data: { signedUrl: "https://example.test/receipt" } }) }) },
} }));

const coupon: AppliedCoupon = { code: "JEFF3ND", discount_type: "percent", discount_value: 10,
  allowed_categories: [], blocked_categories: [], allow_on_promotional: false };

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); localStorage.clear();
  localStorage.setItem("applied_coupon_v1", JSON.stringify(coupon));
  window.history.replaceState({}, "", "/?openCart=1");
  mocks.upload.mockResolvedValue({ error: null });
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "test-order" }, error: null }) }) });
  mocks.invoke.mockResolvedValue({ data: { error: "Test ends before provider payment" }, error: null });
  vi.spyOn(window, "open").mockImplementation(() => null);
});

async function checkout(channel: "manual" | "auto" | "card") {
  const onOrderPlaced = vi.fn().mockResolvedValue(true);
  render(<MemoryRouter><ShoppingCart items={[{ item: {
    id: "SALE-DROP", name: "Drop promocional", description: "Foil", category: "Secret Lair",
    price: 100, price_pix: 100, discount: 20, quantity: 5, product_type: "drop",
  }, qty: 1 }]} onAdd={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} onUpdateQty={vi.fn()} onOrderPlaced={onOrderPlaced} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: channel === "manual" ? /PIX com envio/ : channel === "auto" ? "Pagar com PIX" : "Pagar com Cartão" }));
  fireEvent.click(await screen.findByRole("button", { name: /Retirada/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e Continuar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar pedido" }));
  return onOrderPlaced;
}

describe("real cart submission with sale-only coupon", () => {
  it("manual PIX uploads the receipt and registers R$80 without an ineligible coupon", async () => {
    const onOrderPlaced = await checkout("manual");
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("Missing receipt upload");
    fireEvent.change(fileInput, { target: { files: [new File(["receipt"], "receipt.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e Enviar via WhatsApp" }));
    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalled());
    expect(onOrderPlaced.mock.calls[0][1]).toBe(80);
    expect(onOrderPlaced.mock.calls[0][2]).toMatchObject({ paymentMethod: "pix", couponCode: null, receiptUrl: "https://example.test/receipt" });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });

  it("automatic PIX inserts R$80 with no coupon before creating checkout", async () => {
    await checkout("auto");
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ total: 80, payment_method: "pix", coupon_code: null });
  });

  it("card inserts full R$100 with the eligible coupon for server calculation", async () => {
    await checkout("card");
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ total: 100, payment_method: "credit", coupon_code: "JEFF3ND" });
  });
});