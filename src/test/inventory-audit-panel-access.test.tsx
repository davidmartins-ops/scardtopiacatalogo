import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// CORREÇÃO 28.3: Non-admin users must see the "Acesso restrito" banner
// and must NEVER trigger a query against the inventory_audit table.

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mockUseAuth() }));

const fromSpy = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: any[]) => fromSpy(...args) },
}));

import InventoryAuditPanel from "@/components/InventoryAuditPanel";

const renderPanel = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <InventoryAuditPanel />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe("InventoryAuditPanel access control", () => {
  beforeEach(() => {
    fromSpy.mockReset();
    fromSpy.mockReturnValue({
      select: () => ({
        order: () => ({
          gte: () => ({
            lte: () => ({
              ilike: () => ({
                eq: () => ({
                  range: () => Promise.resolve({ data: [], error: null, count: 0 }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
  });

  it("shows 'Acesso restrito' when user is NOT logged in and never queries the audit table", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });
    const { container } = renderPanel();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Acesso restrito/i);
    expect(text).toMatch(/apenas para administradores/i);
    // Admin-only UI markers must NOT be rendered
    expect(text).not.toMatch(/Limite CSV/i);
    expect(text).not.toMatch(/CSV \(filtros\)/i);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("renders the audit panel when an admin session is present", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "admin-uuid" } } as any,
      loading: false,
      signOut: vi.fn(),
    });
    const { container } = renderPanel();
    const text = container.textContent ?? "";
    expect(text).toMatch(/Auditoria de Estoque/i);
    expect(text).not.toMatch(/Acesso restrito/i);
  });

  it("shows a loading spinner while auth resolves and does not fetch yet", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true, signOut: vi.fn() });
    const { container } = renderPanel();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect((container.textContent ?? "")).not.toMatch(/Acesso restrito/i);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
