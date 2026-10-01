import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listeners, session, mfa } = vi.hoisted(() => ({
  listeners: [] as Array<(e: string, s: unknown) => void>,
  session: { user: { id: "admin-1", email: "a@x.com" } },
  mfa: {
  listFactors: vi.fn(async () => ({
    data: { totp: [{ id: "f-verified", status: "verified" }], all: [{ id: "f-verified", status: "verified" }] },
    error: null,
  })),
  unenroll: vi.fn(async () => ({ error: null })),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(async () => ({ error: null })),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa,
      getUser: vi.fn(async () => ({ data: { user: { ...session.user, identities: [{ provider: "email" }] } } })),
      signInWithPassword: vi.fn(async () => {
        listeners.forEach((l) => l("SIGNED_IN", session));
        return { error: null };
      }),
      onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
    functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }),
  },
}));
vi.mock("@/lib/admin-audit", () => ({ logAdminAction: vi.fn() }));

import AdminBackups from "@/pages/AdminBackups";
import TwoFactorPrompt from "@/components/TwoFactorPrompt";

describe("Backups re-authentication vs global 2FA prompt", () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, "", "/admin/backups");
  });

  it("does not open the global prompt nor unenroll the factor being verified", async () => {
    // Even without a verified factor in the prompt's eyes, it must stay closed on /admin/backups.
    render(
      <MemoryRouter initialEntries={["/admin/backups"]}>
        <TwoFactorPrompt />
        <AdminBackups />
      </MemoryRouter>,
    );
    const pwd = await screen.findByLabelText("Senha");
    fireEvent.change(pwd, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    await screen.findByLabelText("Código");
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    // Only the vault page queried factors; the global prompt ignored SIGNED_IN here.
    expect(mfa.listFactors).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() =>
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-verified", code: "123456" }),
    );
  });
});
