import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Regression: the admin delete dialog must clearly indicate that stock will be
// restocked automatically for orders that carried a stock debit (any status
// from payment_confirmed onward), and must NOT promise a restock for
// pending_payment (which never debited stock).
//
// This guards the invariant behind our BEFORE DELETE trigger
// (trg_orders_restock_on_delete) so deleting a paid order never leaves an
// orphan debit in inventory_audit.

const mockOrders = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    user_id: "u1",
    items: [{ id: "SKU-1", name: "Card A", quantity: 2, unit_price: 10, total_price: 20 }],
    total: 20,
    status: "payment_confirmed",
    tracking_code: null,
    status_updated_at: new Date().toISOString(),
    receipt_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "bbbbbbbb-0000-0000-0000-000000000002",
    user_id: "u2",
    items: [{ id: "SKU-2", name: "Card B", quantity: 1, unit_price: 5, total_price: 5 }],
    total: 5,
    status: "pending_payment",
    tracking_code: null,
    status_updated_at: new Date().toISOString(),
    receipt_url: null,
    created_at: new Date().toISOString(),
  },
];

vi.mock("@/hooks/use-orders", () => ({
  useAdminOrders: () => ({
    orders: mockOrders,
    isLoading: false,
    updateStatus: { mutateAsync: vi.fn(), isPending: false },
    removeOrder: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: { invoke: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
  },
}));

import AdminOrdersPanel from "@/components/AdminOrdersPanel";

const renderPanel = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AdminOrdersPanel />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe("AdminOrdersPanel — delete restock warning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("warns that stock WILL be restocked when deleting a payment_confirmed order", () => {
    const { getAllByLabelText, baseElement } = renderPanel();
    const trashButtons = getAllByLabelText(/Remover pedido/i);
    fireEvent.click(trashButtons[0]); // first order = payment_confirmed
    const text = baseElement.textContent ?? "";
    expect(text).toMatch(/Estoque será reposto automaticamente/i);
    expect(text).not.toMatch(/sem débito de estoque/i);
  });

  it("indicates no restock is needed when deleting a pending_payment order", () => {
    const { getAllByLabelText, baseElement } = renderPanel();
    const trashButtons = getAllByLabelText(/Remover pedido/i);
    fireEvent.click(trashButtons[1]); // second order = pending_payment
    const text = baseElement.textContent ?? "";
    expect(text).toMatch(/sem débito de estoque/i);
    expect(text).not.toMatch(/Estoque será reposto automaticamente/i);
  });
});
