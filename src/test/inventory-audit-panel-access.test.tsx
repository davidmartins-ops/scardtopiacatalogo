import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// CORREÇÃO 28.3: Non-admin users must see the "Acesso restrito" banner and never reach the audit table.

// Mock the auth hook — we control the session per test.
const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock supabase to ensure the query is never reached for unauthorized users.
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
      select: () => ({ order: () => ({ gte: () => ({ lte: () => ({ ilike: () => ({ eq: () => ({ range: () => Promise.resolve({ data: [], error: null, count: 0 }) }) }) }) }) }) }),
    });
  });

  it("shows 'Acesso restrito' message when user is NOT logged in", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });
    renderPanel();
    expect(screen.getByText(/Acesso restrito/i)).toBeInTheDocument();
    expect(screen.getByText(/apenas para administradores/i)).toBeInTheDocument();
    // The audit table must NOT be rendered
    expect(screen.queryByText(/Auditoria de Estoque/i)).not.toBeInTheDocument();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("shows the audit panel when user IS an admin (session present — useAuth already gated by role)", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "admin-uuid" } } as any,
      loading: false,
      signOut: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText(/Auditoria de Estoque/i)).toBeInTheDocument();
    expect(screen.queryByText(/Acesso restrito/i)).not.toBeInTheDocument();
  });

  it("shows a loading spinner while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true, signOut: vi.fn() });
    const { container } = renderPanel();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText(/Acesso restrito/i)).not.toBeInTheDocument();
  });
});
