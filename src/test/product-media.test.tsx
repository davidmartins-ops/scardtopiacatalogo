import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ProductMedia from "@/components/ProductMedia";

// Avoid real network/db calls from the error analytics handler.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }) },
}));

beforeEach(() => {
  // Stub HEAD fetch used by the error diagnostic path.
  (global as any).fetch = vi.fn().mockResolvedValue({ status: 403 });
});

describe("ProductMedia", () => {
  it("renders the fallback when the drop has no cover image", () => {
    render(<ProductMedia src={null} alt="Drop sem capa" itemId="DROP-1" />);
    expect(screen.getByTestId("product-media-fallback")).toBeInTheDocument();
    expect(screen.getByText(/sem imagem cadastrada/i)).toBeInTheDocument();
    expect(screen.queryByTestId("product-media-skeleton")).not.toBeInTheDocument();
  });

  it("shows the skeleton while the image is loading (slow connection)", () => {
    render(
      <ProductMedia
        src="https://example.com/cover.jpg"
        alt="Drop loading"
        itemId="DROP-2"
      />,
    );
    // Skeleton is rendered until onLoad fires.
    expect(screen.getByTestId("product-media-skeleton")).toBeInTheDocument();
    // Image container starts hidden (opacity-0 + blur) for the fade transition.
    const wrapper = screen.getByTestId("product-media-image");
    expect(wrapper.className).toMatch(/opacity-0/);
    expect(wrapper.className).toMatch(/blur-md/);
  });

  it("uses lazy loading and async decoding on the actual <img>", () => {
    const { container } = render(
      <ProductMedia src="https://example.com/cover.jpg" alt="Lazy" itemId="DROP-3" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");
  });

  it("emits AVIF/WebP <source> entries for Supabase-hosted covers", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/products/drops/cover.jpg";
    const { container } = render(
      <ProductMedia src={url} alt="Modern formats" itemId="DROP-4" />,
    );
    const sources = container.querySelectorAll("picture source");
    const types = Array.from(sources).map((s) => s.getAttribute("type"));
    expect(types).toContain("image/avif");
    expect(types).toContain("image/webp");
  });

  it("transitions to the loaded image (removes blur/opacity) on load", async () => {
    const { container } = render(
      <ProductMedia src="https://example.com/cover.jpg" alt="Loaded" itemId="DROP-5" />,
    );
    const img = container.querySelector("img")!;
    await act(async () => {
      fireEvent.load(img);
    });
    const wrapper = screen.getByTestId("product-media-image");
    expect(wrapper.className).toMatch(/opacity-100/);
    expect(wrapper.className).toMatch(/blur-0/);
    expect(screen.queryByTestId("product-media-skeleton")).not.toBeInTheDocument();
  });

  it("shows a subtle error state when the image URL expires / fails to load", async () => {
    const { container } = render(
      <ProductMedia
        src="https://example.com/expired.jpg?token=oops"
        alt="Expired"
        itemId="DROP-6"
      />,
    );
    const img = container.querySelector("img")!;
    await act(async () => {
      fireEvent.error(img);
    });
    await waitFor(() => {
      expect(screen.getByTestId("product-media-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/imagem indisponível/i)).toBeInTheDocument();
  });

  it("reserves vertical space to avoid layout shift (CLS) by default", () => {
    render(<ProductMedia src={null} alt="frame" itemId="DROP-7" />);
    const frame = screen.getByTestId("product-media");
    expect(frame.className).toMatch(/min-h-\[180px\]/);
  });
});
