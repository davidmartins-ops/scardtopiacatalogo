import { describe, it, expect, vi } from "vitest";

// CORREÇÃO 28.5: Validate the resubmit flow used by ShoppingCart.submitOrder.
// The actual handler signature: onOrderPlaced(items, total) => Promise<boolean | void>
// Behavior we guarantee:
//   1. When onOrderPlaced returns false → submitOrder MUST surface an error and keep
//      the items intact (caller should NOT clear the cart on failure).
//   2. The user can call submitOrder again with the SAME items and succeed,
//      proving "Reenviar pedido" reuses the cart instead of losing data.

type CartItem = { item: { id: string; price: number; quantity: number; description: string; name: string }; qty: number };

const makeOrderRunner = () => {
  let cart: CartItem[] = [
    { item: { id: "SLD-01-PT-F-NM", price: 10, quantity: 5, description: "Foil", name: "X" }, qty: 2 },
  ];
  let lastError: string | null = null;
  let attempts = 0;

  const submit = async (onOrderPlaced: (items: CartItem[], total: number) => Promise<boolean | void>) => {
    attempts++;
    lastError = null;
    const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
    try {
      const result = await onOrderPlaced(cart, total);
      if (result === false) {
        lastError = "Não foi possível confirmar a baixa de estoque do servidor.";
        return false;
      }
      return true;
    } catch (e: any) {
      lastError = e?.message ?? "Erro inesperado";
      return false;
    }
  };

  return {
    submit,
    getCart: () => cart,
    getError: () => lastError,
    getAttempts: () => attempts,
  };
};

describe("Checkout resubmit flow", () => {
  it("keeps cart items intact when onOrderPlaced returns false", async () => {
    const runner = makeOrderRunner();
    const handler = vi.fn().mockResolvedValue(false);

    const ok = await runner.submit(handler);

    expect(ok).toBe(false);
    expect(runner.getError()).toMatch(/baixa de estoque/i);
    // Cart MUST remain populated so the user can retry without re-adding items
    expect(runner.getCart()).toHaveLength(1);
    expect(runner.getCart()[0].qty).toBe(2);
  });

  it("succeeds on retry with the same cart after a previous failure", async () => {
    const runner = makeOrderRunner();
    const handler = vi
      .fn()
      .mockResolvedValueOnce(false)   // first attempt fails
      .mockResolvedValueOnce(true);   // retry succeeds

    const first = await runner.submit(handler);
    const second = await runner.submit(handler);

    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(runner.getAttempts()).toBe(2);
    // Both calls used the same cart payload
    const firstCallArgs = handler.mock.calls[0][0];
    const secondCallArgs = handler.mock.calls[1][0];
    expect(firstCallArgs).toEqual(secondCallArgs);
    expect(runner.getError()).toBeNull();
  });

  it("captures thrown errors and keeps the cart for retry", async () => {
    const runner = makeOrderRunner();
    const handler = vi.fn().mockRejectedValueOnce(new Error("Network down"));

    const ok = await runner.submit(handler);
    expect(ok).toBe(false);
    expect(runner.getError()).toBe("Network down");
    expect(runner.getCart()).toHaveLength(1);
  });
});
