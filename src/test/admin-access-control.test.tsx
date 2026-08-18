import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Only admin accounts may see the management button and reach /admin routes.

const mockUseIsAdmin = vi.fn();
const mockUseCustomerAuth = vi.fn();
vi.mock("@/hooks/use-is-admin", () => ({ useIsAdmin: () => mockUseIsAdmin() }));
vi.mock("@/hooks/use-customer-auth", () => ({ useCustomerAuth: () => mockUseCustomerAuth() }));

const rpcSpy = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import AdminPanelButton from "@/components/AdminPanelButton";
import AdminRoute from "@/components/AdminRoute";

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/admin/login" element={<div>admin login</div>} />
        <Route path="/admin" element={<AdminRoute><div>admin panel</div></AdminRoute>} />
      </Routes>
    </MemoryRouter>,
  );

describe("AdminPanelButton visibility", () => {
  beforeEach(() => rpcSpy.mockClear());

  it("hides the button while the admin role is being validated", () => {
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: true });
    render(<MemoryRouter><AdminPanelButton /></MemoryRouter>);
    expect(screen.queryByTestId("admin-panel-button")).toBeNull();
    expect(screen.getByTestId("admin-button-loading")).toBeTruthy();
  });

  it("hides the button for non-admin users", () => {
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: false });
    render(<MemoryRouter><AdminPanelButton /></MemoryRouter>);
    expect(screen.queryByTestId("admin-panel-button")).toBeNull();
    expect(screen.queryByTestId("admin-button-loading")).toBeNull();
  });

  it("shows the button only for confirmed admins", () => {
    mockUseIsAdmin.mockReturnValue({ isAdmin: true, loading: false });
    render(<MemoryRouter><AdminPanelButton /></MemoryRouter>);
    expect(screen.getByTestId("admin-panel-button")).toBeTruthy();
  });
});

describe("AdminRoute guard", () => {
  beforeEach(() => rpcSpy.mockClear());

  it("shows a loading state while validating and never renders the panel", () => {
    mockUseCustomerAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false });
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: true });
    renderRoute();
    expect(screen.queryByText("admin panel")).toBeNull();
    expect(screen.getByText(/Validando permissões/i)).toBeTruthy();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("redirects non-admin users to home and audits the attempt", async () => {
    mockUseCustomerAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false });
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: false });
    renderRoute();
    expect(screen.getByText("home page")).toBeTruthy();
    expect(screen.queryByText("admin panel")).toBeNull();
    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith(
        "log_admin_access_attempt",
        expect.objectContaining({ _path: "/admin", _granted: false }),
      );
    });
  });

  it("redirects anonymous visitors to the admin login", () => {
    mockUseCustomerAuth.mockReturnValue({ session: null, loading: false });
    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: false });
    renderRoute();
    expect(screen.getByText("admin login")).toBeTruthy();
  });

  it("renders the panel for admins and audits the granted access", async () => {
    mockUseCustomerAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false });
    mockUseIsAdmin.mockReturnValue({ isAdmin: true, loading: false });
    renderRoute();
    expect(screen.getByText("admin panel")).toBeTruthy();
    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith(
        "log_admin_access_attempt",
        expect.objectContaining({ _granted: true }),
      );
    });
  });
});
