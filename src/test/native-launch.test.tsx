import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
import NativeEntry from "@/components/NativeEntry";

function Panel() {
  const location = useLocation();
  return <><span>{location.pathname}{location.search}{location.hash}</span><Link to="/">Leave panel</Link></>;
}

describe("native launch navigation", () => {
  it("preserves launch parameters and does not bounce denied users back into admin", async () => {
    render(<MemoryRouter initialEntries={["/?forceHideBadge=true#launch"]}>
      <NativeEntry />
      <Routes>
        <Route path="/" element={<span>Store home</span>} />
        <Route path="/admin" element={<Panel />} />
      </Routes>
    </MemoryRouter>);
    await waitFor(() => expect(screen.getByText("/admin?forceHideBadge=true#launch")).toBeTruthy());
    fireEvent.click(screen.getByRole("link", { name: "Leave panel" }));
    await waitFor(() => expect(screen.getByText("Store home")).toBeTruthy());
    expect(screen.queryByRole("link", { name: "Leave panel" })).toBeNull();
  });
});