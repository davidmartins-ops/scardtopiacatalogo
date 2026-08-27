import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Garante que o painel de anexos aparece na tela de detalhe da encomenda,
// tanto com anexos existentes quanto vazio ou com erro na busca.

const attachmentsRows: any[] = [];
let shouldFail = false;

const fromSpy = vi.fn((table: string) => {
  if (table !== "special_order_attachments") throw new Error(`unexpected table ${table}`);
  return {
    select: () => ({
      eq: () => ({
        order: () =>
          Promise.resolve(
            shouldFail
              ? { data: null, error: new Error("rls") }
              : { data: attachmentsRows, error: null },
          ),
      }),
    }),
    insert: (row: any) => {
      attachmentsRows.unshift({
        id: `att-${attachmentsRows.length + 1}`,
        created_at: new Date().toISOString(),
        ...row,
      });
      return Promise.resolve({ error: null });
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => fromSpy(t),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://x/y" }, error: null }),
        remove: () => Promise.resolve({ error: null }),
      }),
    },
  },
}));

import SpecialOrderAttachmentsPanel from "@/components/SpecialOrderAttachmentsPanel";

const renderPanel = (id = "so-1") =>
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SpecialOrderAttachmentsPanel specialOrderId={id} />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe("SpecialOrderAttachmentsPanel", () => {
  beforeEach(() => {
    attachmentsRows.length = 0;
    shouldFail = false;
    fromSpy.mockClear();
  });

  it("renders the upload form even when there are no attachments", async () => {
    const { container } = renderPanel();
    await waitFor(() => {
      expect(container.textContent).toMatch(/Nenhum detalhe adicional enviado/i);
    });
    expect(container.textContent).toMatch(/Detalhes e anexos/i);
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("queries special_order_attachments by order and shows saved attachments", async () => {
    attachmentsRows.push({
      id: "att-1",
      special_order_id: "so-1",
      user_id: "u1",
      item_id: null,
      description: "Comprovante PIX",
      file_path: "u1/encomendas/so-1/1-file.pdf",
      file_name: "file.pdf",
      created_at: new Date().toISOString(),
    });
    const { container } = renderPanel();
    await waitFor(() => {
      expect(container.textContent).toMatch(/Comprovante PIX/);
    });
    expect(fromSpy).toHaveBeenCalledWith("special_order_attachments");
  });

  it("still shows the form and a retry action when the fetch fails", async () => {
    shouldFail = true;
    const { container } = renderPanel();
    await waitFor(() => {
      expect(container.textContent).toMatch(/Não foi possível carregar os anexos/i);
    });
    expect(container.textContent).toMatch(/Tentar novamente/i);
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });
});
